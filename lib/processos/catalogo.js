// Catálogo declarativo: adicionar um processo é acrescentar um registro aqui,
// nunca escrever código de integração novo. Os três iniciais cobrem as
// intenções do MVP e são inteiramente declarativos — se algum precisasse de
// função, seria sinal de que o motor está errado.
const CATALOGO_PROCESSOS = [
  {
    id: 'previsao_entrega',
    intencao: 'previsao_entrega',
    buscar: { tipo: 'consultarPaciente' },
    renderizar: {
      templateId: 'previsao_entrega',
      slots: { exame: 'situacao.exame', dtaPrevista: 'situacao.dtaPrevista' }
    }
  },
  {
    id: 'status_exame',
    intencao: 'status_exame',
    buscar: { tipo: 'consultarPaciente' },
    renderizar: {
      templateId: 'status_exame',
      slots: { exame: 'situacao.exame', statusCliente: 'situacao.statusCliente' }
    }
  },
  {
    id: 'laudo_disponivel',
    intencao: 'laudo_disponivel',
    buscar: { tipo: 'consultarPaciente' },
    renderizar: {
      templateId: 'laudo_disponivel',
      slots: { exame: 'situacao.exame', statusCliente: 'situacao.statusCliente' }
    }
  }
];

module.exports = { CATALOGO_PROCESSOS };
