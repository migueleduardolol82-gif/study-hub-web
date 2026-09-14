# Avatar evolutivo

Entrada: Perfil → Avatar evolutivo ou Ascensão → Avatar. Alteração aditiva; trilhas, rotina, XP e índices existentes são preservados.

## Implementado

- Modelo 3D paramétrico próprio, sem arquivos de terceiros ou chamadas à IA para cada render. Rotação por toque e botões, zoom, transição de proporções, pausa visual em aba oculta, resolução limitada e carregamento separado do painel.
- Aparência manual: apresentação, pele, cabelo, rosto, barba, altura, peso, gordura informada e volume muscular visual. Parser de descrição reconhece dados explícitos e exige confirmação via formulário. Não transforma adjetivos em medidas médicas.
- Inventário e prévia de roupas, calçados, relógio, faixa, insígnia, aura, moldura e título. Acabamento do traje combina os arquétipos informados em pesos 50/30/20, normalizados quando há menos de três.
- Loja com raridade, categoria, inventário e ordenação por preço. Confirmação antes da compra. Itens são exclusivamente cosméticos.
- Histórico das aparências salvas e extrato da moeda Essência. O histórico registra os parâmetros do corpo; não é um arquivo de imagens nem um histórico completo de equipamentos.
- Checkpoints automáticos após o salvamento do painel e conferência manual. Uma impressão digital evita reprocessar o mesmo estado. As alterações no avatar não modificam os atributos reais.

## Persistência e autenticação

`nexo_avatar`: um agregado JSONB por `user_id`, com aparência, corpo, inventário, equipamentos, carteira, transações, marcos e histórico; `revision` controla concorrência.

`nexo_avatar_audit`: ação, usuário, revisão e data do servidor. Compra, débito, inventário e auditoria são salvos atomicamente por uma CTE com comparação de revisão; conflitos são relidos, limitados a três tentativas. O cliente não pode enviar saldo, preço, recompensa ou inventário.

Tabelas criadas aditivamente. Nenhuma migração destrutiva de `nexo_user_state`. `/api/avatar` usa Clerk, valida origem/tipo/tamanho e devolve envelopes JSON. Falhas técnicas são registradas no servidor e não devolvidas ao navegador. Salvar o painel continua funcionando mesmo se um checkpoint do avatar falhar.

Variáveis existentes: `DATABASE_URL` (ou `POSTGRES_URL`), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`. Nenhuma nova chave de IA ou serviço 3D é necessária. O usuário do banco precisa poder criar as duas tabelas. Sem nuvem autenticada, compras ficam indisponíveis; não há carteira local com saldo editável.

## Economia inicial

- Conta começa com 0 Essência e traje básico gratuito.
- Dia ativo: hábito concluído salvo; cinco respostas distintas efetivamente enviadas; ou resultado físico elegível.
- Marcos em 7/21/30/60/100/180/365/730 dias concedem 10/20/20/50/50/100/100/100 Essências, uma vez cada. Depois de 30 dias, cada bloco adicional de 30 dias ativos concede 40.
- Missão de domínio: pelo menos dez questões diferentes, modo Domínio, mínimo de 80% de acerto no dia.
- Missão física: resultado melhor que um registro anterior, com distância mínima de 14 dias entre registros, ambos posteriores à criação do avatar.
- Cada missão concede 30/100/200 Essências nos marcos de 7/30/100 dias elegíveis.
- Não há resgate retroativo nem recompensa por abrir, editar aparência, alterar peso ou repetir a mesma solicitação. Dias são computados no fuso America/Sao_Paulo; não há configuração de fuso que permita recolher duas vezes.
- Preços variam de 40 a 5000. Requisitos de atividade vão de 7 a 730 dias. Lendários, míticos e transcendentes exigem adicionalmente 30 dias elegíveis de domínio e 30 de resultados físicos.

Esses valores são uma política inicial explícita, não um balanceamento econômico comprovado com uma população real. Os registros de origem continuam autodeclarados: o sistema impede duplicação e manipulação direta da carteira, mas não certifica externamente que o usuário treinou ou dominou o conteúdo. Não chamar os títulos de provas verificadas de desempenho mundial.

## Limites e próximas extensões

O modelo é uma representação paramétrica estilizada, não reconstrução anatômica ou geração de uma malha exclusiva com IA. Sem reconhecimento facial/fotos. Massa muscular é controle visual; condicionamento, sono e postura não são inferidos a partir do peso. Novas medidas requerem confirmação manual; apenas os marcos e dados de evolução já registrados são sincronizados automaticamente.

O catálogo inicial é finito; cabelos e rostos são ajustes básicos, não itens colecionáveis. Missões são marcos determinísticos; não há geração personalizada de missões por IA. Dados permanecem em um agregado por conta, com auditoria separada; grandes históricos devem ser extraídos para tabelas/paginação de servidor numa etapa de escala. A tela pagina o histórico visual em blocos de 20.

## Verificação

Testes automatizados de validação, parser, repetição de recompensas, compras, requisitos, dias locais, perguntas respondidas e resultado físico estão em `tests/avatar.test.ts`. Não confundem registros simulados de teste com dados de produção.

### Resultados desta entrega

- 66 testes automatizados passaram; lint e verificação TypeScript passaram.
- Build Next.js de produção passou, incluindo `/api/avatar`.
- Chromium local: interface verificada em 320, 375, 390, 430, 768 e 1280 px. Um excesso de 4 px nas abas foi corrigido. Sem erros JavaScript na página.
- Fluxos de descrição, salvar aparência, experimentar, comprar, equipar e abrir histórico verificados com respostas de API controladas exclusivamente no navegador de teste. Isso valida a interface, não constitui teste de persistência na conta real.
- API real local sem configuração: JSON 503, sem detalhes técnicos.
- Não foram simulados login ou compras na conta real de Miguel. Transações concorrentes no Neon e Safari físico com teclado não foram testados neste ambiente. A verificação responsiva em Chromium não equivale a teste em um iPhone físico.

Teste visual reproduzível: `tests/avatar-ui.mjs` inicia somente o build local em 127.0.0.1:3100. Requer Playwright e Chromium no ambiente de testes. Variáveis opcionais `AVATAR_PLAYWRIGHT_MODULE` e `AVATAR_CHROMIUM_PATH` permitem indicar instalações externas; `AVATAR_TEST_ARTIFACTS` indica a pasta das capturas. Execute depois de `npm run build` com `node --experimental-strip-types tests/avatar-ui.mjs`. O servidor local é encerrado ao terminar. Os fixtures interceptados nunca são enviados ao banco.
