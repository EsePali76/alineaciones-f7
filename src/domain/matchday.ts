/**
 * Lógica pura del "día de partido".
 *
 * Reglas de dominio (confirmadas por Santi):
 *  - Se juega todas las semanas el MISMO día, pero cuál es ese día se configura
 *    (lo cambia admin/superuser desde el banner). Histórico: eran los lunes; desde
 *    septiembre de 2026 el campo se alquila los jueves. Por eso no hay ningún "1"
 *    escrito a mano por aquí: el día entra como parámetro (`dow`, 0 domingo … 6
 *    sábado) y solo se usa `DIA_PARTIDO_DEFECTO` si nadie lo ha configurado.
 *  - AGOSTO no se juega: si la próxima jornada cae en agosto, salta a la primera
 *    de septiembre (ahí además empieza la temporada nueva; ver `domain/season.ts`).
 *  - La fecha auto-avanza: cuando el día del partido ya ha pasado, pasa al siguiente.
 *  - El admin puede decir "esta semana no hay partido" → empuja la fecha una semana
 *    (override persistido). NO toca la cola de turnos: el mismo del turno sigue
 *    siéndolo la semana siguiente.
 *  - Cambiar el día de la semana TAMPOCO toca la cola de turnos: solo mueve fechas.
 *
 * Las fechas se manejan como cadenas locales 'YYYY-MM-DD' (a juego con la columna
 * `date` de Supabase) para no arrastrar líos de zona horaria.
 */

/** Agosto en meses 0-indexados de JS. */
const AGOSTO = 7

/** Día de partido si no hay nada configurado: lunes (como era históricamente). */
export const DIA_PARTIDO_DEFECTO = 1

/** Nombres de los días, indexados como `Date.getDay()` (0 = domingo). */
export const NOMBRES_DIA = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const

/** La convocatoria abre este número de días antes del partido, a las 12:00. */
export const DIAS_ANTES_CONVOCATORIA = 2

/** Nombre del día de la semana (0 domingo … 6 sábado). */
export function nombreDia(dow: number): string {
  return NOMBRES_DIA[((dow % 7) + 7) % 7]
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Date (local, a medianoche) → 'YYYY-MM-DD'. */
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 'YYYY-MM-DD' → Date local a medianoche (sin desplazamiento de zona horaria). */
export function parseISO(iso: string): Date {
  const [y, m, dd] = iso.split('-').map(Number)
  return new Date(y, m - 1, dd)
}

/** Hoy si hoy ya es el día de partido; si no, el próximo día de partido. */
function diaDesde(d: Date, dow: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const add = (((dow - r.getDay()) % 7) + 7) % 7 // 0 si hoy ya es ese día
  r.setDate(r.getDate() + add)
  return r
}

/** Primer día de partido de septiembre del año dado. */
function primeroDeSeptiembre(year: number, dow: number): Date {
  return diaDesde(new Date(year, AGOSTO + 1, 1), dow)
}

/** Aplica el salto de agosto: si la jornada cae en agosto, va a la 1ª de septiembre. */
function saltarAgosto(jornada: Date, dow: number): Date {
  return jornada.getMonth() === AGOSTO ? primeroDeSeptiembre(jornada.getFullYear(), dow) : jornada
}

/** Próxima jornada a partir de hoy, saltando agosto. */
export function proximaJornada(dow: number = DIA_PARTIDO_DEFECTO, hoy: Date = new Date()): Date {
  return saltarAgosto(diaDesde(hoy, dow), dow)
}

/** La jornada siguiente a la dada (botón admin "esta semana no hay partido"), saltando agosto. */
export function siguienteJornada(fechaISO: string, dow: number = DIA_PARTIDO_DEFECTO): string {
  const d = parseISO(fechaISO)
  d.setDate(d.getDate() + 7)
  return toISO(saltarAgosto(d, dow))
}

/**
 * Fecha efectiva del próximo partido: la calculada automáticamente para el día de
 * la semana configurado, salvo que el admin haya fijado un override para hoy o un
 * día futuro (p.ej. mover un partido suelto, o cancelar la jornada). El override
 * caduca solo: en cuanto su fecha queda en el pasado se ignora y se vuelve a la
 * jornada automática.
 */
export function fechaEfectiva(
  override: string | null | undefined,
  dow: number = DIA_PARTIDO_DEFECTO,
  hoy: Date = new Date(),
): string {
  const auto = proximaJornada(dow, hoy)
  if (override) {
    const ov = parseISO(override)
    const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
    if (ov.getTime() >= hoy0.getTime()) return override
  }
  return toISO(auto)
}

/**
 * ¿Está abierta la convocatoria? Abre DOS DÍAS antes del partido a las 12:00 y
 * cierra al final del día del partido.
 *
 * Se ancla a la fecha del partido (no al día fijo de la semana): si el admin mueve
 * un partido suelto, la convocatoria se mueve con él y mantiene los mismos dos días
 * de margen.
 */
export function ventanaAbierta(fechaISO: string, ahora: Date = new Date()): boolean {
  const partido = parseISO(fechaISO)
  const apertura = new Date(partido)
  apertura.setDate(apertura.getDate() - DIAS_ANTES_CONVOCATORIA)
  apertura.setHours(12, 0, 0, 0)
  const cierre = new Date(partido)
  cierre.setHours(23, 59, 59, 999) // hasta el final del día del partido
  const t = ahora.getTime()
  return t >= apertura.getTime() && t <= cierre.getTime()
}

/** Fecha y hora en que abre la convocatoria de un partido (para anunciarla). */
export function aperturaConvocatoria(fechaISO: string): Date {
  const d = parseISO(fechaISO)
  d.setDate(d.getDate() - DIAS_ANTES_CONVOCATORIA)
  d.setHours(12, 0, 0, 0)
  return d
}

/**
 * ¿Ya ha pasado el día del partido? Devuelve true a partir del día SIGUIENTE al
 * partido (se considera "en curso" hasta el final del día del partido). Se usa para
 * caducar la alineación de la semana: al día siguiente deja de mostrarse en el banner
 * y el editor de "Equipos" se resetea para la próxima convocatoria.
 */
export function partidoPasado(fechaMs: number, ahora: Date = new Date()): boolean {
  const p = new Date(fechaMs)
  const finDia = new Date(p.getFullYear(), p.getMonth(), p.getDate(), 23, 59, 59, 999)
  return ahora.getTime() > finDia.getTime()
}

/** Fecha legible, p.ej. "jueves, 17 de septiembre". */
export function formatoFecha(fechaISO: string): string {
  return parseISO(fechaISO).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
