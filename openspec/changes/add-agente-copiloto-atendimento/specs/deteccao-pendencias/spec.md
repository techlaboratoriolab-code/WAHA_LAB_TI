## ADDED Requirements

### Requirement: Definição de conversa pendente
O sistema SHALL considerar pendente a conversa cuja última mensagem seja do paciente, já marcada como lida, e sem resposta do laboratório por mais de 8 minutos de expediente.

#### Scenario: Mensagem lida e sem resposta
- **WHEN** a última mensagem é do paciente, está marcada como lida e passaram 9 minutos de expediente sem resposta
- **THEN** a conversa é classificada como pendente

#### Scenario: Mensagem ainda não lida
- **WHEN** a última mensagem é do paciente e ainda não foi marcada como lida
- **THEN** a conversa não é classificada como pendente

#### Scenario: Laboratório já respondeu
- **WHEN** existe mensagem do laboratório posterior à última mensagem do paciente
- **THEN** a conversa não é classificada como pendente

### Requirement: Relógio limitado ao expediente
O sistema SHALL contabilizar o tempo de pendência apenas dentro do horário de expediente, definido em arquivo de configuração. O tempo decorrido fora do expediente MUST NOT ser somado.

#### Scenario: Mensagem recebida após o expediente
- **WHEN** o paciente escreve depois do encerramento do expediente
- **THEN** a contagem só começa na abertura do expediente seguinte

#### Scenario: Pendência atravessa o fim do expediente
- **WHEN** uma conversa acumulou 5 minutos de pendência antes do fechamento
- **THEN** no dia seguinte a contagem retoma dos 5 minutos, não do tempo corrido

### Requirement: Responsável pela pendência
O sistema SHALL atribuir a pendência ao atendente que respondeu por último naquela conversa. Conversas sem nenhuma resposta anterior SHALL ser agrupadas como sem responsável e exibidas a todos os atendentes.

#### Scenario: Conversa com histórico de resposta
- **WHEN** uma conversa pendente teve resposta anterior de um atendente identificado
- **THEN** a pendência é atribuída a esse atendente

#### Scenario: Conversa nunca respondida
- **WHEN** uma conversa pendente nunca recebeu resposta do laboratório
- **THEN** a pendência aparece no grupo sem responsável, visível para todos

### Requirement: Dispensa temporária
O sistema SHALL permitir dispensar uma pendência por 2 horas. A dispensa MUST expirar automaticamente, e o sistema MUST NOT oferecer dispensa permanente.

#### Scenario: Atendente dispensa pendência
- **WHEN** o atendente dispensa uma pendência porque aguarda documento do paciente
- **THEN** ela deixa de ser sinalizada por 2 horas e depois volta a aparecer

### Requirement: Notificação em três canais sem bloqueio
O sistema SHALL sinalizar pendências por contador permanente na barra de navegação, por painel com a lista filtrada e ordenada da mais antiga para a mais recente, e por aviso temporário quando uma conversa cruzar o limiar. O sistema MUST NOT usar diálogo modal que interrompa a digitação.

#### Scenario: Contador sempre visível
- **WHEN** existem pendências abertas
- **THEN** a barra de navegação exibe o total, sem interromper o atendente

#### Scenario: Painel de pendências
- **WHEN** o atendente aciona o contador
- **THEN** a lista de conversas é filtrada apenas nas pendentes, ordenadas da mais antiga, cada uma com o tempo parado e a cor da severidade

#### Scenario: Cruzamento de limiar
- **WHEN** uma conversa cruza o limiar de 8 minutos pela primeira vez
- **THEN** um aviso temporário aparece e desaparece sozinho, sem bloquear a interface

#### Scenario: Múltiplos cruzamentos em sequência
- **WHEN** várias conversas cruzam o limiar em curto intervalo
- **THEN** os avisos são agregados em um só, respeitando intervalo mínimo de 5 minutos entre avisos

### Requirement: Severidade por tempo de espera
O sistema SHALL classificar a severidade da pendência pelo tempo acumulado de expediente: atenção acima de 8 minutos, elevada acima de 1 hora e crítica acima de 3 horas.

#### Scenario: Pendência de longa duração
- **WHEN** uma conversa acumula mais de 3 horas de expediente sem resposta
- **THEN** ela é exibida com severidade crítica no painel e no contador
