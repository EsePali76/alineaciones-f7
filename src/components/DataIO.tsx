import { useRef } from 'react'
import { usePlayersStore } from '../store/playersStore'
import type { Player } from '../domain/types'

/** Exporta el plantel a un archivo JSON e importa desde uno (copia de seguridad). */
export function DataIO() {
  const players = usePlayersStore((s) => s.players)
  const replaceAll = usePlayersStore((s) => s.replaceAll)
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
      const n = players.length
      const msg =
        n > 0
          ? `Esto reemplazará los ${n} jugadores actuales por los ${data.length} del archivo. ¿Continuar?`
          : `Se importarán ${data.length} jugadores. ¿Continuar?`
      if (!confirm(msg)) return
      replaceAll(data as Player[])
      alert(`Importados ${data.length} jugadores.`)
    } catch (err) {
      alert('No se pudo importar: ' + (err instanceof Error ? err.message : 'archivo inválido'))
    }
  }

  return (
    <div className="flex gap-2">
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
        title="Restaurar desde un archivo JSON"
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
