/**
 * Lógica pura del "día de partido".
 *
 * Reglas de dominio (confirmadas por Santi):
 *  - Se juega todas las semanas los MISMOS días, pero cuáles son se configura (lo
 *    cambia admin/superuser desde el banner). Histórico: eran los lunes; desde
 *    septiembre de 2026 el campo se alquila los jueves, y alguna semana se ha jugado
 *    dos veces. Por eso no hay ningún día escrito a mano por aquí: los días entran
 *    como parámetro (`dows`, 0 domingo … 6 sábado) y solo se usa
 *    `DIAS_PARTIDO_DEFECTO` si nadie los ha configurado.
 *  - Con varios días, cada partido es una JORNADA propia (su convocatoria, su
 *    alineación y su turno): la próxima jornada es el día de partido más cercano.
 *  - AGOSTO no se juega: si la próxima jornada cae en agosto, salta a la primera
 *    de septiembre (ahí además empieza la temporada nueva; ver `domain/season.ts`).
 *  - La fecha auto-avanza: cuando el día del partido ya ha pasado, pasa al siguiente.
 *  - El admin puede decir "este partido no se juega" → empuja la fecha a la jornada
 *    siguiente (override persistido). NO toca la cola de turnos: el mismo del turno
 *    sigue siéndolo en la jornada siguiente.
 *  - Cambiar los días de la semana TAMPOCO toca la cola de turnos: solo mueve fechas.
 *
 * Las fechas se manejan como cadenas locales 'YYYY-MM-DD' (a juego con la columna
 * `date` de Supabase) para no arrastrar líos de zona horaria.
 */

/** Agosto en meses 0-indexados de JS. */
const AGOSTO = 7

/** Días de partido si no hay nada configurado: lunes (como era históricamente). */
export const DIAS_PARTIDO_DEFECTO: readonly number[] = [1]

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

/**
 * La convocatoria abre este número de días antes del partido, a las 12:00. Era 2,
 * pero se abría demasiado pronto (el martes solo había 2 apuntados para el jueves);
 * con 1 además no se pisan las convocatorias de dos partidos en días alternos.
 */
export const DIAS_ANTES_CONVOCATORIA = 1

/** Nombre del día de la semana (0 domingo … 6 sábado). */
export function nombreDia(dow: number): string {
  return NOMBRES_DIA[((dow % 7) + 7) % 7]
}

/** Días ordenados de lunes a domingo (como se leen en España): 0 (domingo) va al final. */
export function ordenarDias(dows: readonly number[]): number[] {
  return [...new Set(dows)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
}

/** "lunes", "lunes y jueves", "lunes, miércoles y viernes". */
export function nombresDias(dows: readonly number[]): string {
  const n = ordenarDias(dows).map(nombreDia)
  return n.length <= 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`
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

/** Hoy si hoy ya es día de partido; si no, el próximo día de partido de la lista. */
function diaDesde(d: Date, dows: readonly number[]): Date {
  const lista = dows.length ? dows : DIAS_PARTIDO_DEFECTO
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  // 0 si hoy ya es uno de esos días; si no, lo que falta hasta el más cercano.
  const add = Math.min(...lista.map((dow) => (((dow - r.getDay()) % 7) + 7) % 7))
  r.setDate(r.getDate() + add)
  return r
}

/** Primer día de partido de septiembre del año dado. */
function primeroDeSeptiembre(year: number, dows: readonly number[]): Date {
  return diaDesde(new Date(year, AGOSTO + 1, 1), dows)
}

/** Aplica el salto de agosto: si la jornada cae en agosto, va a la 1ª de septiembre. */
function saltarAgosto(jornada: Date, dows: readonly number[]): Date {
  return jornada.getMonth() === AGOSTO ? primeroDeSeptiembre(jornada.getFullYear(), dows) : jornada
}

/** Próxima jornada a partir de hoy, saltando agosto. */
export function proximaJornada(
  dows: readonly number[] = DIAS_PARTIDO_DEFECTO,
  hoy: Date = new Date(),
): Date {
  return saltarAgosto(diaDesde(hoy, dows), dows)
}

/** La jornada siguiente a la dada (botón admin "no se juega"), saltando agosto. */
export function siguienteJornada(
  fechaISO: string,
  dows: readonly number[] = DIAS_PARTIDO_DEFECTO,
): string {
  const d = parseISO(fechaISO)
  d.setDate(d.getDate() + 1)
  return toISO(saltarAgosto(diaDesde(d, dows), dows))
}

/**
 * Fecha efectiva del próximo partido: la calculada automáticamente para los días
 * de la semana configurados, salvo que el admin haya fijado un override para hoy o
 * un día futuro (p.ej. mover un partido suelto, o cancelar la jornada). El override
 * caduca solo: en cuanto su fecha queda en el pasado se ignora y se vuelve a la
 * jornada automática.
 */
export function fechaEfectiva(
  override: string | null | undefined,
  dows: readonly number[] = DIAS_PARTIDO_DEFECTO,
  hoy: Date = new Date(),
): string {
  const auto = proximaJornada(dows, hoy)
  if (override) {
    const ov = parseISO(override)
    const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
    if (ov.getTime() >= hoy0.getTime()) return override
  }
  return toISO(auto)
}

/**
 * ¿Está abierta la convocatoria? Abre `DIAS_ANTES_CONVOCATORIA` días antes del
 * partido a las 12:00 y cierra al final del día del partido.
 *
 * Se ancla a la fecha del partido (no a los días fijos de la semana): si el admin
 * mueve un partido suelto, la convocatoria se mueve con él y mantiene el margen.
 */
export function ventanaAbierta(fechaISO: string, ahora: Date = new Date()): boolean {
  const apertura = aperturaConvocatoria(fechaISO)
  const cierre = parseISO(fechaISO)
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
 * caducar la alineación de la jornada: al día siguiente deja de mostrarse en el banner
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
