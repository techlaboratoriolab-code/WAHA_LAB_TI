## ADDED Requirements

### Requirement: Ciclo de vida único para todo processo
O sistema SHALL executar todo processo pelo mesmo ciclo de quatro etapas — detectar, buscar, renderizar e avisar — independentemente de sua complexidade. O sistema MUST NOT oferecer caminho alternativo de execução que contorne esse ciclo.

#### Scenario: Processo simples
- **WHEN** um processo declara todas as etapas de forma declarativa
- **THEN** o motor executa detectar, buscar, renderizar e avisar na ordem, usando as declarações

#### Scenario: Processo complexo
- **WHEN** um processo fornece uma função na etapa de busca e declaração nas demais
- **THEN** o motor executa o mesmo ciclo, chamando a função apenas na etapa de busca

### Requirement: Escotilha de escape por etapa
Cada etapa do processo SHALL aceitar uma declaração de dados ou uma função. A escolha SHALL ser feita etapa a etapa, e MUST NOT obrigar o processo inteiro a adotar uma das duas formas.

#### Scenario: Busca em código com renderização declarativa
- **WHEN** um processo precisa de lógica condicional na busca mas tem renderização trivial
- **THEN** ele fornece função na busca e declaração na renderização, e o motor aceita a combinação

### Requirement: Garantias aplicadas pelo motor
O motor SHALL aplicar as garantias de segurança e consistência — lista branca de comandos de leitura, confirmação do atendente antes de consultar, cache e limite de chamadas — a todos os processos. Um processo MUST NOT acessar o apLIS diretamente, devendo solicitar a consulta ao motor.

#### Scenario: Processo tenta acessar o apLIS diretamente
- **WHEN** a função de busca de um processo tenta chamar o apLIS sem passar pelo motor
- **THEN** a chamada não tem acesso às credenciais e falha

#### Scenario: Processo em código respeita a confirmação
- **WHEN** um processo implementado em função retorna múltiplos pacientes
- **THEN** o motor aplica a desambiguação obrigatória da mesma forma que aplicaria a um processo declarativo

### Requirement: Registro declarativo de processo
Cada processo SHALL ser declarado num registro contendo identificador, intenção atendida, requisitos de dado, definição de busca, definição de renderização e avisos aplicáveis. Adicionar um processo SHALL consistir em acrescentar um registro, sem alterar o motor.

#### Scenario: Novo processo adicionado
- **WHEN** um registro novo é acrescentado ao catálogo com intenção e etapas definidas
- **THEN** o processo passa a ser executado sem nenhuma alteração no motor

#### Scenario: Intenção sem processo correspondente
- **WHEN** a intenção detectada não possui processo no catálogo
- **THEN** o painel informa que reconheceu o pedido mas ainda não o atende, e a ocorrência é registrada

### Requirement: Cobertura inicial do catálogo
O catálogo SHALL conter, na entrega inicial, os processos correspondentes às intenções `previsao_entrega`, `laudo_disponivel` e `status_exame`. Esses três processos MUST ser declarados sem uso da escotilha de função.

#### Scenario: Processos iniciais são declarativos
- **WHEN** os três processos da entrega inicial são inspecionados
- **THEN** nenhum deles usa função em qualquer etapa, comprovando que o motor cobre o caso simples
