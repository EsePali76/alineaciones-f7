import { useMemo } from 'react'
import { useConvocatoriaStore } from '../store/convocatoriaStore'
import { useRotationStore } from '../store/rotationStore'
import { usePlayersStore } from '../store/playersStore'
import { useAuthStore } from '../store/authStore'
import { fechaEfectiva, ventanaAbierta } from '../domain/matchday'
import type { SignupRow, SignupStatus } from '../lib/convocatoriaApi'

export interface ConvocatoriaInfo {
  /** Fecha efectiva del próximo partido ('YYYY-MM-DD'). */
  fecha: string
  /** ¿Está abierta la ventana de apuntarse (domingo 12:00 → fin del lunes)? */
  abierta: boolean
  /** Apuntados "Me apunto" (titulares), por orden de llegada. */
  titulares: SignupRow[]
  /** "Si falta gente voy" (reservas), por orden de llegada. */
  reservas: SignupRow[]
  /** Ids de titulares (orden de llegada) — para sembrar los convocados. */
  titularIds: string[]
  /** Ids de reservas (orden de llegada) — para "completar con reservas". */
  reservaIds: string[]
  /** Estado del usuario actual en ESTA jornada (null = no apuntado). */
  miEstado: SignupStatus | null
}

/** Convocatoria de la jornada actual, derivada de los apuntes + la fecha efectiva. */
export function useConvocatoria(): ConvocatoriaInfo {
  const signups = useConvocatoriaStore((s) => s.signups)
  const matchDateOverride = useRotationStore((s) => s.matchDate)
  const myPlayerId = useAuthStore((s) => s.profile?.playerId ?? null)
  // Reacciona a cambios del plantel (p.ej. fichas eliminadas) sin acoplar nombres aquí.
  const playersLoaded = usePlayersStore((s) => s.loaded)

  return useMemo(() => {
    const fecha = fechaEfectiva(matchDateOverride)
    const abierta = ventanaAbierta(fecha)
    const delDia = signups
      .filter((s) => s.match_date === fecha)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
    const titulares = delDia.filter((s) => s.status === 'in')
    const reservas = delDia.filter((s) => s.status === 'maybe')
    const mio = myPlayerId ? delDia.find((s) => s.player_id === myPlayerId) : undefined
    return {
      fecha,
      abierta,
      titulares,
      reservas,
      titularIds: titulares.map((s) => s.player_id),
      reservaIds: reservas.map((s) => s.player_id),
      miEstado: mio?.status ?? null,
    }
    // playersLoaded entra como dependencia para recomputar tras cargar el plantel.
  }, [signups, matchDateOverride, myPlayerId, playersLoaded])
}
