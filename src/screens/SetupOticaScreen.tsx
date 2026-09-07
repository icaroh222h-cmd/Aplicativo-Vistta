import React, { useState } from 'react';
import { ArrowRight, BarChart3, Boxes, Building2, Check, CircleHelp, ShieldCheck, ShoppingCart, Users } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { FeedbackAlert, LogoVistta } from '../components/SharedUI';

export function SetupOticaScreen() {
  const { configurarOtica } = useAppContext();
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nomeNormalizado = nome.trim();
    if (!nomeNormalizado) {
      setErro('Informe o nome da sua ótica.');
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      await configurarOtica(nomeNormalizado);
    } catch (error: any) {
      if (error?.code === 'NETWORK_ERROR' || error?.code === 'network-request-failed') {
        setErro('Não foi possível conectar ao Firebase. Verifique sua conexão e tente novamente.');
      } else {
        setErro(error?.message || 'Não foi possível salvar os dados da ótica.');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="vistta-shell vistta-grid min-h-[100dvh] overflow-y-auto px-4 py-5 text-[var(--vistta-ink)] sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-[1180px] flex-col">
        <header className="flex items-center justify-between border-b border-[var(--vistta-border)] pb-5">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-[#080a12] p-1"><LogoVistta className="h-full w-full" /></span><div><div className="font-display text-base font-bold tracking-[.18em]">VISTTA</div><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--vistta-secondary)]">Gestão para óticas</p></div></div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--vistta-secondary)]"><CircleHelp size={16} /><span className="hidden sm:inline">Precisa de ajuda?</span></div>
        </header>

        <div className="flex flex-1 items-center py-8 sm:py-12">
          <div className="grid w-full gap-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
            <section className="flex flex-col justify-center">
              <div className="mb-7 flex items-center gap-3 text-xs font-bold uppercase tracking-[.18em] text-[var(--vistta-violet)]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--vistta-lavender)]"><Building2 size={18} /></span> Etapa 01 / 03</div>
              <h1 className="max-w-xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">Dê um nome ao seu centro de operação.</h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-[var(--vistta-secondary)]">Esse é o primeiro registro do seu ambiente VISTTA. Ele aparecerá no painel, nos documentos e nos acessos da sua equipe.</p>
              <div className="mt-9 grid max-w-lg grid-cols-3 gap-2 border-t border-[var(--vistta-border)] pt-5 sm:gap-5">
                {[[ShoppingCart, 'Vendas'], [Boxes, 'Estoque'], [BarChart3, 'Resultado']].map(([Icon, label]) => <div key={label as string} className="flex items-center gap-2 text-xs font-bold text-[var(--vistta-secondary)]"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--vistta-surface)] text-[var(--vistta-violet)] shadow-sm"><Icon size={15} /></span>{label as string}</div>)}
              </div>
            </section>

            <section className="rounded-[28px] border border-[var(--vistta-border)] bg-[var(--vistta-surface)] p-5 shadow-[0_24px_70px_rgba(48,32,77,.1)] sm:p-8">
              <div className="mb-8 flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[var(--vistta-violet)]">Perfil da operação</p><h2 className="mt-2 font-display text-2xl font-bold">Configure sua ótica</h2></div><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#c6ed76] text-[var(--vistta-plum)]"><ShieldCheck size={22} /></div></div>
              <form onSubmit={submit} className="space-y-5">
                <div><label htmlFor="nome-otica" className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-[var(--vistta-secondary)]">Nome comercial</label><input id="nome-otica" autoFocus required value={nome} onChange={event => { setNome(event.target.value); if (erro) setErro(''); }} placeholder="Ex.: Ótica Vistta Centro" className="w-full rounded-2xl border border-[var(--vistta-border)] bg-[var(--vistta-muted-surface)] px-4 py-4 text-[15px] text-[var(--vistta-ink)] outline-none transition-all placeholder:text-[var(--vistta-secondary)] focus:border-[var(--vistta-violet)] focus:ring-4 focus:ring-[rgba(109,74,255,.12)] dark:text-white" /></div>
                {erro && <FeedbackAlert>{erro}</FeedbackAlert>}
                <button type="submit" disabled={salvando} className="flex w-full items-center justify-between rounded-2xl bg-[var(--vistta-plum)] px-5 py-4 text-[15px] font-bold text-white shadow-[0_12px_24px_rgba(48,32,77,.18)] transition-all hover:bg-[var(--vistta-violet)] disabled:cursor-not-allowed disabled:opacity-60"><span>{salvando ? 'Salvando ambiente...' : 'Criar ambiente VISTTA'}</span>{!salvando && <ArrowRight size={19} />}</button>
              </form>
              <div className="mt-6 flex items-start gap-3 border-t border-[var(--vistta-border)] pt-5 text-xs leading-5 text-[var(--vistta-secondary)]"><Check size={16} className="mt-0.5 shrink-0 text-emerald-500" /><span>Você poderá alterar os dados e convidar sua equipe depois.</span></div>
            </section>
          </div>
        </div>
        <footer className="flex items-center justify-between border-t border-[var(--vistta-border)] pt-4 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--vistta-secondary)]"><span>Ambiente seguro</span><span className="hidden sm:inline">VISTTA / Setup inicial</span><span>2026</span></footer>
      </div>
    </div>
  );
}
