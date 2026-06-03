import { useRef } from 'react'
import { usePlayersStore } from '../store/playersStore'
import { useAuthStore } from '../store/authStore'
import type { Player } from '../domain/types'

/** Exporta el plantel a JSON e importa desde JSON (sube a la nube). */
export function DataIO() {
  const players = usePlayersStore((s) => s.players)
  const replaceAllPlayers = usePlayersStore((s) => s.replaceAll)
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

  // Toda la gestión de datos (exportar/importar) es solo para el admin.
  if (!isAdmin) return null

  return (
    <div className="ml-auto flex flex-wrap justify-end gap-2">
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
