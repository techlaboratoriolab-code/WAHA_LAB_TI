// Painel do agente acima do campo de digitação. Neste estágio: consulta manual no
// apLIS por código de requisição, CPF ou nome. Nunca envia mensagem — só mostra.
(function () {
  const SITUACAO_LABEL = { em_andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado', desconhecido: '—' };
  const JANELA_PADRAO_DIAS = 90;

  let panel, body, form, input, btn, toggleBtn;
  // Cada consulta carrega a geração em que nasceu; reset() avança a geração e
  // qualquer resposta de geração antiga é descartada — nada de um chat cai no outro.
  let geracao = 0;
  // Resultado da última busca por paciente, para navegar entre requisições sem nova chamada.
  let pacientesDaBusca = [];

  function escapeHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function abrir() {
    panel.classList.remove('hidden');
    toggleBtn.classList.add('active');
    input.focus();
  }

  function fechar() {
    panel.classList.add('hidden');
    toggleBtn.classList.remove('active');
  }

  // Ao trocar de conversa, nada do painel pode sobreviver: evita vazar dado de um chat para outro.
  function reset() {
    geracao++;
    pacientesDaBusca = [];
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
  }

  function renderErro(mensagem, detalhe) {
    body.innerHTML = `
      <div class="agent-estado agent-estado-erro">
        <i class="ph-bold ph-warning-circle"></i>
        <div><strong>${escapeHtml(mensagem)}</strong>${detalhe ? `<div class="agent-estado-detalhe">${escapeHtml(detalhe)}</div>` : ''}</div>
      </div>`;
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
  }

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

  function renderCartao(r) {
    body.innerHTML = cartaoHtml(r);
  }

  // Um único paciente: cartão da requisição em foco + as demais dele, navegáveis sem nova chamada.
  function renderPaciente(paciente, indiceEmFoco = 0) {
    const emFoco = paciente.requisicoes[indiceEmFoco];
    const outras = paciente.requisicoes
      .map((r, i) => ({ r, i }))
      .filter(({ i }) => i !== indiceEmFoco);
    body.innerHTML = cartaoHtml(emFoco) + (outras.length ? `
      <div class="agent-lista-titulo">Outras requisições deste paciente</div>
      <ul class="agent-lista">
        ${outras.map(({ r, i }) => `
          <li><button type="button" class="agent-lista-item" data-indice="${i}">
            <span class="agent-lista-principal">${escapeHtml(r.exame || 'Exame')}</span>
            <span class="agent-lista-secundario">${escapeHtml(r.dtaSolicitacao || '')} · ${escapeHtml(SITUACAO_LABEL[r.situacao] || '')}</span>
          </button></li>`).join('')}
      </ul>` : '');
    body.querySelectorAll('.agent-lista-item').forEach((el) => {
      el.addEventListener('click', () => renderPaciente(paciente, Number(el.dataset.indice)));
    });
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
    renderPaciente(paciente, 0);
  }

  // ---------------------------------------------------------------------------
  // Consulta
  // ---------------------------------------------------------------------------
  const MENSAGEM_POR_TIPO = {
    timeout: 'O apLIS demorou demais para responder. Tente de novo em instantes.',
    rede: 'Não foi possível conectar ao apLIS.',
    nao_configurado: 'Integração com o apLIS não está configurada.'
  };

  async function chamarConsulta(corpo) {
    const res = await window.agentFetch('/api/aplis/consultar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
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

  async function consultar(termo, { ampliar = false } = {}) {
    const limpo = String(termo || '').trim();
    if (limpo.length < 3) {
      renderErro('Informe um código de requisição, CPF ou nome com pelo menos 3 caracteres.');
      return;
    }
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
        renderCartao(data.requisicao);
        return;
      }
      pacientesDaBusca = data.pacientes || [];
      if (pacientesDaBusca.length === 1) renderPaciente(pacientesDaBusca[0], 0);
      else renderEscolha(pacientesDaBusca, { truncado: data.truncado, total: data.total });
    } catch (e) {
      if (minhaGeracao !== geracao) return;
      renderErro(e.message || 'Erro de rede ao consultar o apLIS.', e.tipo === 'negocio' && e.codErro ? `Código do erro: ${e.codErro}` : null);
    } finally {
      if (minhaGeracao === geracao) btn.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    panel = document.getElementById('agent-panel');
    body = document.getElementById('agent-panel-body');
    form = document.getElementById('agent-consulta-form');
    input = document.getElementById('agent-consulta-input');
    btn = document.getElementById('agent-consulta-btn');
    toggleBtn = document.getElementById('agent-toggle-btn');
    if (!panel || !body || !form || !input || !btn || !toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
      if (panel.classList.contains('hidden')) abrir(); else fechar();
    });
    document.getElementById('agent-panel-close').addEventListener('click', fechar);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      consultar(input.value);
    });
  });

  window.agentPanel = { abrir, fechar, reset, consultar };
})();
