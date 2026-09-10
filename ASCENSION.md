# Evolução por resultados

Esta entrega introduz habilidades escolhidas pelo usuário, métricas com direção, condições de medição, base e meta pessoais, registros datados e fontes opcionais. Não contém benchmarks históricos certificados. A escala 1–150, seus títulos e o ranking são explicitamente pessoais e experimentais, não percentis populacionais. Não usar para afirmar elite profissional, diagnósticos, capacidade financeira ou valor humano.

XP anterior permanece intacto e não entra no nível técnico. O melhor resultado mantém a capacidade registrada; a última medição dos últimos 30 dias determina o ranking recente. Sem medição, a avaliação recente fica ausente. Um índice composto só aparece após três áreas diferentes serem medidas. Classes são sugestões pessoais, não credenciais.

Persistência: campo aditivo `skillTracks` no estado JSONB existente `nexo_user_state`, segregado por `user_id` autenticado. A chave local versão 6 permanece para compatibilidade. Não há exclusão, conversão ou reinterpretação de logs, mapas, temas, planos, diagnóstico ou progresso de revisão. Uma falha na leitura inicial da nuvem agora bloqueia os envios automáticos da sessão, evitando sobrescrever dados remotos desconhecidos. Recarregar a página tenta a leitura novamente.

Sem novas variáveis de ambiente. A sincronização usa a configuração Clerk/Neon existente. Nenhuma chamada à IA é necessária para os cálculos.

## Próximas fases necessárias para HLI histórico

- Registro curado e versionado de benchmarks, com modalidade, protocolo, categoria, data e fonte primária; marcas esportivas não devem ser comparadas entre protocolos incompatíveis.
- Curvas calibradas a distribuições reais; não deduzir percentis de recordes isolados.
- Revisão independente das provas e critérios por domínio antes de conceder níveis históricos, classes raras e provas de ascensão.
- Política de revisão/expiração das referências, consentimento para comprovantes e auditoria de alterações.
- Missões adaptativas e radar; hoje as missões são definidas pelo usuário e acompanhadas nas jornadas vinculadas.

Os marcos visuais pessoais não são provas históricas certificadas. Atividades repetidas não concedem automaticamente capacidade objetiva. A conversão antiga de 500 XP por nível foi retirada da apresentação principal, mantendo o diagnóstico legado acessível.
