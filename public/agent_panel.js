// Painel do agente acima do campo de digitação. Neste estágio: consulta manual de
// requisição no apLIS por código. Nunca envia mensagem — só mostra informação.
(function () {
  const SITUACAO_LABEL = { em_andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado', desconhecido: '—' };

  let panel, body, form, input, btn, toggleBtn;
  // Cada consulta carrega a geração em que nasceu; reset() avança a geração e
  // qualquer resposta de geração antiga é descartada — nada de um chat cai no outro.
  let geracao = 0;

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
    body.innerHTML = '';
    input.value = '';
    btn.disabled = false;
    fechar();
  }

  function renderCarregando(cod) {
    body.innerHTML = `<div class="agent-estado"><i class="ph-bold ph-spinner spinner"></i> Consultando ${escapeHtml(cod)}…</div>`;
  }

  function renderErro(mensagem, detalhe) {
    body.innerHTML = `
      <div class="agent-estado agent-estado-erro">
        <i class="ph-bold ph-warning-circle"></i>
        <div><strong>${escapeHtml(mensagem)}</strong>${detalhe ? `<div class="agent-estado-detalhe">${escapeHtml(detalhe)}</div>` : ''}</div>
      </div>`;
  }

  function renderNaoEncontrado(cod) {
    body.innerHTML = `
      <div class="agent-estado">
        <i class="ph-bold ph-magnifying-glass"></i>
        <div>Nenhuma requisição com o código <strong>${escapeHtml(cod)}</strong> nos últimos 24 meses.</div>
      </div>`;
  }

  function renderCartao(r) {
    const status = r.statusCliente || r.status || '—';
    body.innerHTML = `
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

  async function consultar(codRequisicao) {
    const cod = String(codRequisicao || '').replace(/\D/g, '');
    if (!/^\d{13}$/.test(cod)) {
      renderErro('Informe o código da requisição com 13 dígitos.');
      return;
    }
    const minhaGeracao = ++geracao;
    btn.disabled = true;
    renderCarregando(cod);

    try {
      const res = await window.agentFetch('/api/aplis/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codRequisicao: cod })
      });
      const data = await res.json().catch(() => ({}));
      if (minhaGeracao !== geracao) return;

      if (!res.ok) {
        const porTipo = {
          timeout: 'O apLIS demorou demais para responder. Tente de novo em instantes.',
          rede: 'Não foi possível conectar ao apLIS.',
          nao_configurado: 'Integração com o apLIS não está configurada.'
        };
        renderErro(porTipo[data.tipo] || data.error || 'Falha ao consultar o apLIS.', data.tipo === 'negocio' && data.codErro ? `Código do erro: ${data.codErro}` : null);
        return;
      }
      if (!data.encontrado) {
        renderNaoEncontrado(cod);
        return;
      }
      renderCartao(data.requisicao);
    } catch (e) {
      if (minhaGeracao !== geracao) return;
      renderErro('Erro de rede ao consultar o apLIS.');
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
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 13);
    });
  });

  window.agentPanel = { abrir, fechar, reset, consultar };
})();
