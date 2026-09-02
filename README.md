# Nexo — Ambiente Inteligente de Estudos

Aplicativo em Next.js que conecta vídeos, apostilas, metas, sessões de foco e revisão ativa.

## O que já funciona

- envio de vídeo ou áudio de até 250 MB e links públicos do Drive, Dropbox ou arquivo direto;
- normalização e divisão automática do áudio antes da transcrição em português pela OpenAI;
- leitura de apostilas em PDF diretamente no navegador, sem limite de envio da Vercel;
- mapa de conteúdo pessoal, começando vazio e definido pelo próprio aluno;
- cadastro de curso, objetivo, módulos, tópicos, referências e prioridades;
- comparação da aula somente com os tópicos escolhidos, identificando cobertura e lacunas;
- timer flip de 50 minutos e pausa de 10 minutos;
- metas persistidas no navegador;
- visual “black edition” com navegação responsiva;
- criação e alternância entre vários planos personalizados por prazo, frequência, duração e prioridades;
- geração de tópicos personalizados por IA a partir de um pedido livre;
- sistema Ascensão com avaliação inicial, níveis, XP, ranks e histórico de esforço;
- registro integrado de corrida, força, leitura, estudo, projetos e comunicação;
- seis atributos de desenvolvimento: Corpo, Intelecto, Disciplina, Comunicação, Capital e Liderança;
- quatro arquétipos de longo prazo, com requisitos, missões diárias e rotas de 3 a 6 anos;
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
4. Em **Storage**, crie um banco **Blob**. A Vercel adicionará `BLOB_READ_WRITE_TOKEN` automaticamente.
5. Clique em **Deploy**.

Depois da primeira conexão, cada atualização enviada para a branch `main` gera uma nova publicação automaticamente.

## Observações

- O arquivo enviado para transcrição pode ter até 250 MB. Arquivos locais acima de 4 MB exigem o Vercel Blob ativado.
- Links precisam ser públicos e apontar para um arquivo baixável. Plataformas com login, DRM e YouTube não são baixadas.
- A OpenAI recebe apenas partes de áudio normalizadas menores que 25 MB; o vídeo original não é enviado inteiro à OpenAI.
- A apostila pode ter até 40 MB e precisa conter texto pesquisável. PDFs apenas digitalizados precisam de OCR.
- O mapa pode analisar apenas a transcrição; a apostila passa a ser opcional quando as referências já foram cadastradas manualmente.
