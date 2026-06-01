import { useState } from 'react'
import { usePlayersStore } from './store/playersStore'
import type { PlayerInput } from './store/playersStore'
import type { Player } from './domain/types'
import { PlayerForm } from './components/PlayerForm'
import { PlayerList } from './components/PlayerList'
import { TeamGenerator } from './components/TeamGenerator'
import { HistoryList } from './components/HistoryList'
import { DataIO } from './components/DataIO'

type Tab = 'plantel' | 'equipos' | 'historial'

function App() {
  const players = usePlayersStore((s) => s.players)
  const addPlayer = usePlayersStore((s) => s.addPlayer)
  const updatePlayer = usePlayersStore((s) => s.updatePlayer)
  const removePlayer = usePlayersStore((s) => s.removePlayer)

  const [tab, setTab] = useState<Tab>('plantel')
  const [editing, setEditing] = useState<Player | null>(null)

  const handleSubmit = (input: PlayerInput) => {
    if (editing) {
      updatePlayer(editing.id, input)
      setEditing(null)
    } else {
      addPlayer(input)
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">⚽ alineaciones F7</h1>
          <p className="text-sm text-slate-400">Equipos equilibrados para la pachanga</p>
        </div>
        <DataIO />
      </header>

      {/* Pestañas */}
      <nav className="flex gap-1 border-b border-slate-700">
        <TabButton active={tab === 'plantel'} onClick={() => setTab('plantel')}>
          Plantel
        </TabButton>
        <TabButton active={tab === 'equipos'} onClick={() => setTab('equipos')}>
          Equipos
        </TabButton>
        <TabButton active={tab === 'historial'} onClick={() => setTab('historial')}>
          Historial
        </TabButton>
      </nav>

      {tab === 'plantel' && (
        <>
          <PlayerList players={players} onEdit={setEditing} onRemove={removePlayer} />
          <PlayerForm
            key={editing?.id ?? 'nuevo'}
            initial={editing ?? undefined}
            onSubmit={handleSubmit}
            onCancel={editing ? () => setEditing(null) : undefined}
          />
        </>
      )}
      {tab === 'equipos' && <TeamGenerator />}
      {tab === 'historial' && <HistoryList />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={
        'border-b-2 px-4 py-2 text-sm font-medium transition-colors ' +
        (active
          ? 'border-emerald-500 text-white'
          : 'border-transparent text-slate-400 hover:text-slate-200')
      }
    >
      {children}
    </button>
  )
}

export default App
