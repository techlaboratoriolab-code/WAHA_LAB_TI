# Agente Copiloto de Atendimento

## Why

Os atendentes do laboratório respondem pacientes por WhatsApp nesta interface, mas a informação que o paciente pede mora no apLIS. O trabalho real é sair do chat, pesquisar no LIS e voltar — dezenas de vezes por dia. A análise de 4.074 atendimentos reais (62 relatórios diários, 06/07 a 09/09/2026) mostra que **~41% do volume é consulta de leitura que o apLIS responde sozinho**, sendo "laudo" isolado 21,5%.

A segunda dor é medida no mesmo material: `Conversas sem resposta` aparece em **52 dos 62 dias**, com casos de paciente parado "mais de 3 horas até o final do expediente". O padrão é sempre o mesmo — o atendente abre a conversa, é interrompido por uma urgência e não volta.

Existe avaliação de qualidade hoje, mas ela roda de madrugada sobre um backup do Google Drive e só aparece no dia seguinte. Não corrige nada enquanto o atendimento acontece.

## What Changes

- **Detecção de intenção em tempo real**: ao abrir uma conversa, o sistema lê as últimas 30 mensagens e classifica a intenção do paciente numa lista fechada (`previsao_entrega`, `laudo_disponivel`, `status_exame`, `outro`), extraindo identificadores (CPF, RG, nome) quando presentes.
- **Consulta somente leitura ao apLIS**: novo cliente com lista branca de comandos. Busca a requisição do paciente por CPF ou nome via `requisicaoListar`, detalha via `requisicaoStatus`. Janela padrão de 90 dias, ampliável a 24 meses sob demanda.
- **Painel de sugestão acima do campo de digitação**: mostra o dado retornado do apLIS num cartão, oferece uma resposta pronta preenchida a partir do catálogo existente e um botão "Inserir". **Nunca envia mensagem sozinho** — apenas preenche o campo, como o autocomplete de `/` já faz.
- **Detecção de pendências**: conversa lida, sem resposta há mais de 8 minutos de expediente, sinalizada por badge no rail, painel filtrado e toast agregado. Sem pop-up modal.
- **Catálogo de processos declarativo**: motor com ciclo de vida único (detectar → buscar → renderizar → avisar), onde cada etapa aceita declaração ou função. Adicionar processo novo passa a ser acrescentar um registro, não escrever código de integração.
- **Autenticação nas rotas novas**: as rotas do agente e do apLIS validam o token do Supabase no servidor, e o `staffId` passa a vir do backend autenticado em vez de ser aceito do navegador.
- **BREAKING** — `POST /api/send-text` passa a exigir identificação do atendente. Chamadas sem `staffId` válido são rejeitadas.

### Fora de escopo neste MVP

Dashboard de avaliação, OCR de documentos, chat tira-dúvidas, banco de dados, e o processo de protocolo de acesso (depende do cadastro de um item Insight na Lacuna). Todos previstos para fases seguintes.

## Capabilities

### New Capabilities

- `deteccao-intencao`: classificação da intenção do paciente a partir das últimas 30 mensagens, extração de identificadores, limiar de confiança e cache por conversa.
- `consulta-aplis`: cliente de integração somente leitura com o apLIS — lista branca de comandos, busca de requisição por paciente, desambiguação de múltiplos resultados e janela de datas.
- `catalogo-processos`: motor de processos com ciclo de vida único e escotilha por etapa, que liga intenção detectada a consulta e apresentação.
- `painel-agente`: componente acima do campo de digitação — cartão de dados, resposta pronta preenchida, inserção sem envio, avisos por severidade e marcação clínica/paciente.
- `deteccao-pendencias`: regras de pendência (lida, sem resposta, relógio de expediente, dona da pendência, dispensa temporária) e seus três canais de notificação.
- `seguranca-agente`: autenticação das rotas, atribuição confiável do atendente, restrição de dado sensível em log e habilitação por atendente para o piloto.

### Modified Capabilities

Nenhuma. O diretório `openspec/specs/` está vazio — este é o primeiro conjunto de specs do projeto.

## Impact

**Código afetado**
- `server.js` — rotas novas (`/api/agent/*`, `/api/aplis/*`), middleware de autenticação, configuração do apLIS e do Gemini
- `public/app.js` — disparo da análise ao abrir conversa, cache por `chatId` + última mensagem, render do painel, cálculo e notificação de pendências
- `public/index.html` / `public/style.css` — painel acima do input, badge no rail, cores de severidade
- `public/quick_responses.js` — intocado; templates novos do agente ficam em arquivo separado
- `vercel.json` — `functions.maxDuration`

**Arquivos novos**
- `lib/aplisClient.js`, `lib/processos/` (catálogo), `public/parceiros.js`, `public/agent_templates.js`

**Dependências**
- `@google/genai` (Gemini 3.5 Flash-Lite)
- Nenhum driver de banco — a consulta usa a API do apLIS, não o espelho MySQL

**Sistemas externos**
- apLIS (instância de produção) via HTTPS + Basic Auth, somente leitura
- Supabase (já em uso) para validar o token nas rotas novas

**Restrições de plataforma**
- Vercel Hobby impõe 10s por função: nenhuma rota combina classificação, consulta e renderização numa só chamada

**Riscos de segurança que este change endereça**
- Hoje **nenhuma rota é autenticada**. Expor consulta de dado de paciente sem autenticação seria muito mais grave que o proxy atual da WAHA, por isso a autenticação entra na primeira fase e não na última.
