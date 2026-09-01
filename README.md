# Nexo — Ambiente Inteligente de Estudos

Aplicativo em Next.js que conecta vídeos, apostilas, metas, sessões de foco e revisão ativa.

## O que já funciona

- envio de vídeo ou áudio e link público do Google Drive;
- transcrição em português pela OpenAI;
- leitura de apostilas em PDF;
- comparação entre a aula e a apostila, com tópicos cobertos, parciais e lacunas;
- timer flip de 50 minutos e pausa de 10 minutos;
- metas persistidas no navegador;
- quizzes e flashcards gerados a partir do material;
- tutor contextual conectado à aula, apostila e mapeamento;
- layout responsivo para computador e celular.

## Rodar no computador

```bash
npm install
cp .env.example .env.local
npm run dev
```

Adicione a chave em `OPENAI_API_KEY` no arquivo `.env.local`. Nunca envie esse arquivo ao GitHub.

## Publicar com GitHub e Vercel

1. Envie este projeto para o repositório `study-hub-web` no GitHub.
2. Na Vercel, escolha **Add New → Project** e importe o repositório.
3. Em **Environment Variables**, crie `OPENAI_API_KEY`.
4. Clique em **Deploy**.

Depois da primeira conexão, cada atualização enviada para a branch `main` gera uma nova publicação automaticamente.

## Observações

- O arquivo enviado para transcrição deve ter até 25 MB.
- O link do Google Drive precisa estar liberado como “qualquer pessoa com o link”.
- A apostila precisa conter texto pesquisável. PDFs apenas digitalizados precisam de OCR.
