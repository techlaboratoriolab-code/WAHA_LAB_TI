## ADDED Requirements

### Requirement: Integração exclusivamente de leitura
O sistema SHALL restringir a comunicação com o apLIS a uma lista branca de comandos de leitura: `requisicaoListar`, `requisicaoStatus`, `requisicaoResultado`, `requisicaoLaudo`, `requisicaoImagem` e `faturamentoLoteListar`. Qualquer comando fora dessa lista MUST ser rejeitado antes de virar requisição HTTP.

#### Scenario: Comando de escrita solicitado
- **WHEN** qualquer parte do sistema tenta emitir `admissaoSalvar`, `pacienteSalvar`, `requisicaoCancelar`, `requisicaoStatusSalvar`, `dadosClinicosSalvar` ou `exameAnteriorSalvar`
- **THEN** o cliente recusa a chamada e registra erro, sem contatar o apLIS

#### Scenario: Comando de leitura permitido
- **WHEN** o sistema emite `requisicaoStatus` com um código de requisição válido
- **THEN** a chamada é encaminhada ao apLIS com autenticação básica e o retorno é normalizado

### Requirement: Credenciais restritas ao servidor
O sistema MUST manter usuário e senha do apLIS exclusivamente no servidor, lidos de variáveis de ambiente. O sistema MUST NOT expor essas credenciais ao navegador em nenhuma resposta, log de cliente ou artefato de build.

#### Scenario: Requisição originada do navegador
- **WHEN** o navegador precisa de dado do apLIS
- **THEN** ele chama a rota interna do próprio sistema, que faz a chamada autenticada ao apLIS no servidor

### Requirement: Busca de requisição por identificador do paciente
O sistema SHALL localizar requisições via `requisicaoListar` usando CPF, nome ou código de requisição. A janela de datas padrão SHALL ser de 90 dias.

#### Scenario: Busca por CPF com resultado
- **WHEN** o sistema busca por um CPF que possui requisição nos últimos 90 dias
- **THEN** retorna os dados normalizados incluindo código da requisição, nome do exame, status e data prevista

#### Scenario: Busca sem resultado na janela padrão
- **WHEN** a busca nos últimos 90 dias não retorna nenhuma requisição
- **THEN** o sistema informa que não encontrou no período consultado e oferece ampliar a busca para 24 meses

#### Scenario: Ampliação da janela
- **WHEN** o atendente aciona a ampliação da busca
- **THEN** o sistema repete a consulta com janela de 24 meses

### Requirement: Desambiguação obrigatória de múltiplos pacientes
Quando a busca retornar requisições de mais de um paciente distinto, o sistema MUST apresentar as opções para escolha do atendente e MUST NOT selecionar automaticamente nenhuma delas nem montar sugestão antes da escolha.

#### Scenario: Busca por nome retorna vários pacientes
- **WHEN** a busca por nome retorna requisições de pacientes distintos
- **THEN** o painel lista as opções com dados mínimos de distinção e aguarda a seleção, sem exibir sugestão

#### Scenario: Busca retorna um único paciente
- **WHEN** a busca retorna requisições de um único paciente
- **THEN** o painel exibe o cartão de dados para confirmação do atendente

### Requirement: Tratamento de erro do apLIS
O sistema SHALL tratar a resposta `sucesso: 0` do apLIS como erro de negócio, expondo `codErro` e `msgErro` de forma legível, sem derrubar a requisição. O sistema SHALL abortar chamadas que ultrapassem 8 segundos.

#### Scenario: apLIS responde erro de negócio
- **WHEN** o apLIS retorna `sucesso: 0` com `codErro` e `msgErro`
- **THEN** o painel exibe a mensagem de erro e permanece utilizável, sem interromper o envio de mensagens

#### Scenario: apLIS não responde a tempo
- **WHEN** a chamada ao apLIS ultrapassa 8 segundos
- **THEN** o sistema aborta, informa indisponibilidade momentânea no painel e não bloqueia o atendimento
