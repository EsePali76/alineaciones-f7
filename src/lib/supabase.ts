import { createClient } from '@supabase/supabase-js'

/**
 * Credenciales PÚBLICAS del proyecto Supabase. La "publishable/anon key" está
 * pensada para ir en el cliente; la seguridad real la dan las políticas RLS de la
 * base de datos (lectura pública, escritura solo para el admin autenticado).
 */
const SUPABASE_URL = 'https://jxwxnibctfhiibrpfbvh.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_9dsJ48C_RHEX2gDkGqUuBw_d0Do_KuD'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
