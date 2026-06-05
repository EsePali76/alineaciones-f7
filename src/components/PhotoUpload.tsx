import { useRef, useState } from 'react'
import { uploadPhoto, deletePhoto } from '../lib/photosApi'
import { Avatar } from './Avatar'

/**
 * Subida/cambio de la foto de un jugador. Redimensiona en el cliente y sube a
 * Storage; al terminar avisa con `onChange(url)`. La URL se persiste con el resto
 * del formulario al guardar. Necesita un `playerId` (la foto se guarda por id), así
 * que en un alta nueva se muestra primero un aviso para guardar.
 */
export function PhotoUpload({
  playerId,
  value,
  nombre,
  onChange,
}: {
  playerId?: string
  value?: string
  nombre?: string
  onChange: (url: string | undefined) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')

  const elegir = async (file: File | undefined) => {
    if (!file || !playerId) return
    setError('')
    setSubiendo(true)
    try {
      const url = await uploadPhoto(playerId, file)
      onChange(url)
    } catch (e) {
      console.error(e)
      setError('No se pudo subir la foto.')
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const quitar = async () => {
    if (!playerId) return onChange(undefined)
    setSubiendo(true)
    try {
      await deletePhoto(playerId)
    } catch (e) {
      console.error(e) // si falla el borrado del fichero, igualmente quitamos la URL
    } finally {
      setSubiendo(false)
      onChange(undefined)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar src={value} alt={nombre} className="h-16 w-16" />
      <div className="flex flex-col gap-1 text-sm">
        {playerId ? (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={subiendo}
                className="rounded border border-slate-600 px-3 py-1.5 text-slate-200 hover:border-slate-400 disabled:opacity-50"
              >
                {subiendo ? 'Subiendo…' : value ? 'Cambiar foto' : 'Subir foto'}
              </button>
              {value && (
                <button
                  type="button"
                  onClick={quitar}
                  disabled={subiendo}
                  className="rounded border border-slate-700 px-3 py-1.5 text-slate-400 hover:border-red-600 hover:text-red-400 disabled:opacity-50"
                >
                  Quitar
                </button>
              )}
            </div>
            <span className="text-xs text-slate-500">
              Si no subes ninguna, aparecerá una silueta genérica.
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => elegir(e.target.files?.[0])}
            />
          </>
        ) : (
          <span className="text-xs text-slate-500">
            Guarda primero el jugador para poder añadir su foto.
          </span>
        )}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  )
}
