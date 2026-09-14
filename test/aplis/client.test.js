const { test } = require('node:test');
const assert = require('node:assert/strict');
const { criarAplisClient, AplisError, COMANDOS_PERMITIDOS } = require('../../lib/aplis/client');

const CONFIG = { baseUrl: 'https://aplis.exemplo/api/integracao.php', usuario: 'usr', senha: 'segredo-xyz' };

function fetchFake(resposta) {
  const chamadas = [];
  const impl = async (url, opts) => {
    chamadas.push({ url, opts });
    if (typeof resposta === 'function') return resposta(url, opts);
    return resposta;
  };
  return { impl, chamadas };
}

function respostaJson(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

const COMANDOS_ESCRITA = [
  'admissaoSalvar', 'pacienteSalvar', 'medicoSalvar', 'instituicaoSalvar', 'convenioSalvar',
  'requisicaoCancelar', 'exameAnteriorSalvar', 'dadosClinicosSalvar', 'requisicaoStatusSalvar', 'insightConsultar'
];

test('lista branca contém exatamente os seis comandos de leitura', () => {
  assert.deepEqual([...COMANDOS_PERMITIDOS].sort(), [
    'faturamentoLoteListar', 'requisicaoImagem', 'requisicaoLaudo',
    'requisicaoListar', 'requisicaoResultado', 'requisicaoStatus'
  ]);
});

for (const cmd of COMANDOS_ESCRITA) {
  test(`comando de escrita "${cmd}" é recusado antes de qualquer requisição HTTP`, async () => {
    const { impl, chamadas } = fetchFake(respostaJson({}));
    const client = criarAplisClient({ ...CONFIG, fetchImpl: impl });
    await assert.rejects(() => client.chamar(cmd, {}), (err) => {
      assert.ok(err instanceof AplisError);
      assert.equal(err.tipo, 'comando_nao_permitido');
      return true;
    });
    assert.equal(chamadas.length, 0);
  });
}

test('comando desconhecido também é recusado sem HTTP', async () => {
  const { impl, chamadas } = fetchFake(respostaJson({}));
  const client = criarAplisClient({ ...CONFIG, fetchImpl: impl });
  await assert.rejects(() => client.chamar('qualquerCoisa', {}), { tipo: 'comando_nao_permitido' });
  assert.equal(chamadas.length, 0);
});

test('comando permitido monta o envelope {ver, cmd, dat} com Basic Auth', async () => {
  const { impl, chamadas } = fetchFake(respostaJson({ ver: 2, cmd: 'requisicaoStatus', dat: { sucesso: 1, codRequisicao: '1' } }));
  const client = criarAplisClient({ ...CONFIG, fetchImpl: impl });
  await client.chamar('requisicaoStatus', { codRequisicao: '1' });

  assert.equal(chamadas.length, 1);
  const { url, opts } = chamadas[0];
  assert.equal(url, CONFIG.baseUrl);
  assert.equal(opts.method, 'POST');
  assert.equal(opts.headers['Content-Type'], 'application/json');
  assert.equal(opts.headers['Authorization'], 'Basic ' + Buffer.from('usr:segredo-xyz').toString('base64'));
  assert.deepEqual(JSON.parse(opts.body), { ver: 2, cmd: 'requisicaoStatus', dat: { codRequisicao: '1' } });
  assert.ok(opts.signal, 'deve passar um AbortSignal');
});

test('sucesso devolve o dat da resposta', async () => {
  const dat = { sucesso: 1, codRequisicao: '0210029277004', historico: [] };
  const { impl } = fetchFake(respostaJson({ ver: 2, cmd: 'requisicaoStatus', dat }));
  const client = criarAplisClient({ ...CONFIG, fetchImpl: impl });
  assert.deepEqual(await client.chamar('requisicaoStatus', { codRequisicao: '0210029277004' }), dat);
});

test('sucesso 0 vira erro de negócio legível com codErro e msgErro', async () => {
  const { impl } = fetchFake(respostaJson({ ver: 2, cmd: 'requisicaoStatus', dat: { sucesso: 0, codErro: 42, msgErro: 'Requisição não encontrada' } }));
  const client = criarAplisClient({ ...CONFIG, fetchImpl: impl });
  await assert.rejects(() => client.chamar('requisicaoStatus', { codRequisicao: 'x' }), (err) => {
    assert.ok(err instanceof AplisError);
    assert.equal(err.tipo, 'negocio');
    assert.equal(err.codErro, 42);
    assert.equal(err.message, 'Requisição não encontrada');
    return true;
  });
});

test('HTTP fora de 2xx vira erro do tipo http com o status', async () => {
  const { impl } = fetchFake({ ok: false, status: 503, text: async () => 'indisponível' });
  const client = criarAplisClient({ ...CONFIG, fetchImpl: impl });
  await assert.rejects(() => client.chamar('requisicaoStatus', {}), { tipo: 'http', status: 503 });
});

test('resposta que não é JSON vira erro resposta_invalida', async () => {
  const { impl } = fetchFake({ ok: true, status: 200, text: async () => '<html>login</html>' });
  const client = criarAplisClient({ ...CONFIG, fetchImpl: impl });
  await assert.rejects(() => client.chamar('requisicaoStatus', {}), { tipo: 'resposta_invalida' });
});

test('falha de rede vira erro do tipo rede', async () => {
  const { impl } = fetchFake(() => { throw new TypeError('fetch failed'); });
  const client = criarAplisClient({ ...CONFIG, fetchImpl: impl });
  await assert.rejects(() => client.chamar('requisicaoStatus', {}), { tipo: 'rede' });
});

test('estouro do tempo limite aborta e vira erro timeout', async () => {
  const impl = (url, opts) => new Promise((_, reject) => {
    opts.signal.addEventListener('abort', () => {
      const e = new Error('aborted'); e.name = 'AbortError'; reject(e);
    });
  });
  const client = criarAplisClient({ ...CONFIG, fetchImpl: impl, timeoutMs: 30 });
  const inicio = Date.now();
  await assert.rejects(() => client.chamar('requisicaoStatus', {}), { tipo: 'timeout' });
  assert.ok(Date.now() - inicio < 1000);
});

test('tempo limite também cobre um corpo de resposta que nunca chega', async () => {
  const impl = (url, opts) => Promise.resolve({
    ok: true,
    status: 200,
    text: () => new Promise((_, reject) => {
      opts.signal.addEventListener('abort', () => {
        const e = new Error('aborted'); e.name = 'AbortError'; reject(e);
      });
    })
  });
  const client = criarAplisClient({ ...CONFIG, fetchImpl: impl, timeoutMs: 30 });
  const inicio = Date.now();
  await assert.rejects(() => client.chamar('requisicaoStatus', {}), { tipo: 'timeout' });
  assert.ok(Date.now() - inicio < 1000, 'deve abortar pelo timer, não ficar pendurado');
});

test('nenhum erro carrega a senha na mensagem ou nas propriedades', async () => {
  const cenarios = [
    fetchFake(respostaJson({ dat: { sucesso: 0, codErro: 1, msgErro: 'x' } })).impl,
    fetchFake({ ok: false, status: 500, text: async () => 'erro' }).impl,
    fetchFake(() => { throw new TypeError('fetch failed'); }).impl
  ];
  for (const impl of cenarios) {
    const client = criarAplisClient({ ...CONFIG, fetchImpl: impl });
    try { await client.chamar('requisicaoStatus', {}); assert.fail('deveria falhar'); }
    catch (err) {
      const serializado = JSON.stringify(err, Object.getOwnPropertyNames(err));
      assert.ok(!serializado.includes('segredo-xyz'));
      assert.ok(!err.message.includes('segredo-xyz'));
    }
  }
});
