<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Ferramentas disponíveis em `tools/`

Antes de explorar o projeto manualmente, verifique se um dos scripts abaixo resolve a necessidade. Eles são ajustados para este projeto e reduzem o consumo de contexto.

- `./tools/search_symbol.ps1 <termo>` — busca nas extensões do projeto, sem dependências ou artefatos de build
- `./tools/find_usages.ps1 <símbolo>` — encontra referências por palavra inteira em formato compacto
- `./tools/list_changed_files.ps1 [ref]` — lista arquivos modificados desde `HEAD` ou desde a referência informada
- `./tools/summarize_file.ps1 <caminho>` — mostra o topo, o fim e o total de linhas de um arquivo

### Regra de uso obrigatória

1. Use `search_symbol.ps1` ou `find_usages.ps1` antes de abrir arquivos.
2. Use `summarize_file.ps1` antes de ler um arquivo inteiro.
3. Use `list_changed_files.ps1` no início de revisões e investigações de bugs.
4. Leia arquivos completos somente quando essas ferramentas não fornecerem contexto suficiente.

### Fluxos recomendados

#### Análise de impacto

1. Execute `find_usages.ps1 <símbolo>` para mapear referências.
2. Execute `summarize_file.ps1` nos arquivos de definição para revelar tipos e assinaturas.
3. Leia somente os trechos necessários dos pontos de uso.
4. Execute `summarize_file.ps1` nos tipos dos parâmetros para verificar a hierarquia.

Se a busca encontrar mais de uma definição com o mesmo nome, verifique a hierarquia de tipos antes de concluir. Em projetos diferentes, nomes iguais podem representar métodos independentes. Se o usuário limitar o escopo a um projeto e houver definições homônimas fora dele, registre quais definições ficaram fora da análise.

#### Debugging

1. Execute `list_changed_files.ps1`.
2. Execute `search_symbol.ps1 <termo>`.
3. Execute `summarize_file.ps1` nos arquivos candidatos.

#### Refatoração

1. Execute `search_symbol.ps1 <símbolo>` para localizar definições.
2. Execute `find_usages.ps1 <símbolo>` para localizar usos.
3. Execute `summarize_file.ps1` antes de alterar os arquivos relevantes.

#### Onboarding

1. Execute `list_changed_files.ps1`.
2. Execute `search_symbol.ps1 <conceito>`.
3. Execute `summarize_file.ps1` nos arquivos principais.
