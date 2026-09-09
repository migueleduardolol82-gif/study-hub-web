# Nexo — Ambiente Inteligente de Estudos

Aplicativo em Next.js que conecta vídeos, apostilas, metas, sessões de foco e revisão ativa.

## O que já funciona

- envio de vídeo ou áudio de até 250 MB e links públicos do Drive, Dropbox ou arquivo direto;
- normalização e divisão automática do áudio antes da transcrição em português pela OpenAI;
- biblioteca de fontes com PDF, DOCX, PPTX, TXT, JPG, JPEG e PNG, incluindo OCR de imagens e PDFs digitalizados;
- leitura integral em blocos com hash antirrepetição, prioridade, referência de página/slide/seção e retomada após falha;
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
- Revisão Ativa em trilha vertical, com Estudar, Memorizar, Speed Run, Hard Mode, Revisão, desafios e Caderno de Erros;
- layout mobile-first com navegação inferior e ações fixas nas atividades.

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
4. No Marketplace, conecte Clerk, Neon Postgres e Vercel Blob ao mesmo projeto. As integrações fornecem as chaves de autenticação, `DATABASE_URL` e `BLOB_READ_WRITE_TOKEN`.
5. Clique em **Deploy**.

Depois da primeira conexão, cada atualização enviada para a branch `main` gera uma nova publicação automaticamente.

## Observações

- O arquivo enviado para transcrição pode ter até 250 MB. Arquivos locais acima de 4 MB exigem o Vercel Blob ativado.
- Links precisam ser públicos e apontar para um arquivo baixável. Plataformas com login, DRM e YouTube não são baixadas.
- A OpenAI recebe apenas partes de áudio normalizadas menores que 25 MB; o vídeo original não é enviado inteiro à OpenAI.
- A biblioteca aceita até 12 arquivos por painel, com até 30 MB por arquivo. PDFs digitalizados e imagens usam OCR em português e inglês.
- O mapa pode analisar apenas a transcrição; a apostila passa a ser opcional quando as referências já foram cadastradas manualmente.


## Geração por etapas e ritmo de estudo

A Revisão Ativa primeiro gera e salva o planejamento das unidades. A primeira lição é preparada em outra chamada; as próximas são geradas ao abrir. Uma falha mantém o caminho e as lições anteriores, com tentativa novamente somente da etapa pendente. Cada lição é validada antes de ser salva. Trilhas antigas com exercícios já gerados continuam funcionando.

Os geradores de temas, tópicos, planos e tutor consideram disciplina, nível inicial, objetivo e fontes selecionadas. Temas são apresentados como rascunhos editáveis. Os planos com IA usam tarefas específicas e revisões distribuídas conforme a disponibilidade. Não há promessa de conhecimento atualizado sem fonte nem conteúdo fictício como fallback.

O timer está na Visão geral e em Estudos. Permite 1 a 1440 minutos, pausa e retomada; Pomodoro permite personalizar foco, pausa curta, pausa longa e quantidade de ciclos. Usa horário de término, evitando atraso de contagem em abas inativas. Cada etapa seguinte aguarda início manual, e só foco concluído recebe XP proporcional ao tempo. As configurações e o estado do cronômetro são salvos no painel de cada usuário, como os demais dados; sem nuvem configurada, permanecem no navegador.

Planos permitem duração livre por sessão, duração diferente por dia, Pomodoro, descanso, datas e reorganização dos atrasos sem alterar atividades concluídas. Novos campos são opcionais no JSONB existente; nenhuma tabela ou dado existente precisa ser apagado.

Os arquivos originais ficam em Blob privado. Metadados e partes extraídas ficam nas tabelas `nexo_documents` e `nexo_document_chunks`, sempre vinculadas ao usuário autenticado. Sem Clerk, Neon e Blob, o navegador mantém uma cópia local em IndexedDB e o restante do painel continua no `localStorage` versionado.

Validação: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:http`. A chave OpenAI precisa estar configurada no servidor de implantação para testar a geração real.
