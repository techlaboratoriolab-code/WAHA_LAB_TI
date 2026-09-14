// Somente leitura. Qualquer comando fora desta lista é recusado antes de virar
// requisição — escrita no apLIS não é proibida por política, é inconstruível.
const COMANDOS_PERMITIDOS = Object.freeze([
  'requisicaoListar',
  'requisicaoStatus',
  'requisicaoResultado',
  'requisicaoLaudo',
  'requisicaoImagem',
  'faturamentoLoteListar'
]);

class AplisError extends Error {
  constructor(tipo, mensagem, extras = {}) {
    super(mensagem);
    this.name = 'AplisError';
    this.tipo = tipo;
    Object.assign(this, extras);
  }
}

function criarAplisClient({ baseUrl, usuario, senha, fetchImpl = fetch, timeoutMs = 8000 }) {
  const authHeader = 'Basic ' + Buffer.from(`${usuario}:${senha}`).toString('base64');

  async function chamar(cmd, dat) {
    if (!COMANDOS_PERMITIDOS.includes(cmd)) {
      throw new AplisError('comando_nao_permitido', `Comando "${cmd}" não é permitido nesta integração.`, { cmd });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // O timer só é desligado depois de ler o corpo: cabeçalhos rápidos com corpo
    // travado também precisam estourar.
    let resposta;
    let texto;
    try {
      resposta = await fetchImpl(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({ ver: 2, cmd, dat: dat || {} }),
        signal: controller.signal
      });
      texto = await resposta.text();
    } catch (err) {
      if (err && err.name === 'AbortError') {
        throw new AplisError('timeout', `apLIS não respondeu em ${timeoutMs}ms.`, { cmd });
      }
      throw new AplisError('rede', 'Não foi possível conectar ao apLIS.', { cmd });
    } finally {
      clearTimeout(timer);
    }

    if (!resposta.ok) {
      throw new AplisError('http', `apLIS respondeu HTTP ${resposta.status}.`, { cmd, status: resposta.status });
    }

    let json;
    try {
      json = JSON.parse(texto);
    } catch (e) {
      throw new AplisError('resposta_invalida', 'apLIS devolveu uma resposta que não é JSON.', { cmd });
    }

    const resultado = json && json.dat;
    if (!resultado || typeof resultado !== 'object') {
      throw new AplisError('resposta_invalida', 'apLIS devolveu um envelope sem o campo dat.', { cmd });
    }
    if (Number(resultado.sucesso) === 0) {
      throw new AplisError('negocio', String(resultado.msgErro || 'Erro informado pelo apLIS.'), {
        cmd, codErro: resultado.codErro
      });
    }
    return resultado;
  }

  return { chamar };
}

module.exports = { criarAplisClient, AplisError, COMANDOS_PERMITIDOS };
