const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (
  supabaseUrl &&
  supabaseServiceKey &&
  !supabaseUrl.includes('tu-proyecto') &&
  !supabaseServiceKey.includes('tu_service_role_key')
) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
} else {
  console.warn('⚠️  Supabase no está configurado con credenciales válidas. Se utilizará el modo Mock de respaldo.');
}

module.exports = supabase;
