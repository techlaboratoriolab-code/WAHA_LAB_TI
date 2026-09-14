## ADDED Requirements

### Requirement: Autenticação obrigatória nas rotas do agente
O sistema SHALL exigir token de sessão válido em todas as rotas sob `/api/agent/` e `/api/aplis/`, validando-o no servidor contra o Supabase. Requisição sem token válido MUST ser rejeitada com 401, sem consultar o apLIS nem o modelo.

#### Scenario: Requisição autenticada
- **WHEN** a requisição traz token de sessão válido de atendente autorizado
- **THEN** a rota executa normalmente

#### Scenario: Requisição sem token
- **WHEN** a requisição chega sem token ou com token inválido
- **THEN** o sistema responde 401 e nenhuma chamada externa é feita

#### Scenario: Token válido sem permissão de atendimento
- **WHEN** o token é válido mas o perfil não tem permissão de uso do WhatsApp
- **THEN** o sistema responde 403

### Requirement: Identidade do atendente derivada do servidor
O sistema SHALL determinar o atendente responsável por uma mensagem a partir do token autenticado no servidor, e MUST NOT confiar em identificador de atendente enviado pelo navegador como fonte única.

#### Scenario: Envio autenticado
- **WHEN** o atendente envia mensagem pela interface autenticada
- **THEN** o servidor associa a mensagem ao atendente do token, ignorando qualquer identificador divergente vindo do corpo da requisição

#### Scenario: Mensagem originada fora do sistema
- **WHEN** a mensagem foi enviada por fora da interface e traz o prefixo de nome do atendente no texto
- **THEN** o sistema usa o prefixo como fonte secundária de atribuição

#### Scenario: Mensagem sem nenhuma fonte de atribuição
- **WHEN** a mensagem não possui token associado nem prefixo reconhecível
- **THEN** ela é marcada como não atribuída e MUST NOT ser contabilizada para nenhum atendente

### Requirement: Restrição de dado sensível em log
O sistema MUST NOT registrar em log CPF, RG, nome de paciente, identificador de conversa ou conteúdo de mensagem. Registros de diagnóstico SHALL conter apenas código de requisição, intenção, confiança e carimbo de tempo.

#### Scenario: Log de consulta bem-sucedida
- **WHEN** uma consulta ao apLIS é concluída
- **THEN** o log contém código da requisição, atendente e horário, sem CPF, nome ou telefone

#### Scenario: Log de erro do modelo
- **WHEN** a classificação falha
- **THEN** o log registra o erro sem incluir o conteúdo das mensagens analisadas

### Requirement: Chaves de terceiros restritas ao servidor
O sistema MUST manter as credenciais do apLIS e a chave da API do modelo exclusivamente no servidor. Essas credenciais MUST NOT aparecer em código entregue ao navegador, em resposta de API ou em log.

#### Scenario: Inspeção do código do cliente
- **WHEN** o código carregado pelo navegador é inspecionado
- **THEN** nenhuma credencial do apLIS ou chave do modelo está presente

### Requirement: Habilitação seletiva por atendente
O sistema SHALL permitir habilitar o agente para um subconjunto de atendentes, por configuração. Atendentes fora da lista MUST usar a interface sem nenhuma alteração de comportamento.

#### Scenario: Atendente no piloto
- **WHEN** o atendente está na lista de habilitados
- **THEN** o painel do agente e as pendências ficam disponíveis

#### Scenario: Atendente fora do piloto
- **WHEN** o atendente não está na lista de habilitados
- **THEN** nenhuma chamada ao modelo ou ao apLIS é feita para ele e a interface se comporta como antes da mudança

#### Scenario: Agente desligado globalmente
- **WHEN** a configuração global do agente está desligada
- **THEN** o sistema opera exatamente como antes desta mudança, para todos os atendentes

### Requirement: Teto de consumo por atendente
O sistema SHALL aplicar limite diário configurável de chamadas ao modelo por atendente. Atingido o limite, o sistema MUST degradar para operação sem sugestão, sem impedir o atendimento.

#### Scenario: Limite diário atingido
- **WHEN** um atendente atinge o teto diário de chamadas
- **THEN** o painel informa indisponibilidade da sugestão e o envio de mensagens continua funcionando normalmente
