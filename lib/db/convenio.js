// "Cortesia" no apLIS não é um campo booleano na requisição — é o NOME da
// instituição/convênio vinculada a ela (confirmado ao vivo contra o banco
// espelho: a fonte pagadora de uma requisição real de cortesia chamava-se
// literalmente "Cortesia"). Comparação por nome, não pelo campo Segmento do
// cadastro de instituições: o valor de Segmento observado nesse mesmo
// registro (0) não bateu com o enum documentado na API (10 = Cortesia) —
// o nome é o sinal confiável, o Segmento não.
function normalizarNome(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}

// Devolve uma frase pronta para o slot do template, ou null se não houver
// fonte pagadora/convênio identificado (o template omite a sugestão nesse
// caso — nunca inventa "particular" ou "convênio" na dúvida).
function interpretarFontePagadora(registro) {
  const fontePagadoraNome = registro && registro.fontePagadoraNome;
  const convenioNome = registro && registro.convenioNome;
  const nomes = [fontePagadoraNome, convenioNome].filter(Boolean).map(normalizarNome);

  if (nomes.includes('CORTESIA')) return 'cortesia, sem cobrança';
  if (nomes.includes('PARTICULAR')) return 'atendimento particular';

  const nomeOriginal = fontePagadoraNome || convenioNome;
  return nomeOriginal ? `convênio ${nomeOriginal}` : null;
}

module.exports = { interpretarFontePagadora };
