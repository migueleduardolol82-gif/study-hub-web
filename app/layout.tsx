import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/auth-config";
import "./globals.css";
import "@/components/shadcn-theme.css";
import "@/components/platform-flat.css";
import "@/components/loading-brand.css";
import "@/components/page-background.css";
import "@/components/home-metric-widget-board.css";
import "@/components/home-refinement.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mers — Central de Evolução",
  description:
    "Transcrição, mapeamento de conteúdo, sessões, metas e revisão ativa em um único espaço.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const content = isClerkConfigured() ? <ClerkProvider>{children}</ClerkProvider> : children;
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{content}</body>
    </html>
  );
}
