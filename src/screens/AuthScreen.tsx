import React, { useEffect, useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, sendPasswordResetEmail, verifyPasswordResetCode, confirmPasswordReset, User } from 'firebase/auth';
import { ref, update, get } from 'firebase/database';
import { auth, db } from '../config/firebase';
import { Mail, Lock, EyeOff, Eye, Store, Package, BarChart3, ShieldCheck, Instagram, Linkedin, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { CreatorLogo, FeedbackAlert, LogoVistta, ModalBase } from '../components/SharedUI';

export function AuthScreen() {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'recover' | 'reset'>('login');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [legalDocument, setLegalDocument] = useState<'terms' | 'privacy' | null>(null);
  const [resetFeedback, setResetFeedback] = useState('');
  const [accountExists, setAccountExists] = useState(false);
  const [resetCode, setResetCode] = useState('');

  const createGoogleProfile = async (googleUser: User) => {
    const userRef = ref(db, `users/${googleUser.uid}`);
    const snapshot = await get(userRef);
    if (!snapshot.exists()) {
      await update(userRef, { role: 'admin', status: 'active', email: googleUser.email || '', nome: googleUser.displayName || '', createdAt: new Date().toISOString() });
    }
  };

  useEffect(() => {
    let ativo = true;
    const processarRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (!result || !ativo) return;
        setIsLoggingIn(true);
        await createGoogleProfile(result.user);
      } catch (error: any) {
        if (ativo) setAuthError(getGoogleErrorMessage(error));
      } finally {
        if (ativo) setIsLoggingIn(false);
      }
    };
    void processarRedirect();
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const code = params.get('oobCode');
    if (mode !== 'resetPassword' || !code) return;
    setAuthMode('reset');
    setResetCode(code);
    verifyPasswordResetCode(auth, code).then(email => {
      setAuthEmail(email);
    }).catch(() => {
      setAuthError('Este link de recuperação expirou ou é inválido. Solicite um novo link.');
      setResetCode('');
    });
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setResetFeedback('');
    setAccountExists(false);
    setIsLoggingIn(true);
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword);
      } else if (authMode === 'register') {
        if (!authEmail.trim()) throw new Error('Informe seu e-mail.');
        if (authPassword.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
        if (authPassword !== authConfirmPassword) throw new Error('As senhas não coincidem.');
        if (!acceptedTerms) throw new Error('Aceite os Termos de Uso e a Política de Privacidade para continuar.');
        const userCred = await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        try {
          await update(ref(db, `users/${userCred.user.uid}`), {
            role: 'admin',
            status: 'active',
            email: authEmail.trim().toLowerCase(),
            nome: ''
          });
        } catch (dbErr: any) {
          await userCred.user.delete();
          if (dbErr?.code === 'PERMISSION_DENIED' || dbErr?.code === 'database/permission-denied') {
            throw new Error('O Firebase recusou o perfil inicial. Verifique se as regras do Realtime Database estão publicadas no projeto correto.');
          }
          throw new Error(dbErr?.message || 'Não foi possível concluir o cadastro. Tente novamente.');
        }
      }
    } catch (error: any) {
      if (error?.code === 'auth/email-already-in-use') {
        setAccountExists(true);
        setAuthError('Este e-mail já possui uma conta. Entre com sua conta existente ou recupere sua senha.');
      } else if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password' || error?.code === 'auth/user-not-found') {
        setAuthError('Não foi possível entrar. Verifique suas credenciais e tente novamente.');
      } else if (error?.code === 'auth/invalid-email') {
        setAuthError('Informe um e-mail válido.');
      } else if (error?.code === 'auth/network-request-failed') {
        setAuthError('Não foi possível concluir a operação. Verifique sua conexão e tente novamente.');
      } else {
        setAuthError(error?.message || (authMode === 'login' ? 'Não foi possível entrar. Tente novamente.' : 'Não foi possível criar sua conta. Tente novamente.'));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      await createGoogleProfile(result.user);
    } catch (error: any) {
      if (error?.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError: any) {
          setAuthError(getGoogleErrorMessage(redirectError));
        }
      } else {
        setAuthError(getGoogleErrorMessage(error));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePasswordReset = async () => {
    const email = authEmail.trim();
    if (!email) {
      setAuthError('Informe um e-mail válido para receber o link de recuperação.');
      return;
    }
    setAuthError('');
    setResetFeedback('');
    setIsLoggingIn(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetFeedback('Se houver uma conta associada a este e-mail, enviaremos as instruções para recuperação. Verifique também a pasta de spam.');
    } catch (error: any) {
      setResetFeedback(error?.code === 'auth/network-request-failed'
        ? 'Não foi possível concluir a operação. Verifique sua conexão e tente novamente.'
        : 'Se houver uma conta associada a este e-mail, enviaremos as instruções para recuperação. Verifique também a pasta de spam.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetCode) {
      setAuthError('Este link de recuperação expirou ou é inválido. Solicite um novo link.');
      return;
    }
    if (authPassword.length < 6) {
      setAuthError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (authPassword !== authConfirmPassword) {
      setAuthError('As senhas não coincidem.');
      return;
    }
    setAuthError('');
    setIsLoggingIn(true);
    try {
      await confirmPasswordReset(auth, resetCode, authPassword);
      window.history.replaceState({}, document.title, window.location.pathname);
      setResetCode('');
      setAuthPassword('');
      setAuthConfirmPassword('');
      setAuthMode('login');
      setResetFeedback('Senha redefinida com sucesso. Entre com sua nova senha.');
    } catch (error: any) {
      setAuthError(error?.code === 'auth/expired-action-code' || error?.code === 'auth/invalid-action-code'
        ? 'Este link de recuperação expirou ou já foi utilizado. Solicite um novo link.'
        : 'Não foi possível redefinir a senha. Tente solicitar um novo link.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const openMode = (mode: 'login' | 'register' | 'recover' | 'reset') => {
    setAuthMode(mode);
    setAuthError('');
    setResetFeedback('');
    setAccountExists(false);
    setAuthPassword('');
    setAuthConfirmPassword('');
  };

  function getGoogleErrorMessage(error: any) {
    const errorMessage = String(error?.message || '').toLowerCase();
    if (error?.code === 'auth/unauthorized-domain') {
      return `Domínio não autorizado: ${window.location.hostname}. No Firebase Console, abra Authentication > Settings > Authorized domains e adicione este domínio.`;
    }
    if (error?.code === 'auth/invalid-api-key' || errorMessage.includes('api_key_http_referrer_blocked') || errorMessage.includes('requests from referer')) {
      return 'A API key do Firebase bloqueou este domínio. No Google Cloud Console, abra APIs e serviços > Credenciais, edite a chave do projeto vistta-2e1df e autorize o domínio atual. Depois, publique o build novamente.';
    }
    if (error?.code === 'auth/popup-blocked') return 'O pop-up foi bloqueado. O login será redirecionado.';
    if (error?.code === 'auth/popup-closed-by-user') return 'O login do Google foi cancelado.';
    if (error?.code === 'auth/operation-not-allowed') return 'O provedor Google não está ativado no Firebase Authentication.';
    if (error?.code === 'auth/account-exists-with-different-credential') return 'Este e-mail já está vinculado a outro método de acesso. Entre usando o método original ou recupere sua senha.';
    if (error?.code === 'auth/network-request-failed') return 'Não foi possível concluir a operação. Verifique sua conexão e tente novamente.';
    return 'Não foi possível entrar com Google. Tente novamente.';
  }

  return (
    <div className="flex min-h-[100dvh] w-full bg-[#fbfaf8] dark:bg-[#171124] text-slate-900 dark:text-white font-sans overflow-hidden">
      {/* Painel Esquerdo (VISTTA) */}
      <div className="hidden lg:flex w-[55%] min-w-0 flex-col items-center justify-start bg-[#110d2b] p-8 pt-12 xl:p-12 xl:pt-20 text-white relative overflow-y-auto custom-scrollbar">
        <div className="absolute inset-0 opacity-35" style={{ backgroundImage: 'radial-gradient(circle at 20% 15%, rgba(109,74,255,.34), transparent 34%), radial-gradient(circle at 80% 80%, rgba(61,29,132,.3), transparent 38%), linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)', backgroundSize: '100% 100%, 100% 100%, 40px 40px, 40px 40px' }} />
        <div className="absolute -right-20 top-1/4 h-80 w-80 rounded-full border border-white/10"></div>
        <div className="absolute right-8 top-1/3 h-48 w-48 rounded-full border border-[#9c4cff]/25"></div>

        <div className="relative z-10 flex w-full max-w-2xl flex-col">
          <div className="mb-12 flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-[#080a12] p-1.5"><LogoVistta className="h-full w-full" solidWhite={false} /></span>
            <div><h1 className="font-display text-[34px] font-bold tracking-[.2em] leading-none text-white xl:text-[40px]">VISTTA</h1><p className="mt-3 text-[9px] font-semibold uppercase tracking-[.28em] text-[#b99cff] xl:text-[10px] xl:tracking-[.32em]">Gestão inteligente para óticas</p></div>
          </div>

          <div className="mb-10 max-w-xl">
            <h2 className="font-display text-[34px] font-bold leading-[1.08] tracking-tight text-white xl:text-[42px]">Mais controle.<br /><span className="text-[#b879ff]">Melhores resultados.</span></h2>
            <div className="mt-5 h-[2px] w-12 bg-[#9c4cff]"></div>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/65">A plataforma completa para otimizar a gestão da sua ótica e crescer com eficiência.</p>
          </div>

          <div className="grid grid-cols-3 gap-3 xl:gap-6">
            {[[Store, 'Gestão multi-loja', 'Centralize e gerencie todas as suas lojas.'], [Package, 'Estoque em tempo real', 'Acompanhe cada produto com precisão instantânea.'], [BarChart3, 'Relatórios inteligentes', 'Insights claros para decisões mais estratégicas.']].map(([Icon, title, description]) => <div key={title as string} className="max-w-[170px]"><Icon size={29} className="mb-4 text-[#914dff]" /><h3 className="mb-2 text-[13px] font-bold text-white">{title as string}</h3><p className="text-[11px] leading-relaxed text-white/55">{description as string}</p></div>)}
          </div>

          <div className="mt-9 inline-flex w-fit items-center gap-3 rounded-xl border border-[#9c4cff]/30 bg-[#6d4aff]/10 px-4 py-3 text-[12px] font-semibold text-[#caa5ff]"><ShieldCheck size={20} /> Seguro, rápido e feito para óticas.</div>

          <div className="mt-5 max-w-md rounded-2xl border border-white/10 bg-white/[0.055] p-5 backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#b879ff]">Dentro do VISTTA</p>
            <h3 className="mt-1 font-display text-lg font-bold text-white">Tudo o que sua ótica precisa em um só lugar</h3>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 pt-4 text-[10px] text-white/65">
              <span className="flex items-start gap-1.5"><CheckCircle2 size={12} className="mt-0.5 shrink-0 text-[#c6ed76]" /><span><strong className="block font-semibold text-white/85">Vendas e PDV</strong>Atendimento mais ágil</span></span>
              <span className="flex items-start gap-1.5"><CheckCircle2 size={12} className="mt-0.5 shrink-0 text-[#c6ed76]" /><span><strong className="block font-semibold text-white/85">Estoque</strong>Produtos sempre organizados</span></span>
              <span className="flex items-start gap-1.5"><CheckCircle2 size={12} className="mt-0.5 shrink-0 text-[#c6ed76]" /><span><strong className="block font-semibold text-white/85">Clientes e OS</strong>Histórico e serviços</span></span>
              <span className="flex items-start gap-1.5"><CheckCircle2 size={12} className="mt-0.5 shrink-0 text-[#c6ed76]" /><span><strong className="block font-semibold text-white/85">Financeiro</strong>Controle e resultados</span></span>
            </div>
          </div>

          <div className="mt-5 max-w-md rounded-2xl border border-[#9c4cff]/20 bg-[#6d4aff]/[0.07] p-5">
            <div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#b879ff]">Uma rotina mais inteligente</p><h3 className="mt-1 font-display text-base font-bold text-white">Da operação à decisão</h3></div><span className="rounded-full border border-[#c6ed76]/30 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#c6ed76]">VISTTA</span></div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
              <div><span className="mb-2 block font-display text-xl font-bold text-[#b879ff]">01</span><strong className="block text-[10px] text-white/85">Centralize</strong><p className="mt-1 text-[9px] leading-relaxed text-white/50">Reúna os dados da ótica.</p></div>
              <div><span className="mb-2 block font-display text-xl font-bold text-[#b879ff]">02</span><strong className="block text-[10px] text-white/85">Acompanhe</strong><p className="mt-1 text-[9px] leading-relaxed text-white/50">Tenha a operação sob controle.</p></div>
              <div><span className="mb-2 block font-display text-xl font-bold text-[#b879ff]">03</span><strong className="block text-[10px] text-white/85">Decida</strong><p className="mt-1 text-[9px] leading-relaxed text-white/50">Use informações para crescer.</p></div>
            </div>
          </div>
        </div>
         <a href="https://www.instagram.com/aaxxis7?stkn=MWsxMXo2cWRsdDN6cw==" target="_blank" rel="noreferrer" aria-label="Visitar o Instagram da AXXIS7, empresa desenvolvedora da VISTTA" className="relative z-10 mt-6 mb-2 flex self-start items-center gap-4 rounded-2xl border border-[#9c4cff]/25 bg-white/[0.06] px-5 py-4 transition-colors hover:border-[#9c4cff]/45 hover:bg-white/[0.1]">
           <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#080a12] p-1.5"><CreatorLogo className="h-full w-full" solidWhite={false} /></span>
           <span className="flex min-w-0 flex-col justify-center text-left"><small className="mb-0.5 block text-[8px] font-semibold uppercase tracking-[.2em] text-[#c6b0ff]">DESENVOLVIDO POR</small><strong className="block text-sm font-bold tracking-[.16em] text-white">AXXIS7</strong><small className="mt-0.5 block text-[10px] leading-tight text-white/55">empresa desenvolvedora da VISTTA</small></span>
         </a>
      </div>

      {/* Formulário Direito */}
      <div className="flex-1 lg:w-[45%] min-w-0 min-h-[100dvh] bg-[#0f0b24] dark:bg-[#0f0b24] flex flex-col items-center justify-start lg:justify-center px-4 pb-6 pt-8 sm:p-6 lg:p-8 relative overflow-y-auto custom-scrollbar">
        <div className="w-full max-w-[520px]">
          <div className="mb-7 flex flex-col items-center gap-3 text-center lg:hidden">
            <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-[#080a12] p-1.5 shadow-[0_10px_30px_rgba(109,74,255,.2)]"><LogoVistta className="h-full w-full" solidWhite={false} /></span>
            <div><div className="font-display text-xl font-bold tracking-[.2em] text-white">VISTTA</div><div className="mt-1 text-[8px] font-semibold uppercase tracking-[.2em] text-[#b879ff]">Gestão inteligente para óticas</div></div>
          </div>
          <div className="bg-white/[0.055] dark:bg-white/[0.055] rounded-[20px] sm:rounded-[28px] shadow-[0_24px_70px_rgba(0,0,0,.3)] border border-[#8d63ff]/30 p-5 sm:p-7 lg:p-8 mb-5 w-full backdrop-blur-md">
             <div className="text-center mb-6 sm:mb-8">
               <div className="inline-flex items-center gap-2 text-[#b879ff] text-[10px] font-bold uppercase tracking-[.18em] mb-4"><Lock size={13} /> Acesso seguro</div><h2 className="font-display text-2xl sm:text-[28px] font-bold mb-2 text-white">{authMode === 'login' ? 'Bem-vindo de volta!' : authMode === 'register' ? 'Crie sua conta' : authMode === 'recover' ? 'Recuperar senha' : 'Definir nova senha'}</h2>
               {authMode === 'login' && <p className="text-[14px] text-white/60">Acesse sua conta para continuar.</p>}
               {authMode === 'register' && <p className="text-[14px] text-white/60">Comece a gerenciar sua ótica de forma inteligente.</p>}
               {authMode === 'recover' && <p className="text-[14px] text-white/60">Digite seu e-mail para receber o link de recuperação.</p>}
               {authMode === 'reset' && <p className="text-[14px] text-white/60">Escolha uma nova senha para voltar a acessar sua conta.</p>}
             </div>
             
             <form onSubmit={authMode === 'recover' ? (event) => { event.preventDefault(); void handlePasswordReset(); } : authMode === 'reset' ? handlePasswordChange : handleAuth} className="space-y-4">
               {authError && <FeedbackAlert>{authError}</FeedbackAlert>}
               {resetFeedback && <FeedbackAlert type="success">{resetFeedback}</FeedbackAlert>}
               {accountExists && <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-[#6d4aff]"><button type="button" onClick={() => openMode('login')} className="hover:underline">Entrar</button><button type="button" onClick={() => openMode('recover')} className="hover:underline">Esqueci minha senha</button></div>}
               
               <div>
                 <label className="block text-[11px] font-bold text-white/55 uppercase tracking-wider mb-2">E-mail</label>
                 <div className="relative">
                   <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                   <input type="email" required readOnly={authMode === 'reset'} autoComplete="email" value={authEmail} onChange={e => { setAuthEmail(e.target.value); setAuthError(''); setResetFeedback(''); }} className="w-full bg-white/[0.06] border border-white/10 text-white placeholder:text-white/35 rounded-xl pl-12 pr-4 py-3.5 outline-none focus:border-[#9c4cff] read-only:opacity-70" placeholder="Seu e-mail" aria-invalid={Boolean(authError)} />
                 </div>
               </div>

               {authMode !== 'recover' && <div>
                 <label className="block text-[11px] font-bold text-white/55 uppercase tracking-wider mb-2">Senha</label>
                 <div className="relative">
                   <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                   <input type={showPassword ? "text" : "password"} required autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-white/[0.06] border border-white/10 text-white placeholder:text-white/35 rounded-xl pl-12 pr-12 py-3.5 outline-none focus:border-[#9c4cff]" placeholder="Sua senha" />
                   <button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                     {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                   </button>
                 </div>
                   {authMode === 'login' && <button type="button" onClick={() => openMode('recover')} className="mt-2 text-xs font-semibold text-[#b879ff] hover:underline">Esqueci minha senha</button>}
               </div>}
               {(authMode === 'register' || authMode === 'reset') && <div>
                 <label className="block text-[11px] font-bold text-white/55 uppercase tracking-wider mb-2">Confirmar senha</label>
                 <div className="relative">
                   <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                   <input type={showPassword ? 'text' : 'password'} required autoComplete="new-password" value={authConfirmPassword} onChange={e => setAuthConfirmPassword(e.target.value)} className="w-full bg-white/[0.06] border border-white/10 text-white placeholder:text-white/35 rounded-xl pl-12 pr-4 py-3.5 outline-none focus:border-[#9c4cff]" placeholder="Confirme sua senha" />
                 </div>
               </div>}

               {authMode === 'register' && <label className="flex items-start gap-2 text-[13px] text-white/55">
                 <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#6d4aff]" />
                 <span>Aceito os <button type="button" onClick={() => setLegalDocument('terms')} className="font-semibold text-[#6d4aff] hover:underline">Termos de Uso</button> e a <button type="button" onClick={() => setLegalDocument('privacy')} className="font-semibold text-[#6d4aff] hover:underline">Política de Privacidade</button>.</span>
               </label>}

               <button type="submit" disabled={isLoggingIn} className="w-full bg-[#6d4aff] hover:bg-[#5637e8] text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 mt-4 transition-colors shadow-[0_10px_22px_rgba(109,74,255,.2)]">
                 {isLoggingIn ? (authMode === 'recover' ? 'Enviando...' : authMode === 'reset' ? 'Salvando...' : authMode === 'login' ? 'Entrando...' : 'Criando conta...') : (authMode === 'login' ? 'Entrar' : authMode === 'register' ? 'Criar minha conta' : authMode === 'recover' ? 'Enviar link de recuperação' : 'Salvar nova senha')}
               </button>

               {(authMode === 'login' || authMode === 'register') && <>
               <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-white/15"></div><span className="text-xs font-medium text-white/45">ou</span><div className="h-px flex-1 bg-white/15"></div></div>

                 <button type="button" onClick={handleGoogleLogin} disabled={isLoggingIn} className="w-full border border-white/10 bg-white/[0.06] py-3.5 rounded-xl font-bold flex items-center justify-center gap-3 mt-4 text-white/85 hover:bg-white/10 disabled:opacity-60 transition-colors">
                 <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                   <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                   <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                   <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                   <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                 </svg>
                 Continuar com Google
               </button>
               </>}
               
               <div className="text-center mt-6">
                 <button type="button" onClick={() => openMode(authMode === 'login' ? 'register' : 'login')} className="text-sm font-bold text-[#6d4aff] hover:underline">
                   {authMode === 'login' ? 'Ainda não tenho conta? Criar conta' : authMode === 'register' ? 'Já tenho uma conta? Entrar' : 'Voltar para entrar'}
                 </button>
               </div>
             </form>
          </div>
          <LoginFooter onLegalOpen={setLegalDocument} />
          <LegalDocumentModal document={legalDocument} onClose={() => setLegalDocument(null)} />
        </div>
      </div>
    </div>
  );
}

function LoginFooter({ onLegalOpen }: { onLegalOpen: (document: 'terms' | 'privacy') => void }) {
  const supportEmail = 'mailto:icaroprojetos7@gmail.com?subject=Suporte%20VISTTA&body=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20o%20VISTTA.%0A%0ADescreva%20sua%20d%C3%BAvida%20ou%20problema%3A';
  const instagramUrl = 'https://www.instagram.com/aaxxis7/';
  const linkedinUrl = 'https://www.linkedin.com/in/7icaaro';

  return (
    <footer className="w-full pb-2 text-[9px] text-white/55 sm:pb-4 sm:text-[10px]">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-t border-white/15 pt-5 sm:gap-x-5 sm:gap-y-7 sm:pt-6">
        <div>
          <h3 className="mb-2 min-h-4 text-[10px] font-bold text-white">Navegação</h3>
          <div className="space-y-1.5 sm:space-y-2.5"><span className="block"><strong className="font-medium text-white/75">Dashboard</strong><small className="hidden text-[9px] text-white/45 sm:block">Visão geral da ótica</small></span><span className="block"><strong className="font-medium text-white/75">Caixa diário</strong><small className="hidden text-[9px] text-white/45 sm:block">Abertura e fechamento</small></span><span className="block"><strong className="font-medium text-white/75">Clientes e estoque</strong><small className="hidden text-[9px] text-white/45 sm:block">Cadastros e inventário</small></span><a href={supportEmail} className="block hover:text-[#b879ff]">Fale conosco</a></div>
        </div>
        <div>
          <h3 className="mb-2 min-h-4 text-[10px] font-bold text-white">Legal</h3>
          <div className="space-y-1.5 sm:space-y-2.5"><button type="button" onClick={() => onLegalOpen('terms')} className="block text-left hover:text-[#6d4aff]"><strong className="font-medium">Termos de uso</strong><small className="hidden text-[9px] text-slate-400 sm:block">Regras da plataforma</small></button><button type="button" onClick={() => onLegalOpen('privacy')} className="block text-left hover:text-[#6d4aff]"><strong className="font-medium">Política de privacidade</strong><small className="hidden text-[9px] text-slate-400 sm:block">Proteção dos seus dados</small></button><a href="mailto:icaroprojetos7@gmail.com?subject=Exclusão%20de%20conta" className="block hover:text-[#6d4aff]"><strong className="font-medium">Exclusão de conta</strong><small className="hidden text-[9px] text-slate-400 sm:block">Solicite pelo suporte</small></a></div>
        </div>
        <div>
          <h3 className="mb-2 min-h-4 text-[10px] font-bold text-white">Produto</h3>
          <div className="space-y-1.5 sm:space-y-2.5"><span className="block"><strong className="font-medium text-white/75">PDV e vendas</strong><small className="hidden text-[9px] text-white/45 sm:block">Venda com agilidade</small></span><span className="block"><strong className="font-medium text-white/75">Orçamentos e OS</strong><small className="hidden text-[9px] text-white/45 sm:block">Serviços sob controle</small></span><span className="block"><strong className="font-medium text-white/75">Financeiro e DRE</strong><small className="hidden text-[9px] text-white/45 sm:block">Resultados da operação</small></span></div>
        </div>
        <div>
          <h3 className="mb-2 min-h-4 text-[10px] font-bold text-white">Status e suporte</h3>
          <div className="mb-2 flex items-center gap-1.5 text-emerald-600 dark:text-[#c6ed76]"><CheckCircle2 size={12} /> Operacional</div>
          <p className="mb-2 hidden leading-relaxed sm:block">Dados sincronizados em tempo real</p>
          <div className="space-y-2">
            <a href={supportEmail} className="block hover:text-[#6d4aff]"><strong className="font-medium">Gmail</strong><small className="block break-all text-[9px] text-slate-400">icaroprojetos7@gmail.com</small></a>
            <a href={instagramUrl} target="_blank" rel="noreferrer" className="block hover:text-[#d62976]"><strong className="font-medium">Instagram</strong><small className="block text-[9px] text-slate-400">Acompanhe a AXXIS7</small></a>
            <a href={linkedinUrl} target="_blank" rel="noreferrer" className="block hover:text-[#0a66c2]"><strong className="font-medium">LinkedIn</strong><small className="block text-[9px] text-slate-400">Perfil profissional</small></a>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3 border-t border-[#e7e1ec] pt-4 dark:border-[#3d3154] sm:mt-7 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pt-5">
        <p className="max-w-[280px] leading-relaxed">© 2026 VISTTA. Sistema de gestão para óticas. Todos os direitos reservados.</p>
        <div className="flex items-center gap-2">
          <span className="mr-1 text-[10px] font-bold text-white">Fale com a AXXIS7</span>
          <a href={instagramUrl} target="_blank" rel="noreferrer" aria-label="Abrir Instagram da AXXIS7" title="Instagram da AXXIS7" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#d62976] text-white transition-transform hover:scale-105"><Instagram size={18} /></a>
          <a href={linkedinUrl} target="_blank" rel="noreferrer" aria-label="Abrir LinkedIn da AXXIS7" title="LinkedIn da AXXIS7" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0a66c2] text-white transition-transform hover:scale-105"><Linkedin size={18} /></a>
          <a href={supportEmail} aria-label="Enviar e-mail para o suporte" title="Enviar e-mail para o suporte" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#30204d] text-white transition-transform hover:scale-105"><ArrowUpRight size={18} /></a>
        </div>
      </div>
      <p className="mt-4 text-center text-[9px] text-slate-400">Desenvolvido e mantido por AXXIS7</p>
    </footer>
  );
}

function LegalDocumentModal({ document, onClose }: { document: 'terms' | 'privacy' | null; onClose: () => void }) {
  const isTerms = document === 'terms';

  return (
    <ModalBase open={Boolean(document)} onClose={onClose} title={isTerms ? 'Termos de uso' : 'Política de privacidade'} width="max-w-2xl">
      <div className="space-y-5 text-sm leading-6 text-slate-600 dark:text-slate-300">
        <p className="rounded-xl bg-[#f7f3ff] p-4 text-xs text-[#5a4a75] dark:bg-[#2d2544] dark:text-[#c7bce0]">Última atualização: 05 de setembro de 2026. Este conteúdo apresenta as condições gerais de uso da plataforma VISTTA, desenvolvida e mantida pela AXXIS7.</p>
        {isTerms ? <>
          <section><h3 className="mb-1 font-bold text-slate-900 dark:text-white">1. Uso da plataforma</h3><p>A VISTTA é um sistema de gestão para óticas. O acesso é destinado a usuários autorizados pela empresa responsável pela conta, que devem manter seus dados de acesso protegidos.</p></section>
          <section><h3 className="mb-1 font-bold text-slate-900 dark:text-white">2. Responsabilidades da conta</h3><p>A empresa usuária é responsável pelas informações cadastradas, pelos acessos concedidos à equipe e pela conferência dos registros operacionais, financeiros e de clientes.</p></section>
          <section><h3 className="mb-1 font-bold text-slate-900 dark:text-white">3. Uso adequado</h3><p>Não é permitido utilizar a plataforma para atividades ilícitas, tentar acessar dados de terceiros ou interferir na segurança, disponibilidade e funcionamento do serviço.</p></section>
          <section><h3 className="mb-1 font-bold text-slate-900 dark:text-white">4. Propriedade intelectual</h3><p>O sistema VISTTA, sua identidade, código, componentes e materiais são desenvolvidos e mantidos pela AXXIS7. A licença de uso não transfere propriedade sobre a plataforma.</p></section>
        </> : <>
          <section><h3 className="mb-1 font-bold text-slate-900 dark:text-white">1. Dados tratados</h3><p>A plataforma pode armazenar dados da ótica, usuários, clientes, produtos, vendas, orçamentos, ordens de serviço e informações financeiras inseridas durante a operação.</p></section>
          <section><h3 className="mb-1 font-bold text-slate-900 dark:text-white">2. Finalidade</h3><p>Os dados são utilizados para autenticar usuários, executar as funcionalidades do sistema, manter registros da operação e oferecer suporte técnico.</p></section>
          <section><h3 className="mb-1 font-bold text-slate-900 dark:text-white">3. Segurança e acesso</h3><p>O acesso é controlado por autenticação e permissões. A empresa usuária deve revisar seus usuários e comunicar qualquer suspeita de acesso indevido pelo canal de suporte.</p></section>
          <section><h3 className="mb-1 font-bold text-slate-900 dark:text-white">4. Solicitações</h3><p>Para solicitar informações, correções ou exclusão de conta, envie uma mensagem para <a className="font-semibold text-[#6d4aff] hover:underline" href="mailto:icaroprojetos7@gmail.com">icaroprojetos7@gmail.com</a> informando a ótica e o usuário responsável.</p></section>
        </>}
      </div>
    </ModalBase>
  );
}
