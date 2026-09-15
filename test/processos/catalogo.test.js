const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CATALOGO_PROCESSOS } = require('../../lib/processos/catalogo');
const { executarProcesso } = require('../../lib/processos/motor');
const { REFERENCIAS_RESPOSTA_RAPIDA } = require('../../lib/processos/referencias_respostas_rapidas');

const INTENCOES_MVP = ['previsao_entrega', 'laudo_disponivel', 'status_exame'];

const SITUACAO_COMPLETA = { codRequisicao: '1', exame: 'Citologia', dtaPrevista: '20/09/2026', statusCliente: 'Em análise no laboratório' };

function ferramentasFake(retorno) {
  return { consultarPaciente: async () => (typeof retorno === 'function' ? retorno() : retorno) };
}

test('o catálogo cobre exatamente as três intenções do MVP', () => {
  assert.deepEqual(CATALOGO_PROCESSOS.map((p) => p.intencao).sort(), [...INTENCOES_MVP].sort());
});

test('a busca dos três processos continua declarativa', () => {
  for (const p of CATALOGO_PROCESSOS) {
    assert.equal(typeof p.buscar, 'object', `${p.id}.buscar deveria ser declarativo`);
  }
});

// A renderização virou função de propósito: ela chama o redator (baseado nas
// Respostas Rápidas) e só cai no template fixo se ele não estiver disponível.
// Ver design.md — decisão "Sugestão baseada nas Respostas Rápidas existentes".
test('a renderização dos três processos é função, não declaração', () => {
  for (const p of CATALOGO_PROCESSOS) {
    assert.equal(typeof p.renderizar, 'function', `${p.id}.renderizar deveria ser função`);
  }
});

test('cada processo oferece ao redator o pool inteiro de referências, todas válidas em REFERENCIAS_RESPOSTA_RAPIDA', async () => {
  const textosValidos = Object.values(REFERENCIAS_RESPOSTA_RAPIDA).map((r) => r.texto);
  for (const p of CATALOGO_PROCESSOS) {
    const r = await executarProcesso(p, { identificadores: { cpf: '1' } }, ferramentasFake({ encontrado: true, multiplos: false, situacao: SITUACAO_COMPLETA }), {}, {
      redigir: async ({ referencias }) => {
        assert.ok(Array.isArray(referencias) && referencias.length > 1, `${p.id} deveria oferecer várias referências, não uma fixa`);
        for (const ref of referencias) {
          assert.ok(textosValidos.includes(ref.texto), `${p.id} ofereceu uma referência fora do catálogo`);
        }
        return { texto: 'ok' };
      }
    });
    assert.equal(r.resultado, 'sugestao');
  }
});

test('os três processos recebem exatamente o mesmo pool de referências — a escolha é do redator, pelo contexto, não travada por processo', async () => {
  const poolsOferecidos = [];
  for (const p of CATALOGO_PROCESSOS) {
    await executarProcesso(p, { identificadores: { cpf: '1' } }, ferramentasFake({ encontrado: true, multiplos: false, situacao: SITUACAO_COMPLETA }), {}, {
      redigir: async ({ referencias }) => {
        poolsOferecidos.push(referencias.map((r) => r.id).sort());
        return { texto: 'ok' };
      }
    });
  }
  assert.deepEqual(poolsOferecidos[0], poolsOferecidos[1]);
  assert.deepEqual(poolsOferecidos[1], poolsOferecidos[2]);
});

test('com redator disponível, o texto final vem do redator, não do template fixo', async () => {
  const apoio = { redigir: async () => ({ texto: 'Mensagem escrita pelo redator.' }) };
  for (const p of CATALOGO_PROCESSOS) {
    const r = await executarProcesso(p, { identificadores: { cpf: '1' } }, ferramentasFake({ encontrado: true, multiplos: false, situacao: SITUACAO_COMPLETA }), {}, apoio);
    assert.equal(r.sugestao.texto, 'Mensagem escrita pelo redator.');
  }
});

test('sem redator (apoio vazio), cai no template fixo e ainda produz uma sugestão com dado completo', async () => {
  for (const p of CATALOGO_PROCESSOS) {
    const r = await executarProcesso(p, { identificadores: { cpf: '1' } }, ferramentasFake({ encontrado: true, multiplos: false, situacao: SITUACAO_COMPLETA }), {}, {});
    assert.equal(r.resultado, 'sugestao', `${p.id} deveria ter fallback declarativo`);
    assert.ok(r.sugestao.texto.length > 0);
  }
});

test('redator disponível mas devolvendo null: cai no template fixo em vez de ficar sem nada', async () => {
  const apoio = { redigir: async () => null };
  for (const p of CATALOGO_PROCESSOS) {
    const r = await executarProcesso(p, { identificadores: { cpf: '1' } }, ferramentasFake({ encontrado: true, multiplos: false, situacao: SITUACAO_COMPLETA }), {}, apoio);
    assert.equal(r.resultado, 'sugestao', `${p.id} deveria cair no template fixo quando o redator falha`);
  }
});

test('sem dado suficiente nem no redator nem no template fixo: sem_dado_suficiente', async () => {
  const situacaoIncompleta = { codRequisicao: '1', exame: null, dtaPrevista: null, statusCliente: null };
  const apoio = { redigir: async () => null }; // nenhum fato -> nem tenta chamar o modelo de verdade, mas aqui simulamos falha
  for (const p of CATALOGO_PROCESSOS) {
    const r = await executarProcesso(p, { identificadores: { cpf: '1' } }, ferramentasFake({ encontrado: true, multiplos: false, situacao: situacaoIncompleta }), {}, apoio);
    assert.equal(r.resultado, 'sem_dado_suficiente', `${p.id} deveria admitir que não tem dado`);
  }
});
