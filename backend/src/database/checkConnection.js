/**
 * Verifica la conectividad con la base de datos de Supabase.
 * Hace una consulta de bajo costo para asegurar que el servicio responde.
 */
const checkDatabaseConnection = async (supabase) => {
  const { error } = await supabase.from('servicios').select('id').limit(1);

  if (error) {
    throw new Error(`Error de conexión a Supabase: ${error.message}`);
  }

  console.log('✅ Conexión a Supabase establecida correctamente.');
};

module.exports = { checkDatabaseConnection };
