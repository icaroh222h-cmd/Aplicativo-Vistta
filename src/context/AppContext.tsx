import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { getApps, initializeApp } from 'firebase/app';
import { ref, push, update, remove, onValue, query, limitToLast, orderByChild, startAt, get, runTransaction } from 'firebase/database';
import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, sendPasswordResetEmail, signOut, User } from 'firebase/auth';
import { db, auth, firebaseConfig } from '../config/firebase';
import { Produto, Cliente, Venda, Caixa, CarrinhoItem, Orcamento, OrdemServico } from '../types';
import { trackEvent } from '../services/telemetry';

const provisioningApp = getApps().find(currentApp => currentApp.name === 'vistta-user-provisioning') || initializeApp(firebaseConfig, 'vistta-user-provisioning');
const provisioningAuth = getAuth(provisioningApp);

export const formatMoney = (v: number | string) => {
  const value = Number(v);
  return (Number.isFinite(value) ? value : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const toList = <T,>(value: T[] | Record<string, T> | null | undefined): T[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
};

interface AppContextType {
  user: User | null;
  loadingAuth: boolean;
  userRole: string | null;
  dadosEmpresa: { nome?: string; [key: string]: any } | null;
  databaseError: string | null;
  configurarOtica: (nome: string) => Promise<void>;
  logout: () => Promise<void>;
  produtos: Produto[];
  clientes: Cliente[];
  vendas: Venda[];
  caixas: Caixa[];
  orcamentos: Orcamento[];
  ordensServico: OrdemServico[];
  fornecedores: any[];
  contas: any[];
  categorias: any[];
  usuarios: any[];
  carrinho: CarrinhoItem[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pdvSearch: string;
  setPdvSearch: (value: string) => void;
  abrirCaixa: (valorInicial: number) => Promise<void>;
  fecharCaixa: () => Promise<void>;
  salvarProduto: (data: Partial<Produto>, id?: string) => Promise<void>;
  excluirProduto: (id: string) => Promise<void>;
  salvarCliente: (data: Partial<Cliente>, id?: string) => Promise<void>;
  excluirCliente: (id: string) => Promise<void>;
  salvarCadastro: (collection: string, data: Record<string, any>, id?: string) => Promise<void>;
  excluirCadastro: (collection: string, id: string) => Promise<void>;
  excluirOrcamento: (id: string) => Promise<void>;
  salvarOrdemServico: (data: Partial<OrdemServico>, id?: string) => Promise<void>;
  converterOrcamentoParaOs: (orcamento: Orcamento) => Promise<void>;
  registrarLancamentoCaixa: (data: { tipo: 'entrada' | 'saida' | 'sangria'; descricao: string; valor: number }) => Promise<void>;
  caixaAberto: Caixa | undefined;
  totalVendasCaixa: number;
  addToCart: (prod: Produto) => void;
  removeFromCart: (id: string) => void;
  finalizarVenda: (comoOrcamento?: boolean) => Promise<void>;
  pdvCliente: string;
  setPdvCliente: (id: string) => void;
  pdvDesconto: number;
  setPdvDesconto: (v: number) => void;
  pdvPagamento: string;
  setPdvPagamento: (p: string) => void;
  finalizandoVenda: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext deve ser usado dentro de um AppProvider');
  return context;
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [dadosEmpresa, setDadosEmpresa] = useState<{ nome?: string; [key: string]: any } | null>(null);
  const [databaseError, setDatabaseError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [pdvSearch, setPdvSearch] = useState('');
  const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([]);

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [caixas, setCaixas] = useState<Caixa[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([]);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);

  const [pdvCliente, setPdvCliente] = useState('');
  const [pdvPagamento, setPdvPagamento] = useState('Pix');
  const [pdvDesconto, setPdvDesconto] = useState(0);
  const [finalizandoVenda, setFinalizandoVenda] = useState(false);

  const vendaEmProcessamento = useRef(false);
  const perfilEmProvisionamento = useRef<string | null>(null);

  const caixaAberto = useMemo(() => caixas.find(c => c.status === 'aberto'), [caixas]);
  const vendasDoCaixa = useMemo(() => (caixaAberto ? vendas.filter(v => v.caixaId === caixaAberto.id) : []), [caixas, vendas, caixaAberto]);
  const totalVendasCaixa = useMemo(() => vendasDoCaixa.reduce((total, venda) => total + Number(venda.total || 0), 0), [vendasDoCaixa]);

  const configureDatabaseError = (message: string) => setDatabaseError(message);

  const configurarOtica = async (nome: string) => {
    const nomeNormalizado = nome.trim();
    if (!user) throw new Error('Usuário não autenticado.');
    if (!nomeNormalizado) throw new Error('Informe o nome da ótica.');

    const configuracoesPath = 'configuracoes/empresa';
    const payload = {
      nome: nomeNormalizado,
      criadoEm: new Date().toISOString(),
      criadoPor: user.uid,
      status: 'ativa'
    };

    try {
      await update(ref(db, configuracoesPath), payload);
      await update(ref(db, `users/${user.uid}`), {
        role: 'admin',
        status: 'active',
        email: user.email || '',
        nome: user.displayName || nomeNormalizado,
        loja: nomeNormalizado
      });
      setDadosEmpresa(payload);
      setUserRole('admin');
      void trackEvent('loja_configurada');
    } catch (error: any) {
      const code = error?.code || 'unknown';
      const message = error?.message || String(error);
      configureDatabaseError(`Não foi possível salvar a configuração da ótica. Código: ${code}. ${message}`);
      throw new Error(`Não foi possível salvar a configuração da ótica. ${message}`);
    }
  };

  const logout = async () => {
    await signOut(auth);
    void trackEvent('logout');
    setCarrinho([]);
    setProdutos([]);
    setClientes([]);
    setVendas([]);
    setCaixas([]);
    setOrcamentos([]);
    setOrdensServico([]);
    setFornecedores([]);
    setContas([]);
    setCategorias([]);
    setUsuarios([]);
    setPdvCliente('');
    setPdvSearch('');
    setPdvDesconto(0);
    setPdvPagamento('Pix');
    setActiveTab('dashboard');
  };

  const saveRecord = async (collection: string, data: Record<string, any>, id?: string) => {
    const collectionPath = collection;
    if (id) {
      await update(ref(db, `${collectionPath}/${id}`), data);
      return;
    }
    const recordRef = push(ref(db, collectionPath));
    await update(ref(db, `${collectionPath}/${recordRef.key}`), data);
  };

  const deleteRecord = async (collection: string, id: string) => {
    await remove(ref(db, `${collection}/${id}`));
  };

  useEffect(() => {
    let profileUnsubscribe: (() => void) | undefined;
    let profileTimeout: ReturnType<typeof setTimeout> | undefined;

    const clearProfileListener = () => {
      profileUnsubscribe?.();
      profileUnsubscribe = undefined;
      if (profileTimeout) clearTimeout(profileTimeout);
      profileTimeout = undefined;
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      clearProfileListener();

      if (!u) {
        perfilEmProvisionamento.current = null;
        setUser(null);
        setUserRole(null);
        setDadosEmpresa(null);
        setDatabaseError(null);
        setLoadingAuth(false);
        return;
      }

      setDatabaseError(null);
      const profileRef = ref(db, `users/${u.uid}`);

      try {
        const profileSnapshot = await get(profileRef);
        if (!profileSnapshot.exists() && perfilEmProvisionamento.current !== u.uid) {
          perfilEmProvisionamento.current = u.uid;
          await update(profileRef, {
            role: 'admin',
            status: 'active',
            email: u.email || '',
            nome: u.displayName || '',
            createdAt: new Date().toISOString()
          });
        }
      } catch (error: any) {
        console.error('[Auth] Falha ao criar/recuperar perfil', error);
        setDatabaseError(`Não foi possível criar o perfil do usuário. ${error?.message || 'Verifique a conexão.'}`);
        setUser(null);
        setUserRole(null);
        setLoadingAuth(false);
        return;
      }

      profileTimeout = setTimeout(() => {
        console.error('Tempo excedido ao carregar o perfil do usuário.');
        setDatabaseError('Não foi possível carregar seu perfil. Verifique a conexão e tente novamente.');
        setUser(null);
        setUserRole(null);
        setLoadingAuth(false);
      }, 10000);

      profileUnsubscribe = onValue(profileRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.val() || {};
        const nextRole = ['admin', 'gerente', 'vendedor', 'caixa', 'estoque', 'atendente'].includes(data.role) ? data.role : 'admin';
        setUserRole(nextRole);
        setUser(u);
        setLoadingAuth(false);
        clearProfileListener();

        const lojaRef = ref(db, 'configuracoes/empresa');
        get(lojaRef).then((lojaSnapshot) => {
          if (lojaSnapshot.exists()) {
            setDadosEmpresa(lojaSnapshot.val());
          } else {
            setDadosEmpresa(null);
          }
        }).catch((error: any) => {
          console.error('Não foi possível carregar a configuração da ótica:', error);
          setDatabaseError('Não foi possível carregar a configuração da ótica.');
        });
      }, (error) => {
        console.error('Não foi possível carregar o perfil do usuário:', error);
        setUser(null);
        setUserRole(null);
        setDadosEmpresa(null);
        setDatabaseError('Não foi possível carregar seu perfil no Firebase. Verifique as regras do Realtime Database.');
        setLoadingAuth(false);
        clearProfileListener();
      });
    });

    return () => {
      clearProfileListener();
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    const baseCollections = [
      { name: 'produtos', setter: setProdutos, queryRef: ref(db, 'produtos') },
      { name: 'clientes', setter: setClientes, queryRef: ref(db, 'clientes') },
      { name: 'fornecedores', setter: setFornecedores, queryRef: ref(db, 'fornecedores') },
      { name: 'categorias', setter: setCategorias, queryRef: ref(db, 'categorias') },
      { name: 'orcamentos', setter: setOrcamentos, queryRef: ref(db, 'orcamentos') },
      { name: 'ordensServico', setter: setOrdensServico, queryRef: ref(db, 'ordensServico') },
      { name: 'vendas', setter: setVendas, queryRef: query(ref(db, 'vendas'), orderByChild('data'), startAt(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())) },
      { name: 'caixas', setter: setCaixas, queryRef: query(ref(db, 'caixas'), limitToLast(100)) }
    ];

    if (userRole === 'admin') {
      baseCollections.push(
        { name: 'contas', setter: setContas, queryRef: ref(db, 'contas') },
        { name: 'usuarios', setter: setUsuarios, queryRef: ref(db, 'users') }
      );
    } else {
      setContas([]);
      setUsuarios([]);
    }

    const unsubs = baseCollections.map(col => onValue(col.queryRef, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((child) => {
        const value = child.val();
        const record = value && typeof value === 'object' ? { id: child.key, ...value } : { id: child.key, value };
        if (col.name === 'caixas') record.lancamentos = toList(record.lancamentos);
        data.push(record);
      });
      col.setter(data);
    }, (error) => {
      console.error(`Erro ao carregar ${col.name}:`, error);
      setDatabaseError(`Não foi possível carregar ${col.name}. Verifique as regras do Firebase.`);
    }));

    return () => unsubs.forEach(unsub => unsub());
  }, [userRole]);

  const addToCart = (prod: Produto) => {
    const estoqueDisponivel = Number(prod.qtd);
    if (!prod.id || !Number.isFinite(estoqueDisponivel) || estoqueDisponivel <= 0) return;
    setCarrinho(prev => {
      const idx = prev.findIndex(item => item.id === prod.id);
      if (idx > -1) {
        const nextCart = [...prev];
        nextCart[idx].qtd = Math.min(nextCart[idx].qtd + 1, Number(prod.qtd));
        return nextCart;
      }
      return [...prev, { ...prod, qtd: 1 }];
    });
  };

  const removeFromCart = (id: string) => setCarrinho(prev => prev.filter(item => item.id !== id));

  const abrirCaixa = async (valorInicial: number) => {
    if (!Number.isFinite(valorInicial) || valorInicial < 0) throw new Error('Informe um valor inicial válido.');
    if (caixaAberto) throw new Error('Já existe um caixa aberto.');
    const caixaRef = push(ref(db, 'caixas'));
    if (!caixaRef.key) throw new Error('Não foi possível gerar o caixa.');
    await update(caixaRef, {
      dataAbertura: new Date().toISOString(),
      valorInicial,
      status: 'aberto',
      operador: user?.uid
    });
  };

  const fecharCaixa = async () => {
    const caixa = caixaAberto;
    if (!caixa) throw new Error('Nenhum caixa aberto.');
    const totalLancamentos = toList(caixa.lancamentos).reduce((total, item) => total + (item.tipo === 'entrada' ? Number(item.valor) : -Number(item.valor)), 0);
    await update(ref(db, `caixas/${caixa.id}`), {
      status: 'fechado',
      dataFechamento: new Date().toISOString(),
      fechadoPor: user?.uid,
      totalVendas: totalVendasCaixa,
      valorFinal: Number(caixa.valorInicial || 0) + totalVendasCaixa + totalLancamentos
    });
  };

  const salvarProduto = (data: Partial<Produto>, id?: string) => {
    const produto = {
      ...data,
      custo: Number(data.custo),
      venda: Number(data.venda),
      qtd: Number(data.qtd),
      min: Number(data.min)
    };

    if (![produto.custo, produto.venda, produto.qtd, produto.min].every(value => Number.isFinite(value) && value >= 0)) {
      throw new Error('Informe valores numéricos válidos para custo, venda e estoque.');
    }

    return saveRecord('produtos', produto, id);
  };

  const excluirProduto = (id: string) => deleteRecord('produtos', id);
  const salvarCliente = (data: Partial<Cliente>, id?: string) => saveRecord('clientes', data, id);
  const excluirCliente = (id: string) => deleteRecord('clientes', id);

  const salvarCadastro = async (collection: string, data: Record<string, any>, id?: string) => {
    if (collection !== 'usuarios' || id) {
      const normalizedData = collection === 'contas'
        ? { ...data, valor: Number(data.valor) }
        : collection === 'fornecedores'
          ? { ...data, prazoEntrega: data.prazoEntrega === '' ? 0 : Number(data.prazoEntrega) }
          : data;

      if (collection === 'contas' && (!Number.isFinite(normalizedData.valor) || normalizedData.valor < 0)) {
        throw new Error('Informe um valor válido para a conta.');
      }

      await saveRecord(collection, normalizedData, id);
      return;
    }

    if (!user) throw new Error('Usuário não autenticado. Entre novamente.');
    if (userRole !== 'admin') throw new Error('Somente administradores podem criar usuários.');

    const email = String(data.email || '').trim().toLowerCase();
    if (!email) throw new Error('Informe o e-mail do usuário.');
    const senha = String(data.senha || '');
    const confirmarSenha = String(data.confirmarSenha || '');
    if (senha && senha.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
    if (senha !== confirmarSenha) throw new Error('As senhas informadas não coincidem.');

    let criado: User | null = null;
    try {
      const credencial = await createUserWithEmailAndPassword(provisioningAuth, email, senha || `${crypto.randomUUID()}Aa1!`);
      criado = credencial.user;
      const perfil = data.perfil === 'gerente' ? 'gerente' : data.perfil === 'vendedor' ? 'vendedor' : data.perfil === 'caixa' ? 'caixa' : data.perfil === 'estoque' ? 'estoque' : 'atendente';
      await update(ref(db, `users/${criado.uid}`), {
        role: perfil,
        status: 'active',
        email,
        nome: data.nome || '',
        convidadoPor: user.uid
      });

      if (!senha) await sendPasswordResetEmail(provisioningAuth, email);
      const { senha: _senha, confirmarSenha: _confirmarSenha, ...dadosUsuario } = data;
      await saveRecord('usuarios', {
        ...dadosUsuario,
        email,
        authUid: criado.uid,
        status: senha ? 'acesso_criado' : 'convite_enviado',
        criadoEm: new Date().toISOString()
      });
      await signOut(provisioningAuth).catch(() => undefined);
    } catch (error: any) {
      if (criado) {
        await remove(ref(db, `users/${criado.uid}`)).catch(() => undefined);
        await criado.delete().catch(() => undefined);
      }
      await signOut(provisioningAuth).catch(() => undefined);
      throw new Error(error?.code === 'auth/email-already-in-use' ? 'Este e-mail já possui uma conta.' : error?.message || 'Não foi possível criar o usuário.');
    }
  };

  const excluirCadastro = (collection: string, id: string) => deleteRecord(collection, id);
  const excluirOrcamento = (id: string) => deleteRecord('orcamentos', id);
  const salvarOrdemServico = (data: Partial<OrdemServico>, id?: string) => saveRecord('ordensServico', data, id);

  const converterOrcamentoParaOs = async (orcamento: Orcamento) => {
    if (orcamento.status !== 'pendente') throw new Error('Este orçamento já foi processado.');
    if (ordensServico.some(ordem => ordem.orcamentoId === orcamento.id)) throw new Error('Este orçamento já possui uma ordem de serviço.');

    await salvarOrdemServico({
      clienteId: orcamento.cliId,
      orcamentoId: orcamento.id,
      itens: toList(orcamento.itens).map(item => ({
        produtoId: item.id,
        descricao: `${item.marca || ''} ${item.modelo || ''}`.trim(),
        qtd: Number(item.qtd) || 1,
        valor: Number(item.venda) || 0,
        tratamento: ''
      })),
      status: 'aguardando_montagem',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    });

    await update(ref(db, `orcamentos/${orcamento.id}`), { status: 'aprovado' });
  };

  const registrarLancamentoCaixa = async (data: { tipo: 'entrada' | 'saida' | 'sangria'; descricao: string; valor: number }) => {
    const caixa = caixaAberto;
    if (!caixa) throw new Error('Abra o caixa antes de registrar um lançamento.');
    if (!Number.isFinite(data.valor) || data.valor <= 0) throw new Error('Informe um valor válido.');
    const lancamentoRef = push(ref(db, `caixas/${caixa.id}/lancamentos`));
    await update(lancamentoRef, { ...data, data: new Date().toISOString(), operador: user?.uid });
  };

  const finalizarVenda = async (comoOrcamento = false) => {
    if (vendaEmProcessamento.current) return;
    if (carrinho.length === 0) return alert('Carrinho vazio!');
    if (!comoOrcamento && !caixaAberto) return alert('Abra o caixa primeiro!');

    const subtotal = carrinho.reduce((total, item) => total + Number(item.venda) * item.qtd, 0);
    const custoTotal = carrinho.reduce((total, item) => total + Number(item.custo) * item.qtd, 0);
    const desconto = Math.min(Math.max(0, Number(pdvDesconto) || 0), subtotal);

    vendaEmProcessamento.current = true;
    setFinalizandoVenda(true);

    try {
      if (comoOrcamento) {
        if (!pdvCliente) return alert('Selecione um cliente para salvar o orçamento!');
        await push(ref(db, 'orcamentos'), {
          cliId: pdvCliente,
          subtotal,
          desconto,
          total: subtotal - desconto,
          itens: carrinho.map(item => ({ id: item.id, marca: item.marca, modelo: item.modelo, qtd: item.qtd, venda: item.venda })),
          data: new Date().toISOString(),
          status: 'pendente'
        });
      } else {
        const itemsAtualizados = await Promise.all(carrinho.map(async (item) => {
          const snapshot = await get(ref(db, `produtos/${item.id}`));
          if (!snapshot.exists()) throw new Error(`O produto ${item.marca} ${item.modelo} não existe mais.`);
          const produto = snapshot.val();
          const venda = Number(produto.venda);
          const custo = Number(produto.custo);
          if (!Number.isFinite(venda) || venda < 0 || !Number.isFinite(custo) || custo < 0) throw new Error('Existe um produto com valores inválidos.');
          return { item, venda, custo, codigo: String(produto.codigo || ''), marca: String(produto.marca || ''), modelo: String(produto.modelo || '') };
        }));

        const itensVenda = itemsAtualizados.map(({ item, venda, custo, codigo, marca, modelo }) => ({ id: item.id, codigo, marca, modelo, qtd: item.qtd, venda, custo }));
        const subtotalAtualizado = itensVenda.reduce((total, item) => total + Number(item.venda) * Number(item.qtd), 0);
        const descontoAtualizado = Math.min(Math.max(0, Number(pdvDesconto) || 0), subtotalAtualizado);
        const reservados: typeof itensVenda = [];

        try {
          for (const item of itensVenda) {
            const result = await runTransaction(ref(db, `produtos/${item.id}/qtd`), (estoqueAtual) => {
              const estoque = Number(estoqueAtual);
              if (!Number.isFinite(estoque) || estoque < item.qtd) return;
              return estoque - item.qtd;
            });
            if (!result.committed) throw new Error(`Estoque insuficiente para ${item.marca || item.id}.`);
            reservados.push(item);
          }

          await update(push(ref(db, 'vendas')), {
            cliId: pdvCliente,
            pag: pdvPagamento,
            subtotal: subtotalAtualizado,
            desconto: descontoAtualizado,
            total: subtotalAtualizado - descontoAtualizado,
            custoBase: reservados.reduce((total, item) => total + Number(item.custo) * Number(item.qtd), 0),
            itens: reservados.length,
            itensDetalhados: reservados,
            data: new Date().toISOString(),
            caixaId: caixaAberto?.id,
            criadoPor: user?.uid
          });
        } catch (error) {
          await Promise.all(reservados.map(item => runTransaction(ref(db, `produtos/${item.id}/qtd`), (estoqueAtual) => Number(estoqueAtual || 0) + item.qtd)));
          throw error;
        }
      }

      setCarrinho([]);
      setPdvDesconto(0);
      setPdvCliente('');
      alert(comoOrcamento ? 'Orçamento salvo!' : 'Venda concluída com sucesso!');
    } catch (error: any) {
      alert(`Erro ao finalizar venda: ${error?.message || 'Não foi possível concluir a operação.'}`);
    } finally {
      vendaEmProcessamento.current = false;
      setFinalizandoVenda(false);
    }
  };

  const value = {
    user,
    loadingAuth,
    userRole,
    dadosEmpresa,
    databaseError,
    configurarOtica,
    logout,
    produtos,
    clientes,
    vendas,
    caixas,
    orcamentos,
    ordensServico,
    fornecedores,
    contas,
    categorias,
    usuarios,
    carrinho,
    activeTab,
    setActiveTab,
    pdvSearch,
    setPdvSearch,
    abrirCaixa,
    fecharCaixa,
    salvarProduto,
    excluirProduto,
    salvarCliente,
    excluirCliente,
    salvarCadastro,
    excluirCadastro,
    excluirOrcamento,
    salvarOrdemServico,
    converterOrcamentoParaOs,
    registrarLancamentoCaixa,
    caixaAberto,
    totalVendasCaixa,
    addToCart,
    removeFromCart,
    finalizarVenda,
    finalizandoVenda,
    pdvCliente,
    setPdvCliente,
    pdvDesconto,
    setPdvDesconto,
    pdvPagamento,
    setPdvPagamento
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};