import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  // En producción (GitHub Pages) la app cuelga de /alineaciones-f7/; en dev, de la raíz.
  base: command === 'build' ? '/alineaciones-f7/' : '/',
  server: {
    // Puerto propio para este proyecto personal (Vite usa 5173 por defecto,
    // reservado para los proyectos AV). Cambia este número si lo prefieres.
    port: 5180,
    strictPort: true,
  },
}))
