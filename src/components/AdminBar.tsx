import { useState } from 'react'
import { useAuthStore } from '../store/authStore'

/** Barra de admin: login para editar, o estado de sesión + salir. */
export function AdminBar() {
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const email = useAuthStore((s) => s.email)
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)

  const [abierto, setAbierto] = useState(false)
  const [correo, setCorreo] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  if (isAdmin) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="rounded bg-emerald-600/20 px-2 py-1 text-emerald-300" title={email ?? ''}>
          👤 Admin
        </span>
        <button
          onClick={() => logout()}
          className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:border-slate-400"
        >
          Salir
        </button>
      </div>
    )
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-400"
      >
        🔒 Entrar como admin
      </button>
    )
  }

  const entrar = async () => {
    setCargando(true)
    setError('')
    const err = await login(correo.trim(), pass)
    setCargando(false)
    if (err) {
      setError('Credenciales incorrectas')
    } else {
      setAbierto(false)
      setCorreo('')
      setPass('')
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        entrar()
      }}
      className="flex flex-wrap items-center gap-2 text-sm"
    >
      <input
        type="email"
        value={correo}
        onChange={(e) => setCorreo(e.target.value)}
        placeholder="email"
        autoFocus
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
        disabled={cargando}
        className="rounded bg-emerald-600 px-3 py-1 font-medium text-white enabled:hover:bg-emerald-500 disabled:opacity-50"
      >
        Entrar
      </button>
      <button
        type="button"
        onClick={() => {
          setAbierto(false)
          setError('')
        }}
        className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:border-slate-400"
      >
        Cancelar
      </button>
      {error && <span className="text-red-400">{error}</span>}
    </form>
  )
}
