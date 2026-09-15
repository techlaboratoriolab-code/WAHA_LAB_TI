const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizarClassificacao, montarConteudoDaConversa, INTENCOES } = require('../../lib/agent/gemini');

test('INTENCOES é a lista fechada de cinco valores', () => {
  assert.deepEqual(INTENCOES, ['previsao_entrega', 'laudo_disponivel', 'status_exame', 'orientacao_preparo', 'outro']);
});

test('sanitizarClassificacao aceita uma resposta bem formada', () => {
  const r = sanitizarClassificacao({ intencao: 'previsao_entrega', confianca: 0.87, nome: 'Maria', resumoLivre: '' });
  assert.deepEqual(r, { intencao: 'previsao_entrega', confianca: 0.87, nome: 'Maria', resumoLivre: null });
});

test('intenção fora da lista fechada vira "outro" com confiança zerada', () => {
  const r = sanitizarClassificacao({ intencao: 'agendar_exame', confianca: 0.9, nome: '', resumoLivre: 'quer agendar' });
  assert.equal(r.intencao, 'outro');
  assert.equal(r.confianca, 0);
});

test('confiança fora de [0,1] é limitada aos extremos', () => {
  assert.equal(sanitizarClassificacao({ intencao: 'outro', confianca: 1.5, nome: '', resumoLivre: '' }).confianca, 1);
  assert.equal(sanitizarClassificacao({ intencao: 'outro', confianca: -0.2, nome: '', resumoLivre: '' }).confianca, 0);
});

test('confiança que não é número vira zero', () => {
  assert.equal(sanitizarClassificacao({ intencao: 'outro', confianca: 'alta', nome: '', resumoLivre: '' }).confianca, 0);
  assert.equal(sanitizarClassificacao({ intencao: 'outro', confianca: undefined, nome: '', resumoLivre: '' }).confianca, 0);
});

test('nome e resumoLivre vazios ou ausentes viram null, nunca string vazia', () => {
  const r = sanitizarClassificacao({ intencao: 'status_exame', confianca: 0.5 });
  assert.equal(r.nome, null);
  assert.equal(r.resumoLivre, null);
});

test('entrada totalmente inválida (não é objeto) vira "outro" com confiança zero', () => {
  for (const bruto of [null, undefined, 'texto', 42, []]) {
    const r = sanitizarClassificacao(bruto);
    assert.equal(r.intencao, 'outro');
    assert.equal(r.confianca, 0);
  }
});

test('montarConteudoDaConversa rotula cada mensagem por remetente, na ordem recebida', () => {
  const mensagens = [
    { fromMe: false, body: 'Bom dia, meu cpf é 123' },
    { fromMe: true, body: 'Vou verificar' },
    { fromMe: false, body: 'obrigada' }
  ];
  const texto = montarConteudoDaConversa(mensagens);
  assert.equal(texto, 'Paciente: Bom dia, meu cpf é 123\nAtendente: Vou verificar\nPaciente: obrigada');
});

test('montarConteudoDaConversa ignora mensagens sem texto (mídia) sem quebrar', () => {
  const mensagens = [{ fromMe: false, body: '' }, { fromMe: false, body: null }, { fromMe: true, body: 'oi' }];
  assert.equal(montarConteudoDaConversa(mensagens), 'Atendente: oi');
});

test('montarConteudoDaConversa com lista vazia devolve string vazia', () => {
  assert.equal(montarConteudoDaConversa([]), '');
});
