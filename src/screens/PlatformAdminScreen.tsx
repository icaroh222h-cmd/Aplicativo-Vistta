import React from 'react';
import { Activity, BarChart3, Boxes, ShieldCheck, Users, Wallet } from 'lucide-react';
import { useAppContext, formatMoney } from '../context/AppContext';
import { ScreenHeader } from '../components/SharedUI';

export function PlatformAdminScreen() {
  const { produtos, clientes, vendas, caixas, usuarios, userRole } = useAppContext();

  const totalEstoque = produtos.reduce((total, item) => total + Number(item.qtd || 0), 0);
  const totalVendas = vendas.reduce((total, venda) => total + Number(venda.total || 0), 0);
  const caixaAberto = caixas.find(item => item.status === 'aberto');
  const produtosCriticos = produtos.filter(item => Number(item.qtd || 0) <= Number(item.min || 0)).length;

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
      <ScreenHeader
        eyebrow="Administração da ótica"
        title="Painel administrativo"
        description="Gestão das operações, usuários e desempenho da única loja ativa."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Clientes" value={clientes.length} detail="cadastros ativos" icon={Users} />
        <Metric label="Produtos" value={produtos.length} detail={`${totalEstoque} itens em estoque`} icon={Boxes} />
        <Metric label="Vendas" value={formatMoney(totalVendas)} detail={`${vendas.length} registro(s)`} icon={BarChart3} />
        <Metric label="Caixa" value={caixaAberto ? 'Aberto' : 'Fechado'} detail={caixaAberto ? `Saldo: ${formatMoney(caixaAberto.valorInicial || 0)}` : 'Sem caixa em operação'} icon={Wallet} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <section className="rounded-3xl border border-[var(--vistta-border)] bg-[var(--vistta-surface)] p-5 shadow-[0_10px_35px_rgba(48,32,77,.05)]">
          <h2 className="font-display text-lg font-bold">Resumo operaçional</h2>
          <div className="mt-4 space-y-3">
            <InfoRow label="Usuários ativos" value={String(usuarios.length)} icon={Users} />
            <InfoRow label="Perfil atual" value={userRole || 'sem papel'} icon={ShieldCheck} />
            <InfoRow label="Produtos em alerta" value={`${produtosCriticos} item(ns)`} icon={Activity} />
            <InfoRow label="Caixa aberto" value={caixaAberto ? 'Sim' : 'Não'} icon={Wallet} />
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--vistta-border)] bg-[var(--vistta-surface)] p-5 shadow-[0_10px_35px_rgba(48,32,77,.05)]">
          <h2 className="font-display text-lg font-bold">Segurança da ótica</h2>
          <div className="mt-4 space-y-3">
            <InfoRow label="Autenticação" value="Firebase Auth" icon={ShieldCheck} />
            <InfoRow label="Dados" value="Realtime Database" icon={ShieldCheck} />
            <InfoRow label="Permissões" value="Por função" icon={ShieldCheck} />
            <InfoRow label="Arquitetura" value="Única loja" icon={ShieldCheck} />
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string | number; detail: string; icon: React.ElementType }) {
  return (
    <div className="rounded-3xl border border-[var(--vistta-border)] bg-[var(--vistta-surface)] p-5 shadow-[0_10px_35px_rgba(48,32,77,.05)]">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--vistta-lavender)] text-[var(--vistta-violet)]"><Icon size={19} /></span>
        <span className="h-2 w-2 rounded-full bg-[var(--vistta-lime)]" />
      </div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--vistta-secondary)]">{label}</p>
      <strong className="mt-1 block font-display text-2xl">{value}</strong>
      <p className="mt-1 text-xs text-[var(--vistta-secondary)]">{detail}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--vistta-border)] py-3 last:border-0">
      <span className="flex items-center gap-2 text-sm font-semibold"><Icon size={16} className="text-emerald-500" />{label}</span>
      <span className="text-right text-xs text-[var(--vistta-secondary)]">{value}</span>
    </div>
  );
}
