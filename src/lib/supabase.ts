import { createClient } from '@supabase/supabase-js'

/**
 * Credenciales PÚBLICAS del proyecto Supabase. La "publishable/anon key" está
 * pensada para ir en el cliente; la seguridad real la dan las políticas RLS de la
 * base de datos (lectura pública, escritura solo para el admin autenticado).
 */
const SUPABASE_URL = 'https://jxwxnibctfhiibrpfbvh.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_9dsJ48C_RHEX2gDkGqUuBw_d0Do_KuD'

/**
 * MODO PRUEBA (`npm run dev:prueba`, solo en local): lee los datos reales pero NO
 * escribe nada. Toda petición que modificaría datos (tablas, funciones RPC, fotos,
 * alta de usuarios) se contesta en el propio navegador como si hubiera ido bien,
 * así la app aplica el cambio en pantalla sin tocar Supabase. Recargar = volver a los
 * datos reales. Nunca se activa en la web publicada (exige el servidor de desarrollo).
 */
export const MODO_PRUEBA = import.meta.env.DEV && import.meta.env.VITE_SANDBOX === '1'

const fetchPrueba: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const metodo = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const ruta = new URL(url).pathname
  const lectura = metodo === 'GET' || metodo === 'HEAD'
  // Login, refresco de sesión y logout sí pasan (no cambian datos); el alta de
  // usuarios no. Todo lo demás que no sea leer se queda aquí.
  const authPermitido = ruta.startsWith('/auth/v1/') && !ruta.startsWith('/auth/v1/signup')
  if (lectura || authPermitido) return fetch(input, init)

  console.info(`[MODO PRUEBA] bloqueado ${metodo} ${ruta}`)
  // Respuesta «ha ido bien»: devuelve lo que se mandó (PostgREST con
  // return=representation), para que los `.select()` tras un update vean filas.
  let cuerpo: unknown
  try {
    cuerpo = typeof init?.body === 'string' ? JSON.parse(init.body) : null
  } catch {
    cuerpo = null
  }
  const filas = ruta.startsWith('/rest/v1/rpc/') ? null : Array.isArray(cuerpo) ? cuerpo : cuerpo ? [cuerpo] : []
  return new Response(JSON.stringify(filas), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  MODO_PRUEBA ? { global: { fetch: fetchPrueba } } : undefined,
)

// Aviso fijo en pantalla para que nunca haya dudas de en qué modo se está.
if (MODO_PRUEBA && typeof document !== 'undefined') {
  const aviso = document.createElement('div')
  aviso.textContent = '🧪 MODO PRUEBA · no se guarda nada · recarga para volver a los datos reales'
  aviso.style.cssText =
    'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#a16207;color:#fff;' +
    'font:600 13px system-ui;text-align:center;padding:4px 8px;pointer-events:none'
  document.body.appendChild(aviso)
}
