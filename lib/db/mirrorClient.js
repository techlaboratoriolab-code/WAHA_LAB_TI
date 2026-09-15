// Cliente somente leitura do banco espelho do apLIS (MySQL, atraso de ~1 dia).
// Reaberto deliberadamente depois da decisão original de usar só a API (ver
// design.md, "Consulta pela API do apLIS, não pelo espelho MySQL") — a
// condição que a própria decisão previa para reabrir essa porta apareceu:
// convênio/cortesia não sai de nenhum comando de leitura barato da API (só
// vem embutido no laudo clínico completo de requisicaoResultado).
//
// Mesma disciplina do lib/aplis/client.js: nenhuma query livre chega aqui —
// só funções nomeadas, cada uma um SELECT único, parametrizado (nunca
// interpolação de string), buscando por código de requisição exato (a
// desambiguação de paciente já aconteceu na camada do apLIS antes disto ser
// chamado).
//
// Risco aceito e documentado: a credencial hoje é a mesma de superusuário
// (root) usada antes da decisão de API-only — o contrato "só leitura" é
// garantido pela disciplina deste módulo, não pelo banco. Pedir à TI um
// usuário com GRANT restrito a SELECT nessas tabelas é a mitigação real,
// ainda pendente (ver tasks.md).
//
// [Atualizado após provisionar o usuário restrito] A conexão NÃO seleciona
// banco padrão (sem `database` nas opções do pool) de propósito: um usuário
// com GRANT só por tabela (sem privilégio de banco) tem o handshake inicial
// de "conectar já dentro do banco X" recusado pelo MySQL, mesmo tendo SELECT
// concedido nas tabelas — confirmado ao vivo com o usuário restrito recém
// criado (agente_atendimento_ro). A query resolve isso qualificando cada
// tabela com o nome do banco (`lab.requisicao`, etc.), que é aceito porque
// aí a checagem é por tabela, não pela seleção inicial do banco.
const mysql = require('mysql2/promise');

function criarMirrorClient({ host, port, user, password, database, connectTimeoutMs = 5000, queryTimeoutMs = 5000 }) {
  const pool = mysql.createPool({
    host,
    port,
    user,
    password,
    connectTimeout: connectTimeoutMs,
    waitForConnections: true,
    connectionLimit: 3
  });

  const db = mysql.escapeId(database);

  // Nome da fonte pagadora e do convênio vinculados à requisição — o mesmo
  // dado que requisicaoResultado devolveria, sem precisar trazer o laudo
  // clínico completo junto. Requisições muito recentes podem não aparecer
  // ainda, por causa do atraso de espelhamento — isso vira "não encontrado"
  // aqui, nunca um erro.
  async function buscarFontePagadora(codRequisicao) {
    const [rows] = await pool.query(
      {
        sql: `SELECT fi.NomFantasia AS fontePagadoraNome, fc.NomConvenio AS convenioNome ` +
          `FROM ${db}.requisicao r ` +
          `LEFT JOIN ${db}.fatinstituicao fi ON fi.IdInstituicao = r.IdFontePagadora ` +
          `LEFT JOIN ${db}.fatconvenio fc ON fc.IdConvenio = r.IdConvenio ` +
          `WHERE r.CodRequisicao = ? LIMIT 1`,
        timeout: queryTimeoutMs
      },
      [String(codRequisicao)]
    );
    return rows[0] || null;
  }

  return { buscarFontePagadora };
}

module.exports = { criarMirrorClient };
