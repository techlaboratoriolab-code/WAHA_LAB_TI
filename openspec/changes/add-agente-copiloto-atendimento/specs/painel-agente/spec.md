## ADDED Requirements

### Requirement: Painel posicionado acima do campo de digitação
O sistema SHALL exibir o painel do agente na área imediatamente acima do campo de digitação, dentro da conversa aberta. O painel MUST permanecer oculto quando não houver intenção detectada nem aviso a mostrar.

#### Scenario: Conversa sem intenção detectada
- **WHEN** a análise não identifica intenção acima do limiar e não há aviso
- **THEN** o painel permanece oculto e a área de digitação fica como hoje

### Requirement: Inserção sem envio automático
O painel SHALL oferecer a resposta pronta através de uma ação que apenas preenche o campo de digitação. O sistema MUST NOT enviar mensagem ao paciente sem ação explícita de envio pelo atendente.

#### Scenario: Atendente aciona a resposta sugerida
- **WHEN** o atendente aciona "Inserir" numa resposta sugerida
- **THEN** o texto é colocado no campo de digitação, o foco vai para o campo, e nenhuma mensagem é enviada

#### Scenario: Atendente edita antes de enviar
- **WHEN** o atendente altera o texto inserido e envia
- **THEN** a mensagem enviada é a versão editada

### Requirement: Cartão de dados com origem verificável
Quando houver consulta bem-sucedida, o painel SHALL exibir os dados retornados do apLIS incluindo o código da requisição, de forma que o atendente possa conferir a origem antes de usar a sugestão.

#### Scenario: Consulta retorna requisição
- **WHEN** a consulta retorna uma requisição
- **THEN** o painel exibe código da requisição, paciente, exame, status e data prevista

### Requirement: Respostas preenchidas a partir de template fixo
O sistema SHALL montar a sugestão preenchendo lacunas de templates fixos com os dados retornados da consulta. O texto das respostas MUST NOT ser redigido pelo modelo de linguagem.

#### Scenario: Preenchimento de template
- **WHEN** um template possui lacuna de data prevista e a consulta retornou essa data
- **THEN** o sistema substitui a lacuna pelo valor consultado e apresenta o texto pronto

#### Scenario: Dado ausente para a lacuna
- **WHEN** um template possui lacuna sem dado correspondente na consulta
- **THEN** o sistema não oferece aquele template e registra a lacuna não preenchida

### Requirement: Avisos por severidade
O painel SHALL exibir avisos classificados em três níveis de severidade, distinguidos por cor: crítico para risco de incidente de privacidade, atenção para oportunidade ou pendência, e informativo para confirmação neutra.

#### Scenario: Risco de privacidade
- **WHEN** a intenção envolve dado de exame e a identidade do paciente não foi confirmada na conversa
- **THEN** o painel exibe aviso de severidade crítica antes de qualquer sugestão

#### Scenario: Confirmação neutra
- **WHEN** a consulta é concluída com sucesso
- **THEN** o painel exibe aviso informativo indicando a origem do dado

### Requirement: Intenção reconhecida sem identificador
Quando a intenção for reconhecida e nenhum identificador estiver disponível, o painel SHALL oferecer ao atendente tanto a resposta pronta solicitando o CPF quanto um campo para digitar o identificador manualmente.

#### Scenario: Paciente pergunta sem se identificar
- **WHEN** a intenção é reconhecida e não há CPF, RG, nome ou código na conversa
- **THEN** o painel apresenta a resposta que solicita o documento e um campo de digitação para o atendente informar o identificador que já conheça

### Requirement: Distinção entre paciente e clínica parceira
O sistema SHALL permitir marcar manualmente um contato como clínica parceira ou paciente, persistindo a marcação em arquivo versionado. O sistema MUST NOT inferir automaticamente essa classificação.

#### Scenario: Contato marcado como clínica
- **WHEN** um contato está marcado como clínica parceira
- **THEN** o painel adota o tratamento previsto para clínica, permitindo consulta sobre pacientes que não são o próprio contato

#### Scenario: Contato sem marcação
- **WHEN** um contato não possui marcação
- **THEN** o sistema o trata como paciente, aplicando a exigência de confirmação de identidade
