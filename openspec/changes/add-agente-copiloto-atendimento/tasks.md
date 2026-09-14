## 1. Pré-requisitos operacionais

- [ ] 1.1 Rotacionar as credenciais do apLIS e confirmar acesso com a credencial nova
- [ ] 1.2 Desativar o acesso externo ao banco espelho, já desnecessário pela decisão de usar a API
- [ ] 1.3 Solicitar à Lacuna credencial de integração somente leitura para o apLIS
- [ ] 1.4 Confirmar que a conta Gemini está em tier pago e obter a chave de API
- [ ] 1.5 Definir o horário de expediente e registrar em arquivo de configuração
- [ ] 1.6 Adicionar `APLIS_BASE_URL`, `APLIS_USUARIO`, `APLIS_SENHA`, `GEMINI_API_KEY`, `AGENT_ENABLED`, `AGENT_ATENDENTES`, `AGENT_TETO_DIARIO` ao `.env.example`

## 2. Autenticação das rotas

- [x] 2.1 Criar middleware que valida o token de sessão do Supabase no servidor e anexa o perfil do atendente à requisição
- [x] 2.2 Responder 401 sem token válido e 403 para perfil sem permissão de WhatsApp
- [x] 2.3 Fazer o front enviar o `accessToken` guardado no login em todas as chamadas às rotas novas
- [x] 2.4 Aplicar o middleware em todas as rotas `/api/agent/*` e `/api/aplis/*`
- [x] 2.5 Verificar que requisição sem token não alcança apLIS nem modelo

## 3. Cliente do apLIS (somente leitura)

- [x] 3.1 Criar `lib/aplis/client.js` com o envelope `{ver, cmd, dat}` e autenticação básica
- [x] 3.2 Implementar a lista branca de comandos de leitura e rejeitar qualquer outro antes da requisição HTTP
- [x] 3.3 Tratar `sucesso: 0` como erro de negócio, expondo `codErro` e `msgErro` de forma legível
- [x] 3.4 Aplicar `AbortController` com corte em 8 segundos
- [x] 3.5 Normalizar o retorno de `requisicaoListar` para um formato interno estável
- [x] 3.6 Normalizar o retorno de `requisicaoStatus`, priorizando `descricaoCliente` sobre a descrição interna
- [x] 3.7 Escrever teste que confirme que comando de escrita é recusado sem contatar o apLIS

## 4. Rota de consulta

- [x] 4.1 Criar `POST /api/aplis/consultar` aceitando código de requisição (CPF e nome entram na tarefa 4.2)
- [x] 4.2 Implementar busca por CPF/nome, janela padrão de 90 dias e o parâmetro de ampliação para 24 meses
- [x] 4.3 Agrupar o resultado por paciente distinto e sinalizar quando houver mais de um
- [x] 4.4 Registrar em log apenas código de requisição, atendente e horário
- [ ] 4.5 Configurar `functions.maxDuration` no `vercel.json`

## 5. Motor de processos

- [ ] 5.1 Definir o contrato do registro de processo: identificador, intenção, requisitos, buscar, renderizar, avisos
- [ ] 5.2 Implementar o ciclo detectar → buscar → renderizar → avisar
- [ ] 5.3 Aceitar declaração ou função em cada etapa, de forma independente
- [ ] 5.4 Garantir que a consulta ao apLIS só aconteça através do motor, sem acesso a credencial pelos processos
- [ ] 5.5 Aplicar no motor a confirmação obrigatória, o cache e o teto de consumo
- [ ] 5.6 Tratar intenção sem processo correspondente, informando e registrando a ocorrência

## 6. Catálogo inicial e templates

- [ ] 6.1 Criar `public/agent_templates.js` com os templates do agente, sem alterar `quick_responses.js`
- [ ] 6.2 Declarar o processo `previsao_entrega`, inteiramente declarativo
- [ ] 6.3 Declarar o processo `laudo_disponivel`, apontando para o portal sem anexar PDF
- [ ] 6.4 Declarar o processo `status_exame`, inteiramente declarativo
- [ ] 6.5 Confirmar que nenhum dos três usa a escotilha de função
- [ ] 6.6 Omitir o template quando faltar dado para alguma lacuna e registrar a lacuna não preenchida

## 7. Detecção de intenção

- [ ] 7.1 Adicionar `@google/genai` e configurar o cliente Gemini no servidor
- [ ] 7.2 Definir o JSON Schema de saída com enum de quatro intenções, identificadores e confiança
- [ ] 7.3 Criar `POST /api/agent/analisar`, recebendo as últimas 30 mensagens e devolvendo a classificação
- [ ] 7.4 Implementar o limiar de confiança, exibindo indefinição abaixo dele
- [ ] 7.5 Implementar reconhecimento por expressão regular de requisição de 13 dígitos, CPF e credencial `P#####`
- [ ] 7.6 Registrar em log estruturado as classificações `outro`, sem `chatId`, CPF ou nome
- [ ] 7.7 Aplicar teto diário por atendente, degradando para operação sem sugestão

## 8. Disparo e cache no cliente

- [ ] 8.1 Disparar a análise em `selectChat()`, ao abrir a conversa
- [ ] 8.2 Disparar novamente quando chegar mensagem com a conversa aberta
- [ ] 8.3 Implementar cache por `chatId` somado ao id da última mensagem
- [ ] 8.4 Bloquear qualquer disparo em conversas `@g.us`
- [ ] 8.5 Respeitar `AGENT_ENABLED` e a lista de atendentes habilitados

## 9. Painel do agente

- [x] 9.1 Criar o painel acima do campo de digitação, seguindo o padrão do `#reply-preview-bar`
- [x] 9.2 Renderizar o cartão de dados incluindo o código da requisição
- [ ] 9.3 Implementar a ação "Inserir", que apenas preenche o campo e devolve o foco
- [x] 9.4 Implementar a lista de escolha quando houver mais de um paciente, sem sugestão antes da seleção
- [ ] 9.5 Implementar o estado de intenção sem identificador, com resposta pedindo CPF e campo de digitação manual
- [ ] 9.6 Implementar os três níveis de aviso por cor, com os tokens de tema existentes
- [ ] 9.7 Criar `public/parceiros.js` e aplicar a marcação clínica/paciente
- [x] 9.8 Manter o painel oculto quando não houver intenção nem aviso

## 10. Pendências

- [ ] 10.1 Implementar a regra base: última mensagem do paciente, lida, sem resposta posterior
- [ ] 10.2 Implementar o relógio limitado ao expediente, a partir do arquivo de configuração
- [ ] 10.3 Atribuir a pendência a quem respondeu por último e agrupar as sem responsável
- [ ] 10.4 Implementar dispensa temporária de 2 horas, com expiração automática
- [ ] 10.5 Classificar severidade por tempo acumulado: 8 minutos, 1 hora e 3 horas
- [ ] 10.6 Adicionar o contador no rail de navegação
- [ ] 10.7 Implementar o painel com a lista filtrada, ordenada da mais antiga
- [ ] 10.8 Implementar o aviso temporário agregado, com intervalo mínimo de 5 minutos

## 11. Verificação

- [ ] 11.1 Testar consulta com código válido, inválido e requisição cancelada
- [ ] 11.2 Confirmar que comando de escrita é recusado pelo cliente do apLIS
- [ ] 11.3 Confirmar que requisição sem token retorna 401 e não alcança serviços externos
- [ ] 11.4 Testar busca que retorna múltiplos pacientes e confirmar que nenhuma sugestão aparece antes da escolha
- [ ] 11.5 Deixar conversa lida e sem resposta por 10 minutos e confirmar a sinalização nos três canais
- [ ] 11.6 Confirmar que o relógio de pendência não avança fora do expediente
- [ ] 11.7 Confirmar que nenhuma credencial aparece no código entregue ao navegador
- [ ] 11.8 Confirmar que log nenhum contém CPF, nome, telefone ou conteúdo de mensagem
- [ ] 11.9 Com `AGENT_ENABLED` desligado, confirmar que a interface se comporta exatamente como antes
- [ ] 11.10 Confirmar que o agente permanece inativo em conversas de grupo

## 12. Piloto

- [ ] 12.1 Habilitar o agente para dois atendentes, um de alto e um de baixo volume
- [ ] 12.2 Acompanhar por duas semanas o custo real, a taxa de uso da sugestão e os erros de intenção
- [ ] 12.3 Extrair do log o ranking das intenções `outro` para priorizar os próximos processos
- [ ] 12.4 Calibrar o limiar de confiança com os dados coletados
- [ ] 12.5 Decidir, com base nos dados, se o modelo permanece o Flash-Lite
