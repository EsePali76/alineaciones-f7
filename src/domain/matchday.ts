/**
 * Lógica pura del "día de partido" (la pachanga es los LUNES).
 *
 * Reglas de dominio (confirmadas por Santi):
 *  - Por defecto se juega cada lunes.
 *  - AGOSTO no se juega: si el próximo lunes cae en agosto, salta al primer lunes
 *    de septiembre (ahí además empieza la temporada nueva; ver `domain/season.ts`).
 *  - La fecha auto-avanza: cuando el lunes ya ha pasado, pasa al siguiente.
 *  - El admin puede decir "este lunes no hay partido" → empuja la fecha al siguiente
 *    lunes (override persistido). NO toca la cola de turnos: el mismo del turno
 *    sigue siéndolo el lunes siguiente.
 *
 * Las fechas se manejan como cadenas locales 'YYYY-MM-DD' (a juego con la columna
 * `date` de Supabase) para no arrastrar líos de zona horaria.
 */

/** Agosto en meses 0-indexados de JS. */
const AGOSTO = 7

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

/** Lunes de esta semana si hoy es lunes (el partido es hoy); si no, el próximo lunes. */
function lunesDesde(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = r.getDay() // 0 domingo … 6 sábado
  const add = (8 - dow) % 7 // lunes=1 → 0 (hoy); resto → días hasta el próximo lunes
  r.setDate(r.getDate() + add)
  return r
}

/** Primer lunes de septiembre del año dado. */
function primerLunesSeptiembre(year: number): Date {
  const d = new Date(year, AGOSTO + 1, 1) // 1 de septiembre
  const add = (8 - d.getDay()) % 7
  d.setDate(d.getDate() + add)
  return d
}

/** Aplica el salto de agosto: si el lunes cae en agosto, va al 1er lunes de septiembre. */
function saltarAgosto(lunes: Date): Date {
  return lunes.getMonth() === AGOSTO ? primerLunesSeptiembre(lunes.getFullYear()) : lunes
}

/** Próxima jornada (lunes) a partir de hoy, saltando agosto. */
export function proximaJornada(hoy: Date = new Date()): Date {
  return saltarAgosto(lunesDesde(hoy))
}

/** El lunes siguiente al dado (para el botón admin "este lunes no hay partido"), saltando agosto. */
export function siguienteJornada(fechaISO: string): string {
  const d = parseISO(fechaISO)
  d.setDate(d.getDate() + 7)
  return toISO(saltarAgosto(d))
}

/**
 * Fecha efectiva del próximo partido: la calculada automáticamente, salvo que el
 * admin haya fijado un override para hoy o un día futuro (p.ej. mover el partido
 * de lunes a miércoles, o cancelar la jornada). El override caduca solo: en cuanto
 * su fecha queda en el pasado se ignora y se vuelve a la jornada automática.
 */
export function fechaEfectiva(override: string | null | undefined, hoy: Date = new Date()): string {
  const auto = proximaJornada(hoy)
  if (override) {
    const ov = parseISO(override)
    const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
    if (ov.getTime() >= hoy0.getTime()) return override
  }
  return toISO(auto)
}

/**
 * ¿Está abierta la convocatoria? Abre el DOMINGO a las 12:00 de la semana del
 * partido y cierra al final del día del partido.
 *
 * La apertura se ancla al lunes de la semana del partido (no al día anterior sin
 * más): así, si el admin mueve el partido a un día más tarde de la semana (p.ej.
 * lunes → miércoles), la convocatoria sigue abriendo el domingo como de costumbre
 * y no queda un hueco lunes/martes sin poder apuntarse. El caso normal (partido el
 * lunes) da exactamente el mismo domingo 12:00 de siempre.
 */
export function ventanaAbierta(fechaISO: string, ahora: Date = new Date()): boolean {
  const partido = parseISO(fechaISO)
  // Lunes de la semana del partido (si el partido es lunes, él mismo).
  const lunesSemana = new Date(partido)
  const dow = lunesSemana.getDay() // 0 domingo … 6 sábado
  lunesSemana.setDate(lunesSemana.getDate() - ((dow + 6) % 7))
  const apertura = new Date(lunesSemana)
  apertura.setDate(apertura.getDate() - 1) // domingo anterior
  apertura.setHours(12, 0, 0, 0) // 12:00
  const cierre = new Date(partido)
  cierre.setHours(23, 59, 59, 999) // hasta el final del día del partido
  const t = ahora.getTime()
  return t >= apertura.getTime() && t <= cierre.getTime()
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

/** Fecha legible, p.ej. "lunes, 16 de junio". */
export function formatoFecha(fechaISO: string): string {
  return parseISO(fechaISO).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
