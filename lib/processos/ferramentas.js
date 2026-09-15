const { consultarPorCodigo, buscarPorPaciente } = require('../aplis/consultas');

// A única superfície de dado externo que um processo pode receber. Sempre
// aplica a desambiguação obrigatória (busca por paciente com >1 resultado
// nunca vira uma "situação" única) e nunca expõe o cliente do apLIS.
function criarFerramentasProcesso({ aplisClient }) {
  async function consultarPaciente(identificadores) {
    const { codRequisicao, cpf, nome } = identificadores || {};

    if (codRequisicao) {
      const r = await consultarPorCodigo(aplisClient, codRequisicao);
      if (!r.encontrado) return { encontrado: false };
      return { encontrado: true, multiplos: false, situacao: r.requisicao };
    }

    const termo = cpf || nome;
    if (!termo) return { encontrado: false };

    const r = await buscarPorPaciente(aplisClient, termo);
    if (!r.encontrado) return { encontrado: false };
    if (r.pacientes.length > 1) {
      return { encontrado: true, multiplos: true, pacientes: r.pacientes };
    }
    return { encontrado: true, multiplos: false, situacao: r.pacientes[0].requisicoes[0] };
  }

  return { consultarPaciente };
}

module.exports = { criarFerramentasProcesso };
