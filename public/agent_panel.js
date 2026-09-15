// Painel do agente acima do campo de digitação. Neste estágio: consulta manual no
// apLIS por código de requisição, CPF ou nome. Nunca envia mensagem — só mostra.
(function () {
  const SITUACAO_LABEL = { em_andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado', desconhecido: '—' };
  const JANELA_PADRAO_DIAS = 90;

  let panel, body, form, input, btn, toggleBtn, minimizeBtn, bubble, bubbleBadge;
  // Cada consulta carrega a geração em que nasceu; reset() avança a geração e
  // qualquer resposta de geração antiga é descartada — nada de um chat cai no outro.
  let geracao = 0;
  // Resultado da última busca por paciente, para navegar entre requisições sem nova chamada.
  let pacientesDaBusca = [];
  // Quando a busca partiu de uma intenção detectada (#5), guarda qual — para
  // destacar só a resposta correspondente em vez das três possíveis.
  let somenteIntencaoAtual = null;
  // 'deteccao' | 'manual' | null — uma detecção nova pode substituir outra
  // detecção, mas nunca uma busca manual que o atendente já iniciou.
  let origemConteudoAtual = null;
  // Id do chat aberto, só para buscar o contexto de conversa já analisado por
  // agent_intent.js (não guardamos as mensagens aqui, evita duplicar estado).
  let chatIdAtual = null;
  // Painel encolhido a uma bolinha; o conteúdo continua sendo atualizado por
  // baixo, só não é mostrado até o atendente reabrir.
  let minimizado = false;
  // Quantas sugestões da renderização MAIS RECENTE ainda não foram vistas —
  // nunca uma soma histórica: cada render substitui esse número pelo que vale
  // agora, então uma sugestão de um contexto já superado nunca fica contada.
  let sugestoesNaoVistas = 0;

  function escapeHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function definirContagemNaoVistas(n) {
    sugestoesNaoVistas = n;
    if (!bubbleBadge) return;
    if (n > 0) {
      bubbleBadge.textContent = n > 9 ? '9+' : String(n);
      bubbleBadge.classList.remove('hidden');
    } else {
      bubbleBadge.classList.add('hidden');
    }
  }

  function mostrarBolha() {
    if (bubble) bubble.classList.remove('hidden');
  }

  function esconderBolha() {
    if (bubble) bubble.classList.add('hidden');
  }

  // Reabre o painel cheio — seja vindo de minimizado, seja do botão de
  // alternar na barra de ferramentas. Reabrir sempre marca como "visto".
  function abrir() {
    minimizado = false;
    esconderBolha();
    definirContagemNaoVistas(0);
    panel.classList.remove('hidden');
    toggleBtn.classList.add('active');
    input.focus();
  }

  // Dispensa por completo: some o painel E a bolinha, nada fica pendente.
  function fechar() {
    minimizado = false;
    panel.classList.add('hidden');
    toggleBtn.classList.remove('active');
    esconderBolha();
    definirContagemNaoVistas(0);
  }

  // Encolhe para a bolinha — o conteúdo permanece no DOM, só escondido; o
  // contador é quem os próximos renders forem calculando, nunca somado aqui.
  function minimizar() {
    minimizado = true;
    panel.classList.add('hidden');
    toggleBtn.classList.remove('active');
    mostrarBolha();
  }

  // Ao trocar de conversa, nada do painel pode sobreviver: evita vazar dado de um chat para outro.
  function reset(chatId) {
    geracao++;
    pacientesDaBusca = [];
    somenteIntencaoAtual = null;
    origemConteudoAtual = null;
    chatIdAtual = chatId || null;
    body.innerHTML = '';
    input.value = '';
    btn.disabled = false;
    fechar();
  }

  // ---------------------------------------------------------------------------
  // Renderizações
  // ---------------------------------------------------------------------------
  function renderCarregando(texto) {
    body.innerHTML = `<div class="agent-estado"><i class="ph-bold ph-spinner spinner"></i> ${escapeHtml(texto)}</div>`;
    if (minimizado) definirContagemNaoVistas(0);
  }

  function renderErro(mensagem, detalhe) {
    body.innerHTML = `
      <div class="agent-estado agent-estado-erro">
        <i class="ph-bold ph-warning-circle"></i>
        <div><strong>${escapeHtml(mensagem)}</strong>${detalhe ? `<div class="agent-estado-detalhe">${escapeHtml(detalhe)}</div>` : ''}</div>
      </div>`;
    if (minimizado) definirContagemNaoVistas(0);
  }

  function renderNaoEncontrado({ tipo, termo, janelaDias }) {
    const periodo = janelaDias === JANELA_PADRAO_DIAS ? 'nos últimos 90 dias' : 'nos últimos 24 meses';
    const rotulo = tipo === 'codigo' ? `o código <strong>${escapeHtml(termo)}</strong>` : `<strong>${escapeHtml(termo)}</strong>`;
    const podeAmpliar = tipo !== 'codigo' && janelaDias === JANELA_PADRAO_DIAS;
    body.innerHTML = `
      <div class="agent-estado">
        <i class="ph-bold ph-magnifying-glass"></i>
        <div>
          Nenhuma requisição para ${rotulo} ${periodo}.
          ${podeAmpliar ? `<div class="agent-acoes"><button type="button" class="agent-btn-secundario" id="agent-ampliar-btn"><i class="ph-bold ph-calendar-blank"></i> Buscar nos últimos 24 meses</button></div>` : ''}
        </div>
      </div>`;
    const ampliarBtn = document.getElementById('agent-ampliar-btn');
    if (ampliarBtn) ampliarBtn.addEventListener('click', () => consultar(termo, { ampliar: true }));
    if (minimizado) definirContagemNaoVistas(0);
  }

  const LABEL_PROCESSO = { previsao_entrega: 'Previsão de entrega', status_exame: 'Status do exame', laudo_disponivel: 'Laudo / portal' };

  function cartaoHtml(r) {
    const status = r.statusCliente || r.status || '—';
    return `
      <div class="agent-cartao">
        <div class="agent-cartao-linha agent-cartao-topo">
          <span class="agent-cartao-codigo" title="Código da requisição">${escapeHtml(r.codRequisicao)}</span>
          <span class="agent-chip agent-chip-${escapeHtml(r.situacao)}">${escapeHtml(SITUACAO_LABEL[r.situacao] || r.situacao)}</span>
        </div>
        <dl class="agent-cartao-grid">
          <dt>Paciente</dt><dd>${escapeHtml(r.paciente || '—')}</dd>
          <dt>Exame</dt><dd>${escapeHtml(r.exame || '—')}</dd>
          <dt>Status</dt><dd>${escapeHtml(status)}</dd>
          <dt>Previsão</dt><dd>${escapeHtml(r.dtaPrevista || '—')}</dd>
          ${r.dtaFinalizacao ? `<dt>Finalizado</dt><dd>${escapeHtml(r.dtaFinalizacao)}</dd>` : ''}
        </dl>
        <div class="agent-cartao-origem"><i class="ph-bold ph-database"></i> Origem: apLIS, requisição ${escapeHtml(r.codRequisicao)}</div>
      </div>`;
  }

  // Filtra uma vez só; o resultado alimenta tanto o HTML quanto os botões, para
  // o índice data-sugestao nunca poder desalinhar do array que os liga.
  function filtrarSugestoes(sugestoes, somenteIntencao) {
    return somenteIntencao ? sugestoes.filter((s) => s.intencao === somenteIntencao) : sugestoes;
  }

  // Respostas prontas calculadas pelo servidor a partir da mesma situação do
  // cartão. "Inserir" só preenche o campo — nunca envia.
  function sugestoesHtml(lista) {
    if (!lista.length) return '';
    return `
      <div class="agent-lista-titulo">Respostas prontas</div>
      <div class="agent-sugestoes">
        ${lista.map((s, i) => `
          <div class="agent-sugestao">
            <div class="agent-sugestao-cabecalho">
              <span class="agent-sugestao-rotulo">${escapeHtml(LABEL_PROCESSO[s.processoId] || s.processoId)}</span>
              <button type="button" class="agent-btn-inserir" data-sugestao="${i}"><i class="ph-bold ph-arrow-bend-up-left"></i> Inserir</button>
            </div>
            <p class="agent-sugestao-texto">${escapeHtml(s.texto)}</p>
          </div>`).join('')}
      </div>`;
    }

  function ligarBotoesInserir(container, sugestoes) {
    container.querySelectorAll('.agent-btn-inserir').forEach((el) => {
      el.addEventListener('click', () => {
        const s = sugestoes[Number(el.dataset.sugestao)];
        if (s && window.inserirNoCampoDeMensagem) window.inserirNoCampoDeMensagem(s.texto);
      });
    });
  }

  const ATRASO_ESTAGIO_SUGESTAO_MS = 420;

  // A informação (cartão) já está na tela quando isto é chamado. A sugestão
  // só entra depois de um instante, num segundo estágio visualmente
  // distinto — para ler como "achou o dado -> preparou uma resposta", igual
  // ao passo a passo do Claude, em vez de tudo despejado de uma vez.
  function revelarSugestoesEmEstagio(sugestoesFiltradas) {
    if (!sugestoesFiltradas.length) {
      if (minimizado) definirContagemNaoVistas(0);
      return;
    }
    const estagio = document.createElement('div');
    estagio.className = 'agent-estagio-sugestao';
    estagio.innerHTML = '<i class="ph-bold ph-sparkle"></i> Preparando resposta sugerida' +
      '<span class="agent-dots"><span></span><span></span><span></span></span>';
    body.appendChild(estagio);

    const minhaGeracao = geracao;
    setTimeout(() => {
      if (minhaGeracao !== geracao || !estagio.isConnected) return;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = sugestoesHtml(sugestoesFiltradas);
      estagio.replaceWith(...wrapper.childNodes);
      ligarBotoesInserir(body, sugestoesFiltradas);
      if (minimizado) definirContagemNaoVistas(sugestoesFiltradas.length);
    }, ATRASO_ESTAGIO_SUGESTAO_MS);
  }

  function renderCartao(r, opts = {}) {
    const sugestoesFiltradas = filtrarSugestoes(r.sugestoes || [], opts.somenteIntencao);
    body.innerHTML = cartaoHtml(r);
    revelarSugestoesEmEstagio(sugestoesFiltradas);
  }

  // Recolhida por padrão: é contexto de apoio, não o que o atendente pediu
  // agora — não deve competir por espaço com o cartão e a sugestão.
  function outrasRequisicoesHtml(outras) {
    if (!outras.length) return '';
    return `
      <button type="button" class="agent-lista-toggle" id="agent-outras-toggle">
        <i class="ph-bold ph-caret-right"></i> Outras requisições deste paciente (${outras.length})
      </button>
      <ul class="agent-lista hidden" id="agent-outras-lista">
        ${outras.map(({ r, i }) => `
          <li><button type="button" class="agent-lista-item" data-indice="${i}">
            <span class="agent-lista-principal">${escapeHtml(r.exame || 'Exame')}</span>
            <span class="agent-lista-secundario">${escapeHtml(r.dtaSolicitacao || '')} · ${escapeHtml(SITUACAO_LABEL[r.situacao] || '')}</span>
          </button></li>`).join('')}
      </ul>`;
  }

  function ligarOutrasRequisicoes(paciente, opts) {
    const toggle = document.getElementById('agent-outras-toggle');
    const lista = document.getElementById('agent-outras-lista');
    if (toggle && lista) {
      toggle.addEventListener('click', () => {
        lista.classList.toggle('hidden');
        toggle.classList.toggle('aberto');
      });
    }
    body.querySelectorAll('.agent-lista-item').forEach((el) => {
      el.addEventListener('click', () => renderPaciente(paciente, Number(el.dataset.indice), opts));
    });
  }

  // Um único paciente: cartão da requisição em foco + as demais dele, navegáveis sem nova chamada.
  function renderPaciente(paciente, indiceEmFoco = 0, opts = {}) {
    const emFoco = paciente.requisicoes[indiceEmFoco];
    const outras = paciente.requisicoes
      .map((r, i) => ({ r, i }))
      .filter(({ i }) => i !== indiceEmFoco);
    const sugestoesFiltradas = filtrarSugestoes(emFoco.sugestoes || [], opts.somenteIntencao);
    body.innerHTML = cartaoHtml(emFoco) + outrasRequisicoesHtml(outras);
    ligarOutrasRequisicoes(paciente, opts);
    revelarSugestoesEmEstagio(sugestoesFiltradas);
  }

  // Vários pacientes: lista de escolha. Nenhum cartão, nenhuma sugestão, até o atendente escolher.
  function renderEscolha(pacientes, { truncado, total } = {}) {
    const avisoTruncado = truncado
      ? `<div class="agent-estado-detalhe">Mostrando só a primeira página (${escapeHtml(total)} requisições no período). Se o paciente não estiver aqui, busque pelo nome completo ou pelo CPF.</div>`
      : '';
    body.innerHTML = `
      <div class="agent-estado agent-estado-atencao">
        <i class="ph-bold ph-users-three"></i>
        <div><strong>${pacientes.length} pacientes encontrados.</strong> Escolha o correto antes de continuar.${avisoTruncado}</div>
      </div>
      <ul class="agent-lista">
        ${pacientes.map((p, i) => `
          <li><button type="button" class="agent-lista-item" data-indice="${i}">
            <span class="agent-lista-principal">${escapeHtml(p.paciente || 'Sem nome')}</span>
            <span class="agent-lista-secundario">${p.cpfFinal ? `CPF final ${escapeHtml(p.cpfFinal)} · ` : ''}${p.requisicoes.length} requisiç${p.requisicoes.length === 1 ? 'ão' : 'ões'} · última em ${escapeHtml((p.requisicoes[0].dtaSolicitacao || '').slice(0, 10))}</span>
          </button></li>`).join('')}
      </ul>`;
    body.querySelectorAll('.agent-lista-item').forEach((el) => {
      el.addEventListener('click', () => escolherPaciente(Number(el.dataset.indice)));
    });
    if (minimizado) definirContagemNaoVistas(0);
  }

  // Ao escolher, busca o status da requisição mais recente pelo código (aprofunda só o escolhido).
  async function escolherPaciente(indice) {
    const paciente = pacientesDaBusca[indice];
    if (!paciente) return;
    const minhaGeracao = ++geracao;
    renderCarregando(`Carregando ${paciente.paciente || 'paciente'}…`);
    try {
      const data = await chamarConsulta({ termo: paciente.requisicoes[0].codRequisicao });
      if (minhaGeracao !== geracao) return;
      if (data && data.encontrado && data.requisicao) {
        paciente.requisicoes[0] = data.requisicao;
      }
    } catch (e) {
      // Sem status ao cliente, o cartão usa o status interno.
    }
    if (minhaGeracao !== geracao) return;
    renderPaciente(paciente, 0, { somenteIntencao: somenteIntencaoAtual });
  }

  // ---------------------------------------------------------------------------
  // Consulta
  // ---------------------------------------------------------------------------
  const MENSAGEM_POR_TIPO = {
    timeout: 'O apLIS demorou demais para responder. Tente de novo em instantes.',
    rede: 'Não foi possível conectar ao apLIS.',
    nao_configurado: 'Integração com o apLIS não está configurada.'
  };

  // Sempre que possível, anexa o contexto de conversa já analisado por
  // agent_intent.js — assim a sugestão vem ajustada ao que o paciente
  // realmente perguntou, tanto na busca automática (detecção) quanto na
  // manual (o atendente digitou o código/CPF/nome ele mesmo).
  function comContextoDaConversa(corpo) {
    if (corpo.mensagens || !chatIdAtual || !window.agentIntent || typeof window.agentIntent.obterMensagensRecentes !== 'function') {
      return corpo;
    }
    const mensagens = window.agentIntent.obterMensagensRecentes(chatIdAtual);
    return mensagens ? { ...corpo, mensagens } : corpo;
  }

  async function chamarConsulta(corpo) {
    const res = await window.agentFetch('/api/aplis/consultar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comContextoDaConversa(corpo))
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(MENSAGEM_POR_TIPO[data.tipo] || data.error || 'Falha ao consultar o apLIS.');
      err.tipo = data.tipo;
      err.codErro = data.codErro;
      throw err;
    }
    return data;
  }

  async function consultar(termo, { ampliar = false, somenteIntencao = null } = {}) {
    const limpo = String(termo || '').trim();
    if (limpo.length < 3) {
      renderErro('Informe um código de requisição, CPF ou nome com pelo menos 3 caracteres.');
      return;
    }
    somenteIntencaoAtual = somenteIntencao;
    origemConteudoAtual = 'manual';
    const minhaGeracao = ++geracao;
    btn.disabled = true;
    renderCarregando(ampliar ? `Buscando ${limpo} nos últimos 24 meses…` : `Consultando ${limpo}…`);

    try {
      const data = await chamarConsulta({ termo: limpo, ampliar });
      if (minhaGeracao !== geracao) return;

      if (!data.encontrado) {
        renderNaoEncontrado({ tipo: data.tipo, termo: data.termo || data.codRequisicao || limpo, janelaDias: data.janelaDias });
        return;
      }
      if (data.tipo === 'codigo') {
        renderCartao(data.requisicao, { somenteIntencao });
        return;
      }
      pacientesDaBusca = data.pacientes || [];
      if (pacientesDaBusca.length === 1) renderPaciente(pacientesDaBusca[0], 0, { somenteIntencao });
      else renderEscolha(pacientesDaBusca, { truncado: data.truncado, total: data.total });
    } catch (e) {
      if (minhaGeracao !== geracao) return;
      renderErro(e.message || 'Erro de rede ao consultar o apLIS.', e.tipo === 'negocio' && e.codErro ? `Código do erro: ${e.codErro}` : null);
    } finally {
      if (minhaGeracao === geracao) btn.disabled = false;
    }
  }

  // Chamada pelo #5 (agent_intent.js) quando a análise da conversa reconhece
  // uma intenção com confiança suficiente. Só aparece se o painel ainda não
  // tiver nenhum resultado (não sobrescreve uma consulta manual em andamento).
  function mostrarDeteccao({ intencao, confianca, identificadores }) {
    // Uma detecção nova pode atualizar outra detecção (a conversa evoluiu),
    // mas nunca pisa numa busca manual que o atendente já iniciou.
    if (origemConteudoAtual === 'manual') return;
    const termoBusca = (identificadores && (identificadores.codRequisicao || identificadores.cpf || identificadores.nome)) || null;
    const percentual = Math.round((confianca || 0) * 100);

    body.innerHTML = `
      <div class="agent-estado agent-estado-deteccao">
        <i class="ph-bold ph-sparkle"></i>
        <div>
          <strong>Intenção detectada:</strong> ${escapeHtml(LABEL_PROCESSO[intencao] || intencao)} (${percentual}%)
          ${termoBusca
            ? `<div class="agent-acoes"><button type="button" class="agent-btn-secundario" id="agent-consultar-deteccao"><i class="ph-bold ph-magnifying-glass"></i> Consultar</button></div>`
            : `<div class="agent-estado-detalhe">Não encontrei CPF ou código na conversa. Peça o documento ou digite manualmente abaixo.</div>`}
        </div>
      </div>`;

    const btnConsultar = document.getElementById('agent-consultar-deteccao');
    if (btnConsultar) {
      btnConsultar.addEventListener('click', () => consultar(termoBusca, { somenteIntencao: intencao }));
    }
    origemConteudoAtual = 'deteccao';

    // Minimizado, a detecção só atualiza o conteúdo por baixo — não força o
    // painel a reabrir sozinho, e uma intenção sem sugestão pronta ainda não
    // conta como "não vista" no contador.
    if (minimizado) {
      definirContagemNaoVistas(0);
    } else {
      abrir();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    panel = document.getElementById('agent-panel');
    body = document.getElementById('agent-panel-body');
    form = document.getElementById('agent-consulta-form');
    input = document.getElementById('agent-consulta-input');
    btn = document.getElementById('agent-consulta-btn');
    toggleBtn = document.getElementById('agent-toggle-btn');
    minimizeBtn = document.getElementById('agent-panel-minimize');
    bubble = document.getElementById('agent-bubble');
    bubbleBadge = document.getElementById('agent-bubble-badge');
    if (!panel || !body || !form || !input || !btn || !toggleBtn || !minimizeBtn || !bubble || !bubbleBadge) return;

    toggleBtn.addEventListener('click', () => {
      if (panel.classList.contains('hidden')) abrir(); else fechar();
    });
    document.getElementById('agent-panel-close').addEventListener('click', fechar);
    minimizeBtn.addEventListener('click', minimizar);
    bubble.addEventListener('click', abrir);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      consultar(input.value);
    });
  });

  window.agentPanel = { abrir, fechar, reset, consultar, mostrarDeteccao };
})();
