import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary'

const requiredFirebaseVariables = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_DATABASE_URL',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
] as const;

const missingFirebaseVariables = requiredFirebaseVariables.filter((name) => !import.meta.env[name]?.trim());
const App = missingFirebaseVariables.length === 0 ? React.lazy(() => import('./App')) : null;

function MissingFirebaseConfig() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#f5f6f4] p-6 text-[#30204d]">
      <section className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-xl">
        <p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-[#6d4aff]">VISTTA ERP</p>
        <h1 className="mb-3 text-2xl font-bold">Configuração do Firebase pendente</h1>
        <p className="mb-6 text-sm leading-6 text-slate-600">
          O app foi carregado, mas as variáveis do Firebase ainda não foram cadastradas no ambiente de execução.
        </p>
        <div className="rounded-2xl bg-slate-50 p-4 text-left">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Variáveis ausentes</p>
          <ul className="space-y-1 font-mono text-xs text-rose-700">
            {missingFirebaseVariables.map((name) => <li key={name}>{name}</li>)}
          </ul>
        </div>
        <p className="mt-6 text-xs leading-5 text-slate-500">
          No Firebase Console, abra as configurações do projeto, adicione os valores do app Web Firebase e faça novo deploy do Hosting.
        </p>
      </section>
    </main>
  );
}

function AppLoading() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[#f5f6f4] text-sm font-semibold text-[#30204d]">Carregando VISTTA...</div>;
}

const savedTheme = localStorage.getItem('otica_theme')
document.documentElement.classList.toggle('dark', savedTheme === 'dark')

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      {App ? <Suspense fallback={<AppLoading />}><App /></Suspense> : <MissingFirebaseConfig />}
    </ErrorBoundary>
  </React.StrictMode>,
)
