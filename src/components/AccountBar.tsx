import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { usePlayersStore } from '../store/playersStore'

type Modo = 'cerrado' | 'login' | 'registro'

/**
 * Barra de cuenta: registro/login para cualquier usuario y estado de sesión.
 * Tras entrar muestra el nombre, el rol y el jugador vinculado (o aviso si no).
 */
export function AccountBar() {
  const { isLoggedIn, isAdmin, profile, email, register, login, logout } = useAuthStore()
  const players = usePlayersStore((s) => s.players)

  const [modo, setModo] = useState<Modo>('cerrado')
  const [correo, setCorreo] = useState('')
  const [pass, setPass] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const reset = () => {
    setModo('cerrado')
    setCorreo('')
    setPass('')
    setNombre('')
    setError('')
  }

  // ---- Sesión iniciada ----
  if (isLoggedIn) {
    const jugador = profile?.playerId ? players.find((p) => p.id === profile.playerId) : undefined
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-300">👤 {profile?.displayName || email}</span>
        {isAdmin ? (
          <span className="rounded bg-emerald-600/20 px-2 py-1 text-xs text-emerald-300">Admin</span>
        ) : jugador ? (
          <span
            className="rounded bg-sky-600/20 px-2 py-1 text-xs text-sky-300"
            title="Tu usuario está vinculado a este jugador"
          >
            {jugador.nombre}
          </span>
        ) : (
          <span
            className="rounded bg-amber-600/20 px-2 py-1 text-xs text-amber-300"
            title="El admin tiene que vincularte a tu jugador para que puedas valorar y hacer alineaciones"
          >
            sin vincular
          </span>
        )}
        <button
          onClick={() => logout()}
          className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:border-slate-400"
        >
          Salir
        </button>
      </div>
    )
  }

  // ---- Anónimo: botones de entrar / registrarse ----
  if (modo === 'cerrado') {
    return (
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => setModo('login')}
          className="rounded border border-slate-600 px-3 py-1.5 text-slate-300 hover:border-slate-400"
        >
          Entrar
        </button>
        <button
          onClick={() => setModo('registro')}
          className="rounded bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-500"
        >
          Registrarse
        </button>
      </div>
    )
  }

  const enviar = async () => {
    setCargando(true)
    setError('')
    const err =
      modo === 'registro'
        ? await register(correo, pass, nombre)
        : await login(correo, pass)
    setCargando(false)
    if (err) {
      setError(
        modo === 'login'
          ? 'Credenciales incorrectas'
          : err.includes('already') ? 'Ese email ya está registrado' : err,
      )
    } else {
      reset()
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        enviar()
      }}
      className="flex flex-wrap items-center gap-2 text-sm"
    >
      {modo === 'registro' && (
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="tu nombre"
          autoFocus
          className="w-36 rounded border border-slate-600 bg-slate-900 px-2 py-1"
        />
      )}
      <input
        type="email"
        value={correo}
        onChange={(e) => setCorreo(e.target.value)}
        placeholder="email"
        autoFocus={modo === 'login'}
        className="w-44 rounded border border-slate-600 bg-slate-900 px-2 py-1"
      />
      <input
        type="password"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        placeholder="contraseña"
        className="w-36 rounded border border-slate-600 bg-slate-900 px-2 py-1"
      />
      <button
        type="submit"
        disabled={cargando || !correo || !pass || (modo === 'registro' && !nombre)}
        className="rounded bg-emerald-600 px-3 py-1 font-medium text-white enabled:hover:bg-emerald-500 disabled:opacity-50"
      >
        {modo === 'registro' ? 'Crear cuenta' : 'Entrar'}
      </button>
      <button
        type="button"
        onClick={reset}
        className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:border-slate-400"
      >
        Cancelar
      </button>
      {error && <span className="text-red-400">{error}</span>}
    </form>
  )
}
