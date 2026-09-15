const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calcularSugestoes } = require('../../lib/processos/sugestoes');

const SITUACAO_COMPLETA = {
  codRequisicao: '0210029277004', paciente: 'MARIA DA SILVA', exame: 'Citologia',
  dtaPrevista: '20/09/2026', statusCliente: 'Em análise no laboratório'
};

test('com todos os dados presentes, sugere as três respostas', async () => {
  const sugestoes = await calcularSugestoes(SITUACAO_COMPLETA);
  assert.deepEqual(sugestoes.map((s) => s.processoId).sort(), ['laudo_disponivel', 'previsao_entrega', 'status_exame']);
  const previsao = sugestoes.find((s) => s.processoId === 'previsao_entrega');
  assert.ok(previsao.texto.includes('20/09/2026'));
  assert.ok(previsao.texto.includes('Citologia'));
});

test('sem dtaPrevista, previsao_entrega não é sugerida mas as outras duas continuam', async () => {
  const sugestoes = await calcularSugestoes({ ...SITUACAO_COMPLETA, dtaPrevista: null });
  assert.deepEqual(sugestoes.map((s) => s.processoId).sort(), ['laudo_disponivel', 'status_exame']);
});

test('sem statusCliente, status_exame e laudo_disponivel não são sugeridos', async () => {
  const sugestoes = await calcularSugestoes({ ...SITUACAO_COMPLETA, statusCliente: null });
  assert.deepEqual(sugestoes.map((s) => s.processoId), ['previsao_entrega']);
});

test('cada sugestão traz a intenção que a originou', async () => {
  const sugestoes = await calcularSugestoes(SITUACAO_COMPLETA);
  const status = sugestoes.find((s) => s.processoId === 'status_exame');
  assert.equal(status.intencao, 'status_exame');
});

test('com redator, o texto vem dele e a conversa chega até a chamada', async () => {
  const chamadas = [];
  const redator = {
    redigir: async ({ situacao, referencias, mensagens }) => {
      chamadas.push({ situacao, referencias, mensagens });
      return { texto: 'Mensagem do redator para ' + situacao.exame };
    }
  };
  const mensagens = [{ fromMe: false, body: 'quando meu exame fica pronto?' }];
  const sugestoes = await calcularSugestoes(SITUACAO_COMPLETA, { redator, mensagens });

  assert.equal(sugestoes.length, 3);
  assert.ok(sugestoes.every((s) => s.texto.startsWith('Mensagem do redator para')));
  assert.equal(chamadas.length, 3);
  assert.deepEqual(chamadas[0].mensagens, mensagens);
  assert.ok(Array.isArray(chamadas[0].referencias) && chamadas[0].referencias.length > 1);
});

test('cada sugestão carrega de qual referência de Resposta Rápida ela partiu, conforme o próprio redator relatou', async () => {
  const redator = { redigir: async () => ({ texto: 'x', baseadoEmId: 'biologiamolecular' }) };
  const sugestoes = await calcularSugestoes(SITUACAO_COMPLETA, { redator });
  assert.ok(sugestoes.every((s) => s.baseadoEm === 'biologiamolecular'));
});

test('sem o redator relatar baseadoEmId, a sugestão fica sem referência (nunca inventa uma)', async () => {
  const redator = { redigir: async () => ({ texto: 'x' }) };
  const sugestoes = await calcularSugestoes(SITUACAO_COMPLETA, { redator });
  assert.ok(sugestoes.every((s) => s.baseadoEm === null));
});

test('redator que falha (devolve null) ainda produz sugestão pelo template fixo', async () => {
  const redator = { redigir: async () => null };
  const sugestoes = await calcularSugestoes(SITUACAO_COMPLETA, { redator });
  assert.equal(sugestoes.length, 3);
  assert.equal(sugestoes.find((s) => s.processoId === 'previsao_entrega').baseadoEm, null);
});
