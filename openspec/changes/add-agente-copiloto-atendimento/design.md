## Context

A aplicação é uma interface tipo WhatsApp Web sobre a API WAHA: Express (`server.js`) como proxy sem estado, front em JS puro (`public/app.js`, ~1950 linhas dentro de um único `DOMContentLoaded`), autenticação via Supabase, deploy na Vercel. Hoje não há persistência de negócio nenhuma — o Supabase é usado apenas para ler perfil no login.

Três restrições da plataforma moldam todo o desenho:

- **Vercel Hobby impõe 10 segundos por função.** Nenhuma rota pode encadear classificação, consulta e renderização numa única chamada.
- **Não existe processo persistente.** Sem worker, sem fila, sem `setTimeout` que sobreviva à resposta. O navegador é o relógio do sistema.
- **SSE não é confiável em serverless.** O caminho real de atualização já é o polling de 4 segundos em `startSmartPollingSync()`; nada aqui deve depender de SSE.

Duas restrições de segurança herdadas importam: **nenhuma rota é autenticada hoje**, e a credencial do apLIS autoriza tanto leitura quanto escrita de requisições de pacientes.

Os números que justificam prioridade vêm de 4.074 atendimentos reais analisados: ~41% do volume é consulta de leitura, "laudo" isolado é 21,5%, e pendência sem resposta aparece em 52 dos 62 dias.

## Goals / Non-Goals

**Goals:**
- Entregar a informação do apLIS dentro do chat, sem o atendente trocar de sistema
- Sinalizar conversas esquecidas sem interromper quem está trabalhando
- Construir um motor onde processo novo é configuração, não código de integração
- Fechar o furo de autenticação antes de expor qualquer dado de paciente
- Manter o sistema funcionando exatamente como hoje quando o agente estiver desligado

**Non-Goals:**
- Dashboard de avaliação por atendente (exige acúmulo entre dias, portanto banco)
- OCR de documentos enviados pelo paciente
- Chat tira-dúvidas para o atendente
- Redação de texto por modelo de linguagem
- Envio automático de qualquer mensagem ou anexo ao paciente
- Escrita no apLIS, em qualquer hipótese

## Decisions

### Consulta pela API do apLIS, não pelo espelho MySQL

Havia a opção de consultar um banco espelho do apLIS com atraso de 1 dia, acessível externamente com usuário de privilégio total. Um teste contra `requisicaoListar` com a credencial de integração mostrou que ela é de **usuário interno** — o nível que aceita busca por `nomPaciente` ("Nome ou CPF") e devolve `CodRequisicao`, `NomPaciente`, `CPF`, `NomExame`, `DtaPrevista`, `DesEvento` e `StatusExame` em uma chamada, sem atraso.

O espelho perde nos três eixos: introduz janela de 1 dia em que o sistema responde "não encontrei" para quem coletou ontem — justamente a intenção mais frequente —, expõe a base de pacientes fora da rede com superusuário, e ainda assim exige a API depois para status e laudo. **Decisão: usar apenas a API.** O banco volta à discussão se aparecer consulta agregada que a API não cubra, aí com usuário restrito a `SELECT`.

**Atualização:** essa condição apareceu — ver "Cortesia/convênio: banco espelho, não a API" abaixo. A decisão de usar só a API continua valendo para tudo que a API já cobre; o espelho volta só para o que ela não cobre, e só com esse escopo.

### Lista branca de comandos, em vez de política de não escrever

"Não escrever no apLIS" como regra escrita depende de todo mundo lembrar. O `aplisClient` aceita apenas seis comandos de leitura e rejeita qualquer outro antes de montar a requisição. `admissaoSalvar` e `requisicaoCancelar` não são proibidos — são inconstruíveis. Isso também protege contra injeção via mensagem de paciente, já que o texto do paciente nunca vira nome de comando.

### Ciclo de vida único com escotilha por etapa

A alternativa natural — declarativo para processo simples e código para processo complexo — cria dois sistemas paralelos: ninguém sabe qual usar no processo seguinte, e as garantias valem num caminho e não no outro.

Aqui existe um motor só. Todo processo passa por detectar → buscar → renderizar → avisar, e **cada etapa** aceita declaração ou função. Um processo pode ter busca em código e renderização declarativa. As garantias — lista branca, confirmação, cache, teto de consumo — vivem no motor, então um processo escrito em função também não consegue contornar a confirmação nem alcançar as credenciais, porque ele pede a consulta ao motor em vez de falar com o apLIS.

Critério de uso: uma chamada mais mapeamento de campos é declaração; condicional, encadeamento ou manipulação de arquivo é função. Os três processos iniciais devem sair 100% declarativos — se `previsao_entrega` precisar de código, o motor está errado e conserta-se antes de acumular processo em cima.

### Análise na abertura da conversa, com cache por última mensagem

Analisar a cada mensagem recebida geraria milhares de chamadas por dia e recalcularia enquanto o paciente ainda digita. Analisar na abertura entrega a informação no momento em que o atendente vai agir, reduz o volume em uma ordem de grandeza e resolve sozinho o paciente que manda seis mensagens seguidas — a análise roda uma vez, sobre as 30.

O cache é indexado por `chatId` + id da última mensagem, no navegador. Reabrir conversa sem mensagem nova é instantâneo e gratuito; mensagem nova muda a chave e recalcula. Alternar entre conversas, que é o comportamento real do atendente, deixa de custar.

### Intenção como lista fechada, com campo de descoberta

Texto livre de intenção não é acionável: cada dia inventa um rótulo diferente e nada consegue escolher template ou medir. A saída usa JSON Schema com enum fechado — hoje cinco valores (quatro atendidos mais `outro`; nasceu com três atendidos, `orientacao_preparo` entrou depois, ver decisão abaixo).

O `outro` carrega texto livre descritivo e vai para log estruturado no servidor, sem `chatId`, CPF ou nome. Ao fim do piloto, o ranking dos `outro` é a lista priorizada do que mapear em seguida — que é exatamente a dúvida em aberto sobre quais processos o atendimento executa. Confiança alta em `outro` não é exibida no painel como "intenção detectada" (isso já foi um bug real: o campo de descoberta virando um rótulo sem sentido na tela do atendente) — vira silêncio, igual à confiança baixa.

### Orientação de preparo: 4ª intenção, fora do motor de processos

Testado ao vivo: um paciente perguntou "quais são as indicações do que eu devo fazer antes de um exame de sangue" e o painel não sugeriu nada. Causa: a lista fechada de intenções não tinha essa categoria — caía em `outro`, sem processo mapeado. Mas a Resposta Rápida `PREPARO` (`public/quick_responses.js`) já cobre exatamente isso.

A diferença que importa: os três processos do MVP são todos sobre a situação de UMA requisição específica (`buscar: {tipo: 'consultarPaciente'}`, via `lib/processos/motor.js`, que por desenho exige identificador antes de rodar — ver "Ciclo de vida único com escotilha por etapa"). Preparo de exame não é sobre nenhuma requisição: a instrução é a mesma para qualquer paciente. Forçar isso pelo motor exigiria inventar uma consulta ao apLIS que não faz sentido, só para satisfazer um contrato pensado para outra coisa.

Solução: `orientacao_preparo` é uma 4ª intenção reconhecida pelo classificador, mas resolvida por um caminho paralelo e mais simples — `lib/agent/respostas_faq.js`, um dicionário `intencao -> resposta`, consultado direto em `POST /api/agent/analisar` (nunca em `/api/aplis/consultar`, nunca via `calcularSugestoes`/`CATALOGO_PROCESSOS`). Duas decisões dentro dela:
- **Nunca passa pelo redator (LLM).** Instruções de preparo (jejum, coleta de amostra) são quase-clínicas — reparafraseá-las arrisca alterar um detalhe que importa (duração do jejum, por exemplo). O texto sai literal da Resposta Rápida `PREPARO`, nunca gerado.
- **Não pede identificador.** O painel, ao detectar essa intenção, não mostra "Consultar" nem pede CPF — a sugestão já chega pronta na resposta de `/api/agent/analisar` e entra direto no estágio de revelação (`revelarSugestoesEmEstagio`), igual à sugestão que vem depois de um cartão de paciente.

Fica como padrão para o próximo item do ranking de `outro` que também não depender de dado do paciente (horário de funcionamento, endereço — já existem como Respostas Rápidas prontas): mesmo dicionário, sem tocar no motor de processos.

### Cortesia/convênio: banco espelho, não a API

Testado ao vivo: "Meus exames foram feitos como cortesia, certo?" também não gerava sugestão — mesmo padrão do preparo de exame, mas com uma diferença importante: essa pergunta É sobre uma requisição específica do paciente (identificador continua obrigatório), então não cabia no caminho do `orientacao_preparo`.

Investigação, nesta ordem, antes de escrever qualquer código:
1. `requisicaoListar`/`requisicaoStatus` (os dois que o sistema já usa): confirmado ao vivo, com uma requisição real, que nenhum dos dois devolve convênio/fonte pagadora.
2. `requisicaoResultado` (permitido no `aplisClient`, nunca usado): a documentação (`Docs/APLIS_API_Documentation.pdf`) confirma que ele traz `paciente.convenio` — mas embutido junto do laudo clínico completo (diagnósticos, laudo micro/macro, patologista, lâminas...). Buscar isso só para saber "foi cortesia?" significa trazer e processar dado clínico sensível muito além do necessário, e só funciona depois do laudo pronto.
3. `faturamentoLoteListar` (também permitido): devolve lotes agregados de faturamento — `FontePagadora` por lote, não por requisição — e cruza dados de muitos pacientes/convênios diferentes num só retorno. Não serve para uma pergunta individual sem vazar informação de outros pacientes.
4. A documentação da API revelou o conceito: `instituicaoSalvar.segmento` classifica formalmente uma instituição como `10 – Cortesia` (também `7 – Particular`, `11 – Convênio`). "Cortesia" é uma propriedade da fonte pagadora/convênio vinculada à requisição, não um campo direto nela.
5. Nenhum comando de leitura da API expõe essa classificação de forma barata e isolada. Essa é exatamente a condição que a decisão original (acima) previa para reabrir a discussão do banco espelho.

Exploração do espelho (somente leitura, sem escrever nada): `requisicao.IdFontePagadora` e `requisicao.IdConvenio` apontam para `fatinstituicao.IdInstituicao`/`fatconvenio.IdConvenio`. Testado contra a mesma requisição real: `fatinstituicao.NomFantasia` veio literalmente `"Cortesia"` — confirmando o dado. O campo `Segmento` desse mesmo registro veio `0`, não `10` como a documentação da API descreve para `instituicaoSalvar` — por isso a implementação (`lib/db/convenio.js`) decide pelo **nome** ("CORTESIA"/"PARTICULAR", comparação sem acento/caixa), não pelo `Segmento`, que se mostrou não confiável neste banco.

**Decisão:** `lib/db/mirrorClient.js` é um cliente MySQL só para esta consulta — uma função nomeada, parametrizada por código de requisição exato (nunca por CPF/nome: a desambiguação de paciente já aconteceu na camada do apLIS antes disto rodar), mesma disciplina de lista branca do `aplisClient` (nenhuma query livre, nenhuma escrita). O resultado é anexado à `situacao` em `server.js`, antes de `calcularSugestoes`, e um 4º processo (`situacao_pagamento`, em `catalogo.js`) o transforma em sugestão — **sem passar pelo redator**: é uma confirmação factual (cortesia/particular/convênio), e reparafraseá-la arrisca inverter o sentido, mesmo raciocínio do `orientacao_preparo`.

**Risco mitigado:** a credencial do espelho era a mesma de superusuário (root) que já existia no `.env` antes da decisão original de API-only. Trocada por `agente_atendimento_ro`, um usuário com `GRANT SELECT` restrito a `requisicao`, `fatinstituicao` e `fatconvenio` — verificado ao vivo: lê as três, recusa `SELECT` em qualquer outra tabela e recusa qualquer escrita. O contrato "só leitura" agora é garantido em duas camadas: pela disciplina do código (`mirrorClient.js` só expõe uma função, um SELECT fixo) e pelo próprio banco (ver tasks.md 1.7).

Achado ao provisionar o usuário: o handshake de conectar já **dentro** de um banco (opção `database` do driver) exige um nível de privilégio diferente do que `GRANT SELECT` por tabela concede — o MySQL recusa a conexão com `ER_DBACCESS_DENIED_ERROR` mesmo com as tabelas corretamente concedidas. A correção foi conectar sem banco padrão e qualificar cada tabela (`lab.requisicao`, etc.) diretamente nas queries, onde a checagem já é por tabela.

**Limitação aceita:** o espelho tem atraso de ~1 dia. Uma requisição admitida hoje pode não aparecer ainda — `situacao_pagamento` degrada para "sem sugestão" nesse caso (nunca erro, nunca resposta errada), igual a qualquer outra falha do espelho.

### Gemini 3.5 Flash-Lite com limiar de confiança

A tarefa é classificação com enum de valores fechado mais extração de campos, não redação. No volume estimado (~255 chamadas/dia com o cache), o custo fica em torno de US$ 7/mês, contra ~US$ 31 do Flash.

O modelo mais barato erra mais, e o modo de falha importa: intenção errada exibida com confiança faz o atendente parar de olhar para o painel, e o projeto morre por desuso. Por isso o limiar de confiança é parte do desenho, não refinamento — abaixo dele o painel diz que não identificou. Errar em silêncio é recuperável. O piloto mede a taxa real e a troca de modelo é uma variável de configuração.

### Identidade do atendente pelo servidor, prefixo como reserva

O front hoje prefixa toda mensagem enviada com `Nome Sobrenome:`. Isso é útil, mas frágil: a base atual tem 13 identidades para 12 pessoas — um mesmo atendente aparece em até três grafias, e outro ora com sobrenome ora sem. Casar atendente por string misturaria gente numa métrica que avalia pessoas.

A fonte primária passa a ser o token validado no servidor. O prefixo fica como fonte secundária, para mensagem enviada por fora do sistema. Sem nenhuma das duas, a mensagem é marcada como não atribuída — nunca chutada.

### Autenticação na primeira fase, não na última

O plano inicial deixava autenticação para o endurecimento final. Isso significaria uma janela em que `/api/aplis/consultar` responde consulta de paciente para qualquer um que descubra a URL. Como `/api/auth/login` já devolve `session.accessToken`, validar esse token no servidor resolve autenticação e identidade do atendente de uma vez, com pouco código.

### Notificação em três canais, sem modal

Pop-up modal a cada 8 minutos, com ~85 conversas ativas por dia, interromperia o atendente no meio da digitação. O desenho usa contador permanente no rail, painel com a lista filtrada, e aviso temporário agregado com intervalo mínimo de 5 minutos — o padrão de WhatsApp Web e Slack, que não exige treinamento. Modal fica reservado para o caso crítico acima de 3 horas, se o time quiser depois.

### Relógio de pendência limitado ao expediente

Sem isso, toda segunda-feira nasce com dezenas de pendências de 60 horas vindas do fim de semana, e o contador perde o sentido logo no primeiro dia de uso.

### Laudo pronto avisa e aponta para o portal

`requisicaoLaudo` devolve o PDF em base64 e o sistema já sabe enviar arquivo — tecnicamente daria para anexar sozinho. Isso faria o agente despachar resultado clínico para um número de WhatsApp com base em identificação digitada no chat. Se o número for de um familiar, ou o CPF estiver errado, o vazamento não tem volta. O fluxo mantém o que o laboratório já faz: avisa que está pronto e aponta para o portal, onde o paciente entra com as credenciais dele.

### Sugestão baseada nas Respostas Rápidas existentes, com fallback determinístico

Decisão original (Q7/Q12 da sessão de grilling): sem LLM redigindo, só template fixo com lacunas — para não arriscar tom ou dado errado. Pedido posterior do usuário reabriu isso: a sugestão deveria se basear no catálogo de 65 Respostas Rápidas já em uso (`public/quick_responses.js`, nunca alterado) e no contexto real da conversa, não copiando o atalho ao pé da letra.

A saída usa a escotilha por etapa que o motor já previa (Q33): a etapa de `renderizar` dos três processos do MVP passou de declaração para função. Essa função pede ao redator (`lib/agent/redator.js`, Gemini) uma mensagem ancorada em (1) os fatos já confirmados no apLIS — nunca o nome, CPF ou código do paciente, que o modelo não precisa ver —, (2) um trecho de referência de estilo copiado de uma Resposta Rápida (`lib/processos/referencias_respostas_rapidas.js`, cópias deliberadamente expurgadas de "[Nome da Paciente]" e da auto-apresentação fixa por nome — "Me chamo Thainá" etc — que os originais carregam: copiar isso ao pé da letra seria uma mentira institucional toda vez que outro atendente usasse), e (3) as últimas mensagens da conversa, quando disponíveis.

**Seleção da referência é dinâmica, não travada por processo.** Na primeira versão, cada processo apontava para uma única referência fixa (`previsao_entrega`→`biologiamolecular`, etc.), decidida em tempo de escrita do catálogo. Isso não respondia de fato ao pedido de "se basear no contexto": o mesmo processo sempre citava o mesmo estilo, mesmo quando a conversa pedia outro (ex.: paciente perguntando sobre atraso, mas o processo só conhecia o texto de prazo padrão). A correção: `lib/processos/catalogo.js` monta um pool com **todas** as referências curadas (hoje 7, extraídas da categoria "Laudos & Exames" do catálogo de 65) e oferece o mesmo pool aos três processos; o próprio redator escolhe, a cada chamada, qual (se alguma) se encaixa no que a conversa real está pedindo, e relata isso via `baseadoEmId` no JSON estruturado de saída. `sanitizarRedacao` valida esse id contra a lista que foi de fato oferecida — um id fora da lista (alucinação do modelo) é descartado, nunca repassado como se fosse dado confiável.

Se o redator não estiver configurado ou falhar (rede, timeout, resposta vazia), a mesma função cai no template fixo original — o mecanismo determinístico continua existindo e testado, agora como rede de segurança em vez de único caminho. As três chamadas ao redator (uma por processo) rodam em paralelo: ~3,2s em série virou ~1,5s.

Testado ao vivo (via chamada direta ao redator e via `calcularSugestoes`, o caminho real): a mesma situação (exame, status, previsão) gera texto diferente dependendo da conversa, e a referência escolhida muda com o contexto — "meu exame está atrasado" resultou em `baseadoEmId: 'atraso'`, "quando fica pronto meu exame de biologia molecular" em `baseadoEmId: 'biologiamolecular'`, e uma paciente ansiosa perguntando se já ficou pronto em `baseadoEmId: 'dispo'` — sem que nenhum fato fosse inventado em nenhum dos casos.

## Risks / Trade-offs

**Classificação errada de intenção com modelo econômico** → Limiar de confiança exibe indefinição em vez de intenção errada; piloto de duas semanas mede a taxa real; troca de modelo é configuração.

**Homônimo na busca por nome** → Múltiplos pacientes distintos forçam escolha explícita do atendente, sem sugestão montada antes da seleção. É a barreira que evita repetir o incidente de privacidade já registrado nos relatórios.

**Teto de 10s da Vercel** → Uma etapa por requisição, `AbortController` em 8s, e falha degrada para "sem sugestão" — nunca bloqueia o envio de mensagem.

**Sugestão errada chegar ao paciente** → Nenhum envio automático. O painel apenas preenche o campo, e todo dado exibido mostra o código da requisição para conferência.

**Custo fora de controle em dia atípico** → Cache por conversa, teto diário por atendente, habilitação por lista de atendentes, e desligamento global. **Limitação conhecida:** o teto diário (`lib/agent/limitador.js`) é um contador em memória do processo — correto no VPS/processo único de hoje, mas não soma entre instâncias se o deploy for serverless com múltiplas réplicas simultâneas, nem sobrevive a um cold start. Vira teto por instância, não teto global, até esse contador migrar para um armazenamento compartilhado.

**Motor de processos ainda não é o caminho real de busca** → `lib/processos/motor.js` e `lib/processos/ferramentas.js` têm o ciclo completo (buscar → renderizar, com a escotilha por etapa) testado e correto isoladamente, mas a rota `/api/aplis/consultar` de produção ainda chama `consultarPorCodigo`/`buscarPorPaciente` direto, sem passar pelo motor; `lib/processos/sugestoes.js` também monta sua própria ferramenta local em vez de reutilizar `ferramentas.js`. A garantia de "todo processo só toca o apLIS através do motor" está provada em teste, não em produção. Fica para a fiação completa da #6 — trocar a rota para `executarProcesso` + `criarFerramentasProcesso` de verdade.

**Ausência de trilha de auditoria de acesso a paciente** → Consequência aceita da decisão de não usar banco. Mitigação parcial: log estruturado no servidor com atendente e código de requisição, sem dado identificável. Resolve-se de fato quando a fase do dashboard introduzir persistência.

**Regressão na interface existente** → Com o agente desligado, o comportamento deve ser idêntico ao atual; isso é requisito verificável, não expectativa.

**Credenciais expostas durante o planejamento** → As credenciais do apLIS e do banco espelho circularam fora de cofre e devem ser rotacionadas antes do início da implementação. O acesso externo ao banco espelho deve ser desativado, já que a decisão de usar a API tornou o espelho desnecessário.

## Migration Plan

1. **Pré-requisitos operacionais** — rotacionar credenciais do apLIS, desativar o túnel do MySQL, solicitar à Lacuna credencial de integração somente leitura, confirmar conta Gemini em tier pago.
2. **Autenticação primeiro** — middleware de validação de token nas rotas novas, antes de qualquer rota que exponha dado de paciente.
3. **Consulta manual** — `aplisClient` e rota de consulta, acionados por código digitado, sem modelo envolvido. Valida credencial, rede e normalização isoladamente.
4. **Motor e catálogo** — ciclo de vida e os três processos declarativos.
5. **Classificação de intenção** — integração com o modelo, cache e limiar.
6. **Pendências** — cálculo no cliente e os três canais de notificação.
7. **Piloto** — dois atendentes, um de alto e um de baixo volume, por duas semanas.

**Rollback:** desligar o agente pela configuração global restaura o comportamento atual sem redeploy. Como não há migração de dados nem escrita em sistema externo, não existe estado a reverter.

## Open Questions

- Qual o horário de expediente a configurar, e se há diferença entre dias da semana e sábado.
- Qual o limiar de confiança inicial — sugerido começar conservador e calibrar com os dados do piloto.
- Quais contatos entram previamente marcados como clínica parceira em `parceiros.js`.
- Se o teto diário de chamadas por atendente deve ser uniforme, dado que o volume por pessoa varia de ~2 a ~28 conversas por dia.
