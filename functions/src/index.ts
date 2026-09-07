import { initializeApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getDatabase, ServerValue } from 'firebase-admin/database';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

initializeApp();

const database = getDatabase();
const adminAuth = getAdminAuth();
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

type UserProfile = { empresaId?: string; role?: string };
type SaleItem = { id: string; qtd: number; venda: number; custo: number; codigo?: string; marca?: string; modelo?: string };

type SalePayload = {
  requestId: string;
  cliId?: string;
  pag: string;
  desconto?: number;
  items: SaleItem[];
};

type CallableRequest = { auth?: { uid: string; token?: Record<string, unknown> } | null; data?: any };

function requireAuth(request: { auth?: { uid: string } | null }): string {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
  return request.auth.uid;
}

function requireOwner(request: CallableRequest): string {
  const uid = requireAuth(request);
  if (request.auth?.token?.role !== 'developer' && request.auth?.token?.platformOwner !== true) throw new HttpsError('permission-denied', 'Somente um developer da plataforma pode executar esta operação.');
  return uid;
}

async function writePlatformAudit(actorUid: string, action: string, metadata: Record<string, unknown> = {}) {
  await database.ref('platformAudit').push({ actorUid, action, metadata, timestamp: new Date().toISOString(), origin: 'cloud-function' });
}

async function getCompany(uid: string, adminOnly = false): Promise<{ empresaId: string; profile: UserProfile }> {
  const snapshot = await database.ref(`users/${uid}`).get();
  const profile = snapshot.val() as UserProfile | null;
  if (!profile?.empresaId) throw new HttpsError('failed-precondition', 'Usuário sem empresa vinculada.');
  if (adminOnly && profile.role !== 'admin') throw new HttpsError('permission-denied', 'Somente administradores podem executar esta operação.');
  return { empresaId: profile.empresaId, profile };
}

function numberOrError(value: unknown, label: string, minimum = 0): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum) throw new HttpsError('invalid-argument', `${label} inválido.`);
  return number;
}

function validateItems(items: unknown): SaleItem[] {
  if (!Array.isArray(items) || items.length === 0) throw new HttpsError('invalid-argument', 'A venda precisa ter itens.');
  const validItems = items.map((item: SaleItem) => ({
    id: String(item.id || ''),
    qtd: numberOrError(item.qtd, 'Quantidade', 0.000001),
    venda: numberOrError(item.venda, 'Preço de venda'),
    custo: numberOrError(item.custo, 'Custo'),
    codigo: item.codigo || '',
    marca: item.marca || '',
    modelo: item.modelo || ''
  })).filter(item => item.id);
  if (validItems.length === 0) throw new HttpsError('invalid-argument', 'A venda precisa ter itens válidos.');
  return validItems;
}

async function claimRequest(path: string, uid: string): Promise<'claimed' | 'completed'> {
  const now = Date.now();
  const result = await database.ref(path).transaction((current: { status?: string; updatedAt?: number; saleId?: string } | null) => {
    if (current?.status === 'completed') return current;
    if (current?.status === 'processing' && now - Number(current.updatedAt || now) < PROCESSING_TIMEOUT_MS) return;
    return { status: 'processing', uid, updatedAt: ServerValue.TIMESTAMP };
  });
  if (!result.committed) {
    if (result.snapshot.val()?.status === 'completed') return 'completed';
    throw new HttpsError('aborted', 'Esta operação já está sendo processada.');
  }
  return 'claimed';
}

export const finalizeSale = onCall(async request => {
  const uid = requireAuth(request);
  const { empresaId, profile } = await getCompany(uid);
  const payload = request.data as SalePayload;
  const requestId = String(payload?.requestId || '');
  if (!requestId || requestId.length > 100) throw new HttpsError('invalid-argument', 'Identificador da venda inválido.');

  const requestedItems = validateItems(payload?.items);
  const items = await Promise.all(requestedItems.map(async item => {
    const productSnapshot = await database.ref(`empresas/${empresaId}/produtos/${item.id}`).get();
    const product = productSnapshot.val();
    if (!productSnapshot.exists() || !product) throw new HttpsError('not-found', 'Um dos produtos da venda não existe mais.');
    const venda = Number(product.venda);
    const custo = Number(product.custo);
    if (!Number.isFinite(venda) || venda < 0 || !Number.isFinite(custo) || custo < 0) {
      throw new HttpsError('failed-precondition', 'Um dos produtos possui valores inválidos.');
    }
    return { ...item, venda, custo, codigo: String(product.codigo || ''), marca: String(product.marca || ''), modelo: String(product.modelo || '') };
  }));
  const pagamento = String(payload?.pag || '').trim();
  if (!pagamento) throw new HttpsError('invalid-argument', 'Forma de pagamento obrigatória.');
  const subtotal = items.reduce((sum, item) => sum + item.venda * item.qtd, 0);
  const custoTotal = items.reduce((sum, item) => sum + item.custo * item.qtd, 0);
  const desconto = Math.min(numberOrError(payload?.desconto || 0, 'Desconto'), subtotal);
  const total = subtotal - desconto;
  const requestPath = `empresas/${empresaId}/operacoes/vendas/${requestId}`;
  const claim = await claimRequest(requestPath, uid);
  if (claim === 'completed') {
    const previous = (await database.ref(requestPath).get()).val();
    return { saleId: previous.saleId, total: previous.total, alreadyProcessed: true };
  }

  const reserved: SaleItem[] = [];
  try {
    for (const item of items) {
      const productPath = `empresas/${empresaId}/produtos/${item.id}/qtd`;
      const result = await database.ref(productPath).transaction(current => {
        const available = Number(current);
        if (!Number.isFinite(available) || available < item.qtd) return;
        return available - item.qtd;
      });
      if (!result.committed) throw new HttpsError('failed-precondition', `Estoque insuficiente para ${item.marca || item.id}.`);
      reserved.push(item);
    }

    const saleRef = database.ref(`empresas/${empresaId}/vendas`).push();
    const saleId = saleRef.key;
    if (!saleId) throw new HttpsError('internal', 'Não foi possível gerar a venda.');
    const caixaSnapshot = await database.ref(`empresas/${empresaId}/caixas`).orderByChild('status').equalTo('aberto').limitToFirst(1).get();
    let caixaId = '';
    caixaSnapshot.forEach(child => { caixaId = child.key || ''; return true; });
    if (!caixaId) throw new HttpsError('failed-precondition', 'Abra o caixa antes de vender.');

    const sale = {
      cliId: payload.cliId || '',
      pag: pagamento,
      subtotal,
      desconto,
      total,
      custoBase: custoTotal,
      itens: items.length,
      itensDetalhados: items,
      data: new Date().toISOString(),
      caixaId,
      criadoPor: uid
    };
    await database.ref().update({
      [`empresas/${empresaId}/vendas/${saleId}`]: sale,
      [requestPath]: { status: 'completed', saleId, total, updatedAt: ServerValue.TIMESTAMP }
    });
    return { saleId, total, alreadyProcessed: false };
  } catch (error) {
    await Promise.all(reserved.map(item => database.ref(`empresas/${empresaId}/produtos/${item.id}/qtd`).transaction(current => Number(current || 0) + item.qtd)));
    await database.ref(requestPath).remove();
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Não foi possível finalizar a venda.');
  }
});

export const openCash = onCall(async request => {
  try {
    const uid = requireAuth(request);
    const { empresaId } = await getCompany(uid);
    const valorInicial = numberOrError(request.data?.valorInicial, 'Fundo inicial');
    const caixasRef = database.ref(`empresas/${empresaId}/caixas`);
    const caixaRef = caixasRef.push();
    const result = await caixasRef.transaction(current => {
      const caixas = current && typeof current === 'object' ? Object.values(current) : [];
      if (caixas.some((caixa: any) => caixa?.status === 'aberto')) return;
      return { ...(current || {}), [caixaRef.key as string]: { dataAbertura: new Date().toISOString(), valorInicial, status: 'aberto', operador: uid } };
    });
    if (!result.committed) throw new HttpsError('already-exists', 'Já existe um caixa aberto.');
    return { caixaId: caixaRef.key };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Falha inesperada ao abrir caixa:', error);
    throw new HttpsError('internal', 'Não foi possível abrir o caixa. Verifique a conexão com o Firebase e tente novamente.');
  }
});

export const closeCash = onCall(async request => {
  const uid = requireAuth(request);
  const { empresaId, profile } = await getCompany(uid);
  const caixaId = String(request.data?.caixaId || '');
  if (!caixaId) throw new HttpsError('invalid-argument', 'Caixa inválido.');
  const caixaRef = database.ref(`empresas/${empresaId}/caixas/${caixaId}`);
  const [vendasSnapshot, caixaSnapshot] = await Promise.all([
    database.ref(`empresas/${empresaId}/vendas`).orderByChild('caixaId').equalTo(caixaId).get(),
    caixaRef.get()
  ]);
  if (!caixaSnapshot.exists() || caixaSnapshot.val()?.status !== 'aberto') throw new HttpsError('failed-precondition', 'O caixa já foi fechado ou não existe.');
  if (profile.role !== 'admin' && caixaSnapshot.val()?.operador !== uid) throw new HttpsError('permission-denied', 'Somente o operador do caixa pode fechá-lo.');
  const totalVendas = (() => {
    let total = 0;
    vendasSnapshot.forEach(child => { total += Number(child.val()?.total || 0); return false; });
    return total;
  })();
  const result = await caixaRef.transaction((caixa: any) => {
    if (!caixa || caixa.status !== 'aberto') return;
    const lancamentos = caixa.lancamentos && typeof caixa.lancamentos === 'object' ? Object.values(caixa.lancamentos) : [];
    const totalLancamentos = lancamentos.reduce((total: number, item: any) => total + (item?.tipo === 'entrada' ? Number(item?.valor || 0) : -Number(item?.valor || 0)), 0);
    return { ...caixa, status: 'fechado', dataFechamento: new Date().toISOString(), fechadoPor: uid, totalVendas, valorFinal: Number(caixa.valorInicial || 0) + totalVendas + totalLancamentos };
  });
  if (!result.committed) throw new HttpsError('failed-precondition', 'O caixa já foi fechado ou não existe.');
  return { caixaId };
});
export const addCashEntry = onCall(async request => {
  const uid = requireAuth(request);
  const { empresaId } = await getCompany(uid);
  const caixaId = String(request.data?.caixaId || '');
  const tipo = String(request.data?.tipo || '');
  const descricao = String(request.data?.descricao || '').trim();
  const valor = numberOrError(request.data?.valor, 'Valor', 0.01);
  if (!caixaId || !['entrada', 'saida', 'sangria'].includes(tipo) || !descricao) throw new HttpsError('invalid-argument', 'Lançamento inválido.');
  const caixa = await database.ref(`empresas/${empresaId}/caixas/${caixaId}`).get();
  if (!caixa.exists() || caixa.val()?.status !== 'aberto') throw new HttpsError('failed-precondition', 'O caixa está fechado.');
  const entryRef = database.ref(`empresas/${empresaId}/caixas/${caixaId}/lancamentos`).push();
  await entryRef.set({ tipo, descricao, valor, data: new Date().toISOString(), operador: uid });
  return { entryId: entryRef.key };
});

export const getPlatformOverview = onCall(async request => {
  const ownerUid = requireOwner(request);
  const [usersSnapshot, companiesSnapshot, auditSnapshot] = await Promise.all([
    database.ref('users').get(),
    database.ref('empresas').get(),
    database.ref('platformAudit').limitToLast(25).get()
  ]);
  const users = usersSnapshot.val() && typeof usersSnapshot.val() === 'object' ? Object.entries(usersSnapshot.val() as Record<string, any>) : [];
  const companies = companiesSnapshot.val() && typeof companiesSnapshot.val() === 'object' ? Object.entries(companiesSnapshot.val() as Record<string, any>) : [];
  const isActive = (value: any) => !['blocked', 'suspended', 'inactive'].includes(String(value?.status || '').toLowerCase());
  const now = Date.now();
  const newSince = now - 30 * 24 * 60 * 60 * 1000;
  const createdAt = (value: any) => Date.parse(value?.createdAt || value?.criadoEm || '') || 0;
  const recentLogins = users.map(([uid, value]) => ({ uid, ...value })).filter(value => value.lastLoginAt).sort((a, b) => Date.parse(String(b.lastLoginAt)) - Date.parse(String(a.lastLoginAt))).slice(-10).reverse();
  const activity = auditSnapshot.val() && typeof auditSnapshot.val() === 'object' ? Object.entries(auditSnapshot.val() as Record<string, any>).map(([id, value]) => ({ id, ...value })).reverse() : [];
  await writePlatformAudit(ownerUid, 'platform.overview.viewed');
  return {
    generatedAt: new Date().toISOString(),
    users: { total: users.length, active: users.filter(([, value]) => isActive(value)).length, blocked: users.filter(([, value]) => !isActive(value)).length, newLast30Days: users.filter(([, value]) => createdAt(value) >= newSince).length },
    companies: { total: companies.length, active: companies.filter(([, value]) => isActive(value?.info)).length, blocked: companies.filter(([, value]) => !isActive(value?.info)).length, newLast30Days: companies.filter(([, value]) => createdAt(value?.info) >= newSince).length },
    recentLogins,
    recentActivity: activity,
    security: { ownerUid, mfa: 'not_configured', suspiciousAttempts: 'not_collected' },
    billing: { configured: false, message: 'Nenhuma integração de planos ou pagamentos foi configurada.' }
  };
});

export const listPlatformCompanies = onCall(async request => {
  const ownerUid = requireOwner(request);
  const [companiesSnapshot, usersSnapshot] = await Promise.all([database.ref('empresas').get(), database.ref('users').get()]);
  const companies = companiesSnapshot.val() && typeof companiesSnapshot.val() === 'object' ? companiesSnapshot.val() as Record<string, any> : {};
  const users = usersSnapshot.val() && typeof usersSnapshot.val() === 'object' ? Object.values(usersSnapshot.val() as Record<string, any>) : [];
  const result = Object.entries(companies).map(([companyId, value]) => ({ companyId, info: value?.info || {}, userCount: users.filter((user: any) => user.empresaId === companyId).length }));
  await writePlatformAudit(ownerUid, 'platform.companies.viewed');
  return { companies: result };
});

export const setCompanyStatus = onCall(async request => {
  const ownerUid = requireOwner(request);
  const companyId = String(request.data?.companyId || '');
  const status = String(request.data?.status || '');
  if (!companyId || !['active', 'blocked'].includes(status)) throw new HttpsError('invalid-argument', 'Empresa ou status inválido.');
  const companyRef = database.ref(`empresas/${companyId}/info`);
  if (!(await companyRef.get()).exists()) throw new HttpsError('not-found', 'Empresa não encontrada.');
  await companyRef.update({ status, updatedAt: new Date().toISOString(), updatedBy: ownerUid });
  await writePlatformAudit(ownerUid, 'company.status.changed', { companyId, status });
  return { companyId, status };
});

export const setUserStatus = onCall(async request => {
  const ownerUid = requireOwner(request);
  const uid = String(request.data?.uid || '');
  const status = String(request.data?.status || '');
  if (!uid || !['active', 'blocked'].includes(status)) throw new HttpsError('invalid-argument', 'Usuário ou status inválido.');
  if (uid === ownerUid) throw new HttpsError('failed-precondition', 'O proprietário não pode bloquear a própria conta.');
  const userRef = database.ref(`users/${uid}`);
  if (!(await userRef.get()).exists()) throw new HttpsError('not-found', 'Usuário não encontrado.');
  await userRef.update({ status, updatedAt: new Date().toISOString(), updatedBy: ownerUid });
  if (status === 'blocked') await adminAuth.updateUser(uid, { disabled: true });
  else await adminAuth.updateUser(uid, { disabled: false });
  await writePlatformAudit(ownerUid, 'user.status.changed', { uid, status });
  return { uid, status };
});
