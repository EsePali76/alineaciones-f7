import { useEffect, useState } from 'react'
import { usePlayersStore } from '../../store/playersStore'
import { useAuthStore } from '../../store/authStore'
import {
  fetchAllProfiles,
  adminLinkPlayer,
  adminSetRole,
  adminResetRatings,
  adminSetRatingsFinalized,
  adminDeleteUser,
  type Profile,
} from '../../lib/authApi'

/**
 * Panel de Admin: gestiona los usuarios registrados. Vincula cada usuario a su
 * jugador del plantel (anti-suplantación), cambia rol y resetea valoraciones.
 */
export function UsersPanel() {
  const players = usePlayersStore((s) => s.players)
  const updatePlayer = usePlayersStore((s) => s.updatePlayer)
  const myUserId = useAuthStore((s) => s.userId)
  const refreshMyProfile = useAuthStore((s) => s.refreshProfile)

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = async () => {
    setError('')
    try {
      setProfiles(await fetchAllProfiles())
    } catch (e) {
      console.error(e)
      setError('No se pudieron cargar los usuarios.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  const ordenados = [...players].sort((a, b) => a.nombre.localeCompare(b.nombre))
  const delPlantel = ordenados.filter((p) => !p.invitado)
  const invitados = ordenados.filter((p) => p.invitado)
  // Jugadores ya vinculados a algún usuario (para avisar de duplicados).
  const vinculados = new Map(profiles.filter((p) => p.playerId).map((p) => [p.playerId, p.id]))

  /**
   * Vincula un usuario a un jugador. Si el jugador era un invitado, vincular ES
   * promocionarlo al plantel: pasa a tener cuenta, así que deja de ser invitado.
   */
  const vincular = async (profileId: string, playerId: string | null) => {
    await adminLinkPlayer(profileId, playerId)
    if (playerId) {
      const target = players.find((p) => p.id === playerId)
      if (target?.invitado) {
        await updatePlayer(playerId, { ...target, invitado: false, habitual: false })
      }
    }
  }

  const accion = async (fn: () => Promise<void>) => {
    try {
      await fn()
      await cargar()
      await refreshMyProfile() // por si me afecta a mí mismo
    } catch (e) {
      console.error(e)
      const msg = e instanceof Error ? e.message : String(e)
      alert('No se pudo completar la acción:\n\n' + msg)
    }
  }

  // Valoraciones "en curso" (sin finalizar). Cerrarlas las bloquea aunque el usuario
  // no pulsara "Finalizar"; útil para zanjar el periodo cuando algunos pasan de hacerlo.
  const abiertas = profiles.filter((p) => !p.ratingsFinalized)
  const cerrarTodasAbiertas = () => {
    if (abiertas.length === 0) return
    if (!confirm(`¿Cerrar las valoraciones de ${abiertas.length} usuario(s) en curso?`)) return
    accion(async () => {
      for (const p of abiertas) await adminSetRatingsFinalized(p.id, true)
    })
  }

  if (cargando) return <p className="p-6 text-center text-slate-500">Cargando usuarios…</p>
  if (error) return <p className="p-6 text-center text-red-400">{error}</p>

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">Usuarios</h2>
        <p className="text-sm text-slate-400">
          Vincula cada usuario registrado a su jugador del plantel. Sin vincular, el usuario
          solo puede consultar (no vota ni hace alineaciones).
        </p>
      </div>

      {profiles.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-slate-500">
          Aún no hay usuarios registrados.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-800 text-left text-slate-400">
              <th className="px-3 py-2 font-medium">Usuario</th>
              <th className="px-3 py-2 font-medium">Jugador vinculado</th>
              <th className="px-3 py-2 font-medium">
                <div className="flex items-center gap-2">
                  <span>Valoraciones</span>
                  {abiertas.length > 0 && (
                    <button
                      onClick={cerrarTodasAbiertas}
                      title="Cierra (bloquea) las valoraciones de todos los que las tienen en curso."
                      className="rounded border border-slate-600 px-2 py-0.5 text-xs font-normal text-slate-300 hover:border-slate-400"
                    >
                      Cerrar todas las abiertas ({abiertas.length})
                    </button>
                  )}
                </div>
              </th>
              <th className="px-3 py-2 font-medium">Rol</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((pr) => {
              const esYo = pr.id === myUserId
              return (
                <tr key={pr.id} className="border-t border-slate-700/60">
                  <td className="px-3 py-2">
                    <div className="font-medium">{pr.displayName || '—'}</div>
                    <div className="text-xs text-slate-500">{pr.email}</div>
                  </td>

                  {/* Vinculación a jugador */}
                  <td className="px-3 py-2">
                    <select
                      value={pr.playerId ?? ''}
                      onChange={(e) => accion(() => vincular(pr.id, e.target.value || null))}
                      className="rounded border border-slate-600 bg-slate-900 px-2 py-1"
                    >
                      <option value="">— sin vincular —</option>
                      <optgroup label="Plantel">
                        {delPlantel.map((p) => {
                          const ocupadoPorOtro =
                            vinculados.has(p.id) && vinculados.get(p.id) !== pr.id
                          return (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                              {ocupadoPorOtro ? ' (ya vinculado)' : ''}
                            </option>
                          )
                        })}
                      </optgroup>
                      {invitados.length > 0 && (
                        <optgroup label="Invitados (al vincular pasan al plantel)">
                          {invitados.map((p) => {
                            const ocupadoPorOtro =
                              vinculados.has(p.id) && vinculados.get(p.id) !== pr.id
                            return (
                              <option key={p.id} value={p.id}>
                                {p.nombre}
                                {p.habitual ? ' (habitual)' : ' (no habitual)'}
                                {ocupadoPorOtro ? ' · ya vinculado' : ''}
                              </option>
                            )
                          })}
                        </optgroup>
                      )}
                    </select>
                  </td>

                  {/* Estado de valoraciones + reset */}
                  <td className="px-3 py-2">
                    {pr.ratingsFinalized ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">🔒 finalizadas</span>
                        <button
                          onClick={() => {
                            if (confirm(`¿Reabrir las valoraciones de ${pr.displayName}?`))
                              accion(() => adminResetRatings(pr.id))
                          }}
                          className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:border-slate-400"
                        >
                          Reabrir
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">en curso</span>
                        <button
                          onClick={() => accion(() => adminSetRatingsFinalized(pr.id, true))}
                          title="Cierra (bloquea) sus valoraciones aunque no pulsara Finalizar. Reversible."
                          className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:border-slate-400"
                        >
                          Cerrar
                        </button>
                      </div>
                    )}
                  </td>

                  {/* Rol */}
                  <td className="px-3 py-2">
                    <select
                      disabled={esYo}
                      value={pr.role}
                      onChange={(e) =>
                        accion(() =>
                          adminSetRole(pr.id, e.target.value as 'admin' | 'superuser' | 'player'),
                        )
                      }
                      title={
                        esYo
                          ? 'No puedes cambiar tu propio rol'
                          : 'Superuser = todo menos el menú Usuarios'
                      }
                      className={
                        'rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs ' +
                        (esYo ? 'cursor-not-allowed opacity-60' : '')
                      }
                    >
                      <option value="player">Jugador</option>
                      <option value="superuser">Superuser</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>

                  {/* Borrar usuario */}
                  <td className="px-3 py-2 text-right">
                    {!esYo && (
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `¿Borrar la cuenta de ${pr.displayName || pr.email}? ` +
                                'Se eliminan su acceso y sus votos (el jugador del plantel se mantiene). ' +
                                'Tendrá que registrarse de nuevo para volver a entrar.',
                            )
                          )
                            accion(() => adminDeleteUser(pr.id))
                        }}
                        className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:border-red-500"
                      >
                        Borrar
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
