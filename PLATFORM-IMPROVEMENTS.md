# Revisão integral da plataforma

Objetivo: melhorar aparência, funcionalidades, ações e tratamento de erros em todas as áreas existentes.

## Áreas e critérios de conclusão

- Base compartilhada: carregamento, recuperação de erros, salvamento local/nuvem, navegação, pesquisa, teclado e layouts mobile/desktop.
- Visão geral e Hoje: estados vazios, metas, registros, timer, resumo e encaminhamento para ações reais.
- Jornadas e rotina: criar, editar, concluir, reabrir, excluir, recorrência e persistência.
- Estudos, mapas e temas: organizar conteúdo, referências, edição e geração com erros recuperáveis.
- Revisão ativa: criar trilha, iniciar e retomar sessão, responder, revisar erros, salvar progresso.
- Planos: criação manual/IA, calendário, atividades, conclusão e edição.
- Aulas e documentos: upload, extração, transcrição, reprodução e recuperação após falhas.
- Mentor: envio, espera, erros, contexto e leitura das respostas.
- Evolução, avaliação e avatar: registros, atributos, histórico e equipamentos.
- Perfil: identificação, estado real de sincronização, preferências e dados.

Cada área exige inspeção de código, fluxo real no navegador com dados locais/fixtures quando dependências externas não estão configuradas, revisão visual em 390 e 1280 px e testes relevantes. Testes com fixtures não comprovam integração real com provedores.

## Achados confirmados inicialmente

1. Falha de GET /api/user-data mantém cloudLoaded=false e a página em skeleton permanente. Não existe ação de tentar novamente.
2. Erro ao interpretar armazenamento local permite o efeito de autosave escrever os valores iniciais sobre a mesma chave.
3. Perfil mostra nome Miguel e iniciais ME fixos, independentemente da conta.
4. Estado de sincronização no perfil afirma conta sincronizada com base apenas na configuração, mesmo em falha.

## Andamento

Revisão iniciada. Nenhuma área considerada integralmente concluída ainda.

## Primeiro lote implementado

- Falha inicial de nuvem agora tem tela de recuperação, timeout de 15 segundos e nova tentativa. Nenhum PUT é enviado antes do GET bem-sucedido.
- JSON local ilegível bloqueia a sobrescrita automática. Banner persistente permite baixar as alterações da sessão; registros originais são preservados.
- Falha de escrita local fica visível com cópia exportável.
- Perfil e saudação não assumem identidade fixa e distinguem sincronização pendente, concluída e falha.
- Jornadas têm filtro de arquivadas e reativação, progresso atual editável, datas locais, controles rotulados e prazo não anterior ao início.
- Agenda de jornadas ignora pausadas/concluídas/arquivadas, permite visualizar ações concluídas e reabri-las.

Evidência: navegador conferiu criação, progresso, arquivamento, reativação e reload; JSON corrompido permaneceu intacto e backup foi baixado. Falha GET simulada em uma rota temporária que renderiza StudyHub com cloudEnabled: nova tentativa carregou o painel, sem PUT antecipado. Rota temporária removida após teste. Início, Estudar, Evolução, Mentor e Perfil conferidos a 390 e 1280 px, sem erros JS ou overflow horizontal.

Ainda pendentes: inspeção dos fluxos internos de todas as áreas, melhorias visuais gerais além dos estados de recuperação, navegação/pesquisa por entidade, concorrência no salvamento de nuvem, teste real de integrações externas quando configuradas.

## Segundo lote: design configurável, mentor e aulas

- O visual combina tipografia editorial grande, cartões modulares escuros, contraste forte e iluminação ambiente inspirados nas quatro referências fornecidas.
- Cinco paletas prontas: Nexo, Energia, Órbita, Precisão e Editorial. A pessoa também pode escolher qualquer cor de destaque.
- Página inicial configurável com widgets de Continuar, Hoje e metas, Evolução, Sessão de foco e Acessos rápidos. Widgets podem ser adicionados, removidos e reordenados.
- Preferências de aparência fazem parte do mesmo estado local/nuvem e dados antigos recebem os padrões de forma aditiva.
- Mentor agora separa falhas das respostas, preserva o rascunho novo e repete a pergunta original com o contexto original sem duplicá-la no histórico.
- Aulas interrompidas após reload não ficam eternamente como “processando”. Se houver transcrição salva, a análise pode ser refeita sem reenviar áudio; se não houver, a interface explica a perda do arquivo temporário.
- Cópia da transcrição agora comunica sucesso ou falha.

Evidência: personalização e widgets foram verificados em 390 e 1280 px e permaneceram após reload. Reenvio do mentor foi testado com primeira resposta 503 e segunda resposta válida. Recuperação da aula foi testada usando a transcrição persistida, sem chamada de upload, até a criação de uma trilha de revisão.

Validação do primeiro lote: 82 testes unitários, lint, typecheck, build e smoke HTTP aprovados. O smoke HTTP foi atualizado para validar a página inicial atual; a entrada nas áreas internas é coberta pelos testes de navegador.

Testes de navegador reutilizáveis: tests/platform-ui.mjs e tests/journeys-ui.mjs. Aceitam PLATFORM_TEST_URL, PLATFORM_PLAYWRIGHT_MODULE, PLATFORM_CHROMIUM_PATH e PLATFORM_TEST_ARTIFACTS. Rodam em contexto isolado, sem alterar registros de usuário existentes.
