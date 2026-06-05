import { supabase } from './supabase'

const BUCKET = 'player-photos'
/** Lado del avatar tras recortar/redimensionar (cuadrado, suficiente para un círculo). */
const SIZE = 256

/**
 * Redimensiona y recorta una imagen a un cuadrado de SIZE px (center-crop) y la
 * devuelve como Blob JPEG. Evita subir fotos de varios MB del móvil.
 */
export function resizeToSquare(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const lado = Math.min(img.width, img.height)
      const sx = (img.width - lado) / 2
      const sy = (img.height - lado) / 2
      const canvas = document.createElement('canvas')
      canvas.width = SIZE
      canvas.height = SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('No se pudo procesar la imagen'))
      ctx.drawImage(img, sx, sy, lado, lado, 0, 0, SIZE, SIZE)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen'))),
        'image/jpeg',
        0.85,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen'))
    }
    img.src = url
  })
}

/**
 * Sube la foto de un jugador y devuelve su URL pública (con cache-bust). La ruta
 * `<playerId>/avatar.jpg` permite que las políticas RLS dejen escribir solo al
 * dueño o al admin.
 */
export async function uploadPhoto(playerId: string, file: File): Promise<string> {
  const blob = await resizeToSquare(file)
  const path = `${playerId}/avatar.jpg`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}`
}

/** Borra la foto de un jugador (si existía). No falla si no había. */
export async function deletePhoto(playerId: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([`${playerId}/avatar.jpg`])
}
