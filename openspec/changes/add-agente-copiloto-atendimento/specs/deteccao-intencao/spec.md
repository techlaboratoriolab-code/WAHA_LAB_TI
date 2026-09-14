## ADDED Requirements

### Requirement: Análise disparada pela abertura da conversa
O sistema SHALL analisar a intenção do paciente quando o atendente abrir uma conversa, e novamente quando chegar mensagem nova enquanto aquela conversa estiver aberta. O sistema MUST NOT analisar conversas fechadas.

#### Scenario: Atendente abre uma conversa
- **WHEN** o atendente seleciona uma conversa na lista
- **THEN** o sistema envia as últimas 30 mensagens para classificação e exibe o resultado no painel

#### Scenario: Mensagem nova com a conversa aberta
- **WHEN** chega mensagem do paciente e a conversa dele está aberta na tela
- **THEN** o sistema reanalisa considerando a mensagem nova

#### Scenario: Mensagem nova com a conversa fechada
- **WHEN** chega mensagem do paciente e a conversa dele não está aberta
- **THEN** o sistema não dispara análise nenhuma

### Requirement: Intenção restrita a lista fechada
O sistema SHALL classificar a intenção em exatamente um valor do conjunto `previsao_entrega`, `laudo_disponivel`, `status_exame` ou `outro`, usando saída estruturada com JSON Schema. O sistema MUST NOT aceitar rótulo de intenção fora desse conjunto.

#### Scenario: Intenção reconhecida
- **WHEN** o paciente pergunta quando o exame fica pronto
- **THEN** o sistema classifica como `previsao_entrega`

#### Scenario: Intenção não coberta
- **WHEN** a mensagem não corresponde a nenhuma das três intenções atendidas
- **THEN** o sistema classifica como `outro` e preenche um campo de texto livre descrevendo o pedido

### Requirement: Limiar de confiança
O sistema SHALL exigir confiança mínima configurável para exibir a intenção. Abaixo do limiar, o sistema MUST exibir estado de indefinição em vez da intenção classificada.

#### Scenario: Confiança abaixo do limiar
- **WHEN** a classificação retorna confiança inferior ao limiar configurado
- **THEN** o painel informa que não identificou a intenção e não sugere nenhuma consulta

### Requirement: Extração de identificadores do paciente
O sistema SHALL extrair da conversa os identificadores presentes — CPF, RG, nome e código de requisição — e SHALL aplicar reconhecimento determinístico por expressão regular para código de requisição de 13 dígitos, CPF e credencial no formato `P` seguido de 5 a 6 dígitos, sem depender do modelo.

#### Scenario: Código de requisição na mensagem
- **WHEN** a mensagem contém a sequência `0085088021000`
- **THEN** o sistema reconhece o código de requisição por expressão regular, independentemente da classificação do modelo

#### Scenario: Nenhum identificador presente
- **WHEN** a intenção é reconhecida mas nenhum identificador aparece na conversa
- **THEN** o sistema sinaliza ausência de identificador e não dispara consulta

### Requirement: Reaproveitamento de análise por cache
O sistema SHALL armazenar o resultado da análise no navegador, indexado por identificador da conversa somado ao identificador da última mensagem. Enquanto essa chave não mudar, o sistema MUST reutilizar o resultado e MUST NOT emitir nova chamada ao modelo.

#### Scenario: Reabertura sem mensagem nova
- **WHEN** o atendente reabre uma conversa que não recebeu mensagem desde a última análise
- **THEN** o sistema exibe o resultado em cache sem chamar o modelo

#### Scenario: Reabertura após mensagem nova
- **WHEN** o atendente reabre uma conversa que recebeu mensagem desde a última análise
- **THEN** a chave de cache muda e o sistema executa nova análise

### Requirement: Agente inativo em conversas de grupo
O sistema MUST NOT executar análise de intenção em conversas de grupo, identificadas pelo sufixo `@g.us`.

#### Scenario: Abertura de conversa de grupo
- **WHEN** o atendente abre uma conversa cujo identificador termina em `@g.us`
- **THEN** o painel do agente permanece oculto e nenhuma chamada ao modelo é feita

### Requirement: Registro das intenções não cobertas
O sistema SHALL registrar em log estruturado no servidor cada classificação `outro`, contendo data, intenção, confiança e o texto livre descritivo. O sistema MUST NOT incluir nesse registro identificador da conversa, CPF, RG ou nome de paciente.

#### Scenario: Classificação como outro
- **WHEN** uma análise resulta em `outro`
- **THEN** o servidor grava `{data, intencao, confianca, textoLivre}` no log, sem nenhum dado identificável de paciente
