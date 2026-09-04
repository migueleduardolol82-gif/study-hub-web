import { SignIn, SignUp } from "@clerk/nextjs";
import { LockKeyhole, Zap } from "lucide-react";
import Link from "next/link";

const clerkAppearance = {
  variables: {
    colorPrimary: "#d0ff65",
    colorBackground: "#111316",
    colorInputBackground: "#07080a",
    colorInputText: "#f5f6f2",
    colorText: "#f5f6f2",
    colorTextSecondary: "#969aa4",
    colorTextOnPrimaryBackground: "#050505",
    borderRadius: "0.75rem",
  },
};

export function AuthShell({ mode, configured }: { mode: "sign-in" | "sign-up"; configured: boolean }) {
  return (
    <main className="auth-page">
      <section className="auth-story">
        <span className="brand auth-brand"><span className="brand-mark"><Zap size={18} fill="currentColor" /></span>NEXO</span>
        <span className="eyebrow"><LockKeyhole size={14} /> PAINEL INDIVIDUAL</span>
        <h1>{mode === "sign-in" ? "Continue sua evolução." : "Crie seu espaço de evolução."}</h1>
        <p>Ranking, arquétipos, aulas, mapas, planos, metas e revisões ligados à sua conta e sincronizados entre dispositivos.</p>
        <div className="auth-points"><span>01 <strong>Dados separados por usuário</strong></span><span>02 <strong>Salvamento automático</strong></span><span>03 <strong>Rotas personalizadas com IA</strong></span></div>
      </section>
      <section className="auth-panel">
        {configured
          ? mode === "sign-in" ? <SignIn appearance={clerkAppearance} /> : <SignUp appearance={clerkAppearance} />
          : <div className="auth-not-configured"><LockKeyhole size={28} /><h2>Login aguardando configuração</h2><p>Adicione as chaves do Clerk nas variáveis de ambiente da Vercel. Até lá, o painel principal funciona em modo local.</p><Link href="/">Abrir painel local</Link></div>}
      </section>
    </main>
  );
}
