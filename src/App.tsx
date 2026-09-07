import React, { lazy, Suspense, useEffect, useState } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { Sidebar } from './components/Navigation/Sidebar';

import { Home, ShoppingCart, Boxes, Users, Menu, Moon, Sun, LogOut } from 'lucide-react';
import { LogoVistta } from './components/SharedUI';

const AuthScreen = lazy(() => import('./screens/AuthScreen').then(module => ({ default: module.AuthScreen })));
const DashboardScreen = lazy(() => import('./screens/DashboardScreen').then(module => ({ default: module.DashboardScreen })));
const PdvScreen = lazy(() => import('./screens/PdvScreen').then(module => ({ default: module.PdvScreen })));
const CaixaScreen = lazy(() => import('./screens/CaixaScreen').then(module => ({ default: module.CaixaScreen })));
const EstoqueScreen = lazy(() => import('./screens/EstoqueScreen').then(module => ({ default: module.EstoqueScreen })));
const ClientesScreen = lazy(() => import('./screens/ClientesScreen').then(module => ({ default: module.ClientesScreen })));
const OrcamentosScreen = lazy(() => import('./screens/OrcamentosScreen').then(module => ({ default: module.OrcamentosScreen })));
const FinanceiroScreen = lazy(() => import('./screens/FinanceiroScreen').then(module => ({ default: module.FinanceiroScreen })));
const CadastrosGenericosScreen = lazy(() => import('./screens/CadastrosGenericosScreen').then(module => ({ default: module.CadastrosGenericosScreen })));
const OrdensServicoScreen = lazy(() => import('./screens/OrdensServicoScreen').then(module => ({ default: module.OrdensServicoScreen })));
const HelpScreen = lazy(() => import('./screens/HelpScreen').then(module => ({ default: module.HelpScreen })));
const SetupOticaScreen = lazy(() => import('./screens/SetupOticaScreen').then(module => ({ default: module.SetupOticaScreen })));

function MainLayout() {
  const { activeTab, user, loadingAuth, setActiveTab, carrinho, dadosEmpresa, databaseError, logout } = useAppContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const dark = localStorage.getItem('otica_theme') === 'dark';
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('otica_theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', next);
  };

  if (loadingAuth) {
    return (
      <div className="vistta-loading flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#f5f6f4] dark:bg-[#171124]">
        <div className="vistta-loading-content flex flex-col items-center text-center">
          <div className="vistta-loading-mark relative flex h-32 w-32 items-center justify-center sm:h-40 sm:w-40">
            <span className="vistta-loading-ring vistta-loading-ring-one" />
            <span className="vistta-loading-ring vistta-loading-ring-two" />
            <span className="relative z-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#080a12] p-2 shadow-[0_0_28px_rgba(93,78,255,.22)] sm:h-24 sm:w-24"><LogoVistta className="h-full w-full" solidWhite={false} /></span>
          </div>
          <div className="mt-5 flex items-center gap-1.5" aria-label="Carregando">
            <span className="vistta-loading-dot" />
            <span className="vistta-loading-dot vistta-loading-dot-delay-one" />
            <span className="vistta-loading-dot vistta-loading-dot-delay-two" />
          </div>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[.28em] text-[#51607a] dark:text-[#b9afca]">Preparando seu ambiente</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Suspense fallback={<ScreenLoading />}><AuthScreen /></Suspense>;
  }

  if (!dadosEmpresa) {
    return <Suspense fallback={<ScreenLoading />}><SetupOticaScreen /></Suspense>;
  }

  return (
    <div className="flex min-h-[100dvh] h-[100dvh] w-full vistta-shell text-slate-900 dark:text-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative mobile-safe-bottom md:pb-0">
        {databaseError && <div className="absolute top-0 left-0 right-0 z-50 bg-rose-600 text-white px-4 py-2 text-center text-sm font-semibold">{databaseError}</div>}
        <button onClick={toggleTheme} aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'} aria-pressed={isDark} className="absolute top-4 right-4 z-40 w-10 h-10 rounded-full bg-white/80 dark:bg-slate-800 border border-[#e7e1ec] dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-[#6d4aff] shadow-sm backdrop-blur" title="Alternar tema">
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <main className="flex-1 overflow-y-auto p-4 pb-5 pt-16 sm:p-10 sm:pt-10 lg:p-12 relative z-10 custom-scrollbar h-full vistta-grid">
          <Suspense fallback={<ScreenLoading />}>
            {activeTab === 'dashboard' && <DashboardScreen />}
            {activeTab === 'vendas' && <PdvScreen />}
            {activeTab === 'caixa' && <CaixaScreen />}
            {activeTab === 'estoque' && <EstoqueScreen />}
            {activeTab === 'clientes' && <ClientesScreen />}
            {activeTab === 'orcamentos' && <OrcamentosScreen />}
            {activeTab === 'ordens' && <OrdensServicoScreen />}
            {activeTab === 'ajuda' && <HelpScreen />}
            {activeTab === 'financeiro' && <FinanceiroScreen />}
            {['fornecedores', 'contas', 'categorias', 'usuarios'].includes(activeTab) && (
              <CadastrosGenericosScreen activeTab={activeTab} />
            )}
          </Suspense>
        </main>
        <div className="mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex items-center z-[55]">
          <MobileNav icon={Home} label="Início" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <MobileNav icon={ShoppingCart} label="PDV" active={activeTab === 'vendas'} onClick={() => setActiveTab('vendas')} badge={carrinho.length} />
          <MobileNav icon={Boxes} label="Estoque" active={activeTab === 'estoque'} onClick={() => setActiveTab('estoque')} />
          <MobileNav icon={Users} label="Clientes" active={activeTab === 'clientes'} onClick={() => setActiveTab('clientes')} />
          <MobileNav icon={Menu} label="Menu" active={mobileMenuOpen} onClick={() => setMobileMenuOpen(!mobileMenuOpen)} />
        </div>
        {mobileMenuOpen && <div className="md:hidden fixed inset-0 z-[70] bg-slate-900/60" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-[80%] max-w-[300px] bg-white dark:bg-slate-800 shadow-2xl p-5" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <span className="font-bold truncate text-slate-900 dark:text-white">{dadosEmpresa?.nome || 'Minha Ótica'}</span>
              <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400">Fechar</button>
            </div>
            <div className="space-y-2">
              {['caixa', 'orcamentos', 'ordens', 'categorias', 'ajuda'].map(tab => (
                <button key={tab} onClick={() => { setActiveTab(tab); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700">
                  {tab === 'caixa' ? 'Caixa Diário' : tab === 'orcamentos' ? 'Orçamentos' : tab === 'ordens' ? 'Ordens de Serviço' : tab === 'categorias' ? 'Categorias' : 'Ajuda e Treinamento'}
                </button>
              ))}
            </div>
            <button onClick={() => logout().catch((error) => console.error('Não foi possível sair:', error))} className="mt-6 flex w-full items-center gap-3 border-t border-slate-100 px-4 pt-5 text-left font-bold text-rose-500 dark:border-slate-700"><LogOut size={18} /> Sair da conta</button>
          </div>
        </div>}
      </div>
    </div>
  );
}

function ScreenLoading() {
  return <div className="flex min-h-[240px] items-center justify-center text-sm font-semibold text-[var(--vistta-secondary)]">Carregando módulo...</div>;
}

function MobileNav({ icon: Icon, label, active, onClick, badge = 0 }: any) {
  return <button onClick={onClick} className={`flex-1 h-full flex flex-col items-center justify-center gap-1 text-[10px] relative ${active ? 'text-[var(--vistta-violet)] font-bold' : 'text-slate-400'}`}>
    <Icon size={22} />
    {badge > 0 && <span className="absolute top-1 right-3 bg-rose-500 text-white text-[10px] rounded-full px-1.5">{badge}</span>}
    <span>{label}</span>
  </button>;
}

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}