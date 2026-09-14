// Adaptadores que ligam o middleware requireAtendente ao Supabase real.
// Mantidos separados para que o middleware possa ser testado sem rede.
function criarAdaptadoresSupabase(supabase) {
  async function verificarToken(token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return { id: data.user.id, email: data.user.email };
  }

  async function carregarPerfil(userId) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*, custom_roles(id, name, permissions)')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    return data;
  }

  return { verificarToken, carregarPerfil };
}

module.exports = { criarAdaptadoresSupabase };
