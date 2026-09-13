# Rotina e Ascensão

Alterações incrementais: a navegação principal e os dados anteriores continuam no mesmo painel.

## Onde encontrar

- Estudar → Rotina (também pela seção Hoje da Home ou pelo botão Rotina da Ascensão).
- Rotina: Hoje, Semana, Hábitos, Habilidades e Histórico.
- Ascensão: Visão geral, Plano, Arquétipos, Objetivos e Evolução.
- Os formulários e históricos anteriores da Ascensão estão na aba Evolução. O gerador de arquétipos existente continua em Arquétipos → Gerar opções com IA.

## Persistência

O JSON por usuário existente recebe os campos opcionais `routine` e `tertiaryArchetypeId`. Estados antigos recebem coleções vazias na leitura, sem apagar ou converter habilidades, evidências, jornadas ou XP. O mesmo salvamento local e autenticado em `nexo_user_state` guarda esses campos. Não há tabela nova nem variável de ambiente adicional.

Cada registro de hábito possui uma chave lógica hábito/dia e guarda uma cópia do nome, meta e unidade daquele dia. Editar um hábito não reescreve as medições passadas. Arquivar conserva o histórico e pode ser desfeito.

## Priorização

As sugestões usam os protocolos de arquétipos já existentes (incluindo os gerados pela IA). Marcar uma atividade não chama IA. Os pesos de três arquétipos são 50/30/20; com dois são 62,5/37,5; com um, 100. A prioridade combina peso, importância, tempo desde a conclusão, objetivos pendentes, distância da meta de uma habilidade vinculada e contribuição combinada. O plano respeita o orçamento diário e limita a sete sugestões.

Atividades com o mesmo nome normalizado são unificadas. Correspondências semânticas entre nomes diferentes não são inferidas: o usuário pode vincular a mesma atividade a vários arquétipos e remover sugestões redundantes. Durações sem minutos no protocolo recebem uma estimativa editável de 15 minutos. Recuperação exclui as atividades que o usuário marcou como físicas.

## Limites de interpretação

Progresso de objetivos é autodeclarado. Concluir hábitos não aumenta automaticamente os níveis técnicos. O check-in informa execução real e sugere reduzir a duração após três dias pendentes; não inventa aumento percentual de habilidade. A cota mensal é acompanhada no mês; a visão semanal mostra oportunidades restantes no recorte da semana.

## Validação

Testes de migração aditiva, serialização, registros idempotentes, cotas, dias específicos, pesos e prioridade estão em `tests/routine.test.ts`. O fluxo autenticado no navegador e o teclado de um iPhone físico exigem validação adicional.
