import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // La configuración base es correcta
  base: "/",
  
  // La configuración del servidor es correcta
  server: {
    port: 5173,
    host: true,
    hmr: {
      host: "localhost",
    }
  },
  
  // ❌ ELIMINADO: La sección `assetsInclude` y `css` que causaban el error.
  // Vite maneja los archivos CSS correctamente por defecto.
  
  // La configuración de build es correcta
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      }
    }
  }
});