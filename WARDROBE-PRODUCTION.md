# Vestuário — primeiro lote em revisão

## Referência congelada

O AvatarBase é o GLB já usado em `/avatar/roger-male/part-00.bin` até `part-20.bin`.
SHA-256: `1fcd483a16886295d862517e980653cdac0c2c7c614812629f037984040fd0a3`.
Nenhum desses buffers, o carregador do corpo ou a lógica de evolução foi alterado nesta etapa.
O arquivo `lib/avatar-wardrobe-reference.json` registra as medidas extraídas no Blender.

- Corpo: 1,9203 m de altura da malha, sem cabelo.
- Distância entre articulações dos ombros: 0,3833 m.
- Pescoço–quadril: 0,5546 m.
- Rig: `Roger_Rig`, 101 ossos; escala de importação 0,01.
- Blender: Z para cima; GLB/runtime: Y para cima.
- A pose de referência é a bind pose do GLB. Medidas usam posições das articulações,
  não o comprimento visual das caudas de osso que o importador do Blender reconstrói.

## Produção local no Blender

Scripts, nesta ordem, usando Blender 4.5 LTS e diretório `../wardrobe-production`:

1. `scripts/inspect-wardrobe-base.py`: reconstrói e mede o GLB exato; grava referência `.blend`.
2. `scripts/build-fitted-wardrobe.py`: cria candidatos de camiseta fitted, camiseta normal e jogger;
   recorta/remodela superfícies, suaviza anatomia, cria volume de tecido e espessura, UVs,
   três materiais parametrizados e normal map original. Preserva e normaliza os pesos,
   limitados a quatro influências por vértice, no mesmo armature.
3. `scripts/correct-fitted-wardrobe.py`: cria candidatos de shapes corretivos para as poses de QA.
4. `scripts/review-fitted-wardrobe.py`: renderiza poses e mede penetração de vértices.
5. `node scripts/validate-wardrobe.mjs`: verifica hash, estrutura GLB, ossos, atributos,
   materiais e relatório de poses.

Exemplo: `blender -b -t 2 --python scripts/build-fitted-wardrobe.py -- ../wardrobe-production`.
O `.blend` de trabalho contém o corpo, as roupas, materiais e ações `QA_*`.
Shapes `Corrective_*` são ativados pelo script de revisão para a ação correspondente.
A prévia web usa o corretivo de postura de repouso. Ainda não existe um sistema aprovado
de interpolação desses corretivos para animações arbitrárias.

As roupas são derivadas do Roger fornecido pelo usuário; a procedência e licença continuam
documentadas em `public/avatar/ASSET-LICENSES.md`. Os arquivos de trabalho ficam locais.

## Estado verificável

- Três candidatos GLB, aproximadamente 2,00 MB, 2,01 MB e 1,27 MB.
- 101 ossos compatíveis por exportação; nenhum vértice sem peso.
- Camisetas: 11.104 triângulos cada; jogger: 6.784.
- 16 estados testados: base, repouso do aplicativo, braços abertos/elevados/à frente/cruzados,
  cotovelos, três movimentos de tronco, caminhada, corrida, agachamento, joelho elevado,
  musculatura mínima e máxima.
- Última checagem: zero vértices com penetração superior a 1 mm nesses estados, com corretivos
  específicos ativos. Este teste não prova ausência de interseção entre faces ou em frames intermediários.
- Checagem web em 390 × 844: layout utilizável; cerca de 16,66 ms por frame no computador de teste.
  A cena completa apresentou 77 chamadas de desenho e 173.847 triângulos contabilizados pelo renderer.
  Isso inclui o AvatarBase e sombras; não representa medição de GPU de celular real.
- 101 testes da aplicação passaram; TypeScript e lint verificados.

## Integração incremental

`/dev/wardrobe` carrega apenas camiseta normal e jogger para revisão, reaproveitando os ossos
do avatar existente. Essa página e sua API de arquivos retornam 404 em produção.
O body masking remove temporariamente apenas índices de regiões cobertas; desequipar restaura
os índices originais. Vértices e arquivos do AvatarBase não são modificados.

O novo editor de cores já está integrado a Equipar: cor principal, secundária/sola e detalhe,
paleta sóbria, picker, prévia, Aplicar, Cancelar e Restaurar. O backend valida propriedade do item
e cores hexadecimais, persistindo `itemMaterialColors` no JSON existente; `itemColors` permanece
compatível. Nenhuma alteração de saldo, raridade, inventário, preços ou evolução.
O salvamento em banco real não foi testado localmente porque `/api/avatar` retorna 503 sem conta/banco.

## Gate de liberação

**Os candidatos ainda não substituem as roupas do catálogo.** `catalogueApproved` permanece false.
Faltam revisão fina de costuras/UV, varredura de movimentos intermediários e corretivos contínuos,
LOD/compressão e teste em GPU mobile. O primeiro lote não encerra a remodelagem de todas as roupas.
Jaquetas, alfaiataria, casacos, shorts, calçados e equivalentes RPG permanecem pendentes.
O corpo atual usa variações por ossos/escala, não possui os sete morph targets corporais citados
como exemplo. Roupas compartilham essas transformações; não foram inventados morphs de corpo nem
alterada a evolução para aparentar compatibilidade.
