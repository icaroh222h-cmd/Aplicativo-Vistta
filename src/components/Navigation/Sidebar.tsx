import React, { useState } from 'react';
import { Home, Wallet, ShoppingCart, FileText, Boxes, Users, Tags, TrendingUp, ArrowRightLeft, UserPlus, LogOut, CircleHelp, Shield } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CreatorLogo, LogoVistta } from '../SharedUI';
import { Orcamento } from '../../types';

function SidebarItem({ icon: Icon, label, active, onClick, badge, badgeColor, collapsed }: any) {
  return (
    <button onClick={onClick} title={collapsed ? label : undefined} className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-4'} py-3 rounded-2xl transition-all ${active ? 'bg-white text-[#30204d] font-bold shadow-[0_8px_20px_rgba(0,0,0,.12)]' : 'text-white/60 hover:bg-white/10 hover:text-white font-medium'}`}>
      <div className="flex items-center"><Icon size={19} className={`${collapsed ? '' : 'mr-3'} ${active ? 'text-[#6d4aff]' : 'text-white/50'}`} />{!collapsed && label}</div>
      {!collapsed && badge && <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${badgeColor}`}>{badge}</span>}
    </button>
  );
}

function SidebarCategory({ label }: { label: string }) {
  return <div className="px-4 py-2 mt-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>;
}

export function Sidebar() {
  const { activeTab, setActiveTab, caixaAberto, orcamentos, userRole, dadosEmpresa, user, logout } = useAppContext();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`hidden md:flex flex-col ${collapsed ? 'w-[88px]' : 'w-[270px]'} bg-[#30204d] text-white z-20 transition-all duration-300 shadow-[12px_0_35px_rgba(48,32,77,.08)]`}>
      <div className={`h-[100px] flex items-center ${collapsed ? 'justify-center px-3' : 'px-6'} flex-shrink-0`}>
        <div className="flex items-center min-w-0">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-[#080a12] p-1 text-white"><LogoVistta className="h-full w-full" solidWhite={false} /></div>
          {!collapsed && <div className="ml-3 min-w-0"><div className="font-display font-bold tracking-[.18em] text-[17px]">VISTTA</div><div className="text-[10px] text-white/45 truncate mt-1" title={dadosEmpresa?.nome}>{dadosEmpresa?.nome || 'Minha Ótica'}</div></div>}
        </div>
      </div>
      <button onClick={() => setCollapsed(!collapsed)} className="absolute top-[72px] -right-3 h-6 w-6 rounded-full bg-[#c6ed76] text-[#30204d] text-xs font-bold shadow-lg">{collapsed ? '›' : '‹'}</button>

      <div className={`flex-1 overflow-y-auto py-6 ${collapsed ? 'px-3' : 'px-4'} space-y-1 custom-scrollbar`}>
        <SidebarItem icon={Home} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} collapsed={collapsed} />

        <SidebarCategory label="Operação" />
        <SidebarItem icon={Wallet} label="Caixa Diário" active={activeTab === 'caixa'} onClick={() => setActiveTab('caixa')} badge={caixaAberto ? 'Aberto' : 'Fechado'} badgeColor={caixaAberto ? 'bg-[#c6ed76] text-[#30204d]' : 'bg-white/10 text-white/50'} collapsed={collapsed} />
        <SidebarItem icon={ShoppingCart} label="PDV" active={activeTab === 'vendas'} onClick={() => setActiveTab('vendas')} collapsed={collapsed} />
        <SidebarItem icon={FileText} label="Orçamentos" active={activeTab === 'orcamentos'} onClick={() => setActiveTab('orcamentos')} badge={orcamentos.filter((o: Orcamento) => o.status === 'pendente').length || null} badgeColor="bg-[#f4c96b] text-[#30204d]" collapsed={collapsed} />
        <SidebarItem icon={FileText} label="Ordens de Serviço" active={activeTab === 'ordens'} onClick={() => setActiveTab('ordens')} collapsed={collapsed} />

        <SidebarCategory label="Cadastros" />
        <SidebarItem icon={Boxes} label="Estoque" active={activeTab === 'estoque'} onClick={() => setActiveTab('estoque')} collapsed={collapsed} />
        <SidebarItem icon={Users} label="Clientes" active={activeTab === 'clientes'} onClick={() => setActiveTab('clientes')} collapsed={collapsed} />
        <SidebarItem icon={Tags} label="Categorias" active={activeTab === 'categorias'} onClick={() => setActiveTab('categorias')} collapsed={collapsed} />

        {userRole === 'admin' && (
          <>
            <SidebarCategory label="Gestão (Admin)" />
            <SidebarItem icon={TrendingUp} label="Financeiro" active={activeTab === 'financeiro'} onClick={() => setActiveTab('financeiro')} collapsed={collapsed} />
            <SidebarItem icon={ArrowRightLeft} label="Contas" active={activeTab === 'contas'} onClick={() => setActiveTab('contas')} collapsed={collapsed} />
            <SidebarItem icon={UserPlus} label="Usuários" active={activeTab === 'usuarios'} onClick={() => setActiveTab('usuarios')} collapsed={collapsed} />
          </>
        )}
        <SidebarCategory label="Suporte" />
        <SidebarItem icon={CircleHelp} label="Ajuda e Treinamento" active={activeTab === 'ajuda'} onClick={() => setActiveTab('ajuda')} collapsed={collapsed} />
      </div>
      {!collapsed && <a href="https://www.instagram.com/aaxxis7?stkn=MWsxMXo2cWRsdDN6cw==" target="_blank" rel="noreferrer" aria-label="Visitar o Instagram da AXXIS7, empresa desenvolvedora da VISTTA" className="mx-4 mb-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5 text-left transition-colors hover:bg-white/10">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#080a12] p-1"><CreatorLogo className="h-full w-full" solidWhite={false} /></span>
        <span className="min-w-0"><strong className="block text-xs tracking-[.12em] text-white">AXXIS7</strong><small className="block truncate text-[10px] text-white/45">Desenvolvedora da VISTTA</small></span>
      </a>}
      <div className={`p-4 border-t border-white/10 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <div className="flex items-center min-w-0">
          <div className="w-10 h-10 rounded-full bg-[#c6ed76] text-[#30204d] flex items-center justify-center font-bold mr-3 shrink-0">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          {!collapsed && <div className="min-w-0"><div className="text-sm font-bold truncate text-white">{user?.email?.split('@')[0] || 'Usuário'}</div><div className="text-[10px] text-white/45 font-bold uppercase">{userRole === 'admin' ? 'Administrador' : userRole === 'gerente' ? 'Gerente' : userRole === 'vendedor' ? 'Vendedor' : 'Usuário'}</div></div>}
        </div>
        {!collapsed && <button onClick={() => logout().catch((error) => console.error('Não foi possível sair:', error))} className="text-white/45 hover:text-[#f4c96b]" title="Sair"><LogOut size={18} /></button>}
      </div>
    </aside>
  );
}
