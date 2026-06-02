import { useRef } from 'react'
import { usePlayersStore } from '../store/playersStore'
import { useLineupsStore } from '../store/lineupsStore'
import { useAuthStore } from '../store/authStore'
import type { Player, ConfirmedLineup } from '../domain/types'

/** Lee un store persistido de zustand del localStorage antiguo y devuelve su `state`. */
function leerPersist<T>(key: string, campo: string): T[] {
  const raw = localStorage.getItem(key)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return (parsed?.state?.[campo] as T[]) ?? []
  } catch {
    return []
  }
}

/** Exporta el plantel a JSON, importa desde JSON y migra los datos locales a la nube. */
export function DataIO() {
  const players = usePlayersStore((s) => s.players)
  const replaceAllPlayers = usePlayersStore((s) => s.replaceAll)
  const replaceAllLineups = useLineupsStore((s) => s.replaceAll)
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const fileInput = useRef<HTMLInputElement>(null)

  const exportar = () => {
    const blob = new Blob([JSON.stringify(players, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const fecha = new Date().toISOString().slice(0, 10)
    const a = document.createElement('a')
    a.href = url
    a.download = `alineaciones-f7-${fecha}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite re-importar el mismo archivo
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!Array.isArray(data)) throw new Error('El archivo no contiene una lista de jugadores.')
      if (!confirm(`Se subirán ${data.length} jugadores a la nube. ¿Continuar?`)) return
      await replaceAllPlayers(data as Player[])
      alert(`Importados ${data.length} jugadores.`)
    } catch (err) {
      alert('No se pudo importar: ' + (err instanceof Error ? err.message : 'archivo inválido'))
    }
  }

  // Sube a la nube los datos guardados en el navegador local (claves antiguas).
  const migrarLocal = async () => {
    const localPlayers = leerPersist<Player>('alineaciones-f7-players', 'players')
    const localLineups = leerPersist<ConfirmedLineup>('alineaciones-f7-lineups', 'lineups')
    if (localPlayers.length === 0 && localLineups.length === 0) {
      alert(
        'No se han encontrado datos locales en este navegador.\n\n' +
          'La migración debes hacerla desde el navegador/equipo donde metiste los jugadores (p.ej. localhost).',
      )
      return
    }
    if (
      !confirm(
        `Subir a la nube ${localPlayers.length} jugadores y ${localLineups.length} alineaciones de este navegador?`,
      )
    )
      return
    try {
      if (localPlayers.length > 0) await replaceAllPlayers(localPlayers)
      if (localLineups.length > 0) await replaceAllLineups(localLineups)
      alert('✓ Datos locales subidos a la nube.')
    } catch (err) {
      alert('No se pudo migrar: ' + (err instanceof Error ? err.message : 'error'))
    }
  }

  // Toda la gestión de datos (exportar/importar/migrar) es solo para el admin.
  if (!isAdmin) return null

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={exportar}
        disabled={players.length === 0}
        className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 enabled:hover:border-slate-400 disabled:opacity-40"
        title="Descargar copia de seguridad en JSON"
      >
        ⬇ Exportar
      </button>
      <button
        onClick={() => fileInput.current?.click()}
        className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-400"
        title="Restaurar desde un archivo JSON (sube a la nube)"
      >
        ⬆ Importar
      </button>
      <button
        onClick={migrarLocal}
        className="rounded border border-amber-700 px-3 py-1.5 text-sm text-amber-300 hover:border-amber-500"
        title="Sube a la nube los jugadores/alineaciones guardados en este navegador"
      >
        ☁ Subir datos locales
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        onChange={importar}
        className="hidden"
      />
    </div>
  )
}
