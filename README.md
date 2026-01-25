# CRM EZpermitsTX

CRM full-stack con **React + Vite** en el frontend y **Node.js + Express** en el backend, con **PostgreSQL** como base de datos y **Drizzle ORM** para el schema/migraciones.

> Importante: este repositorio **no debe versionar** archivos `.env` ni credenciales. Usa los archivos `*.env.example` como plantilla.

## 👤 Autor

**Reiber Lozano**

- **Email**: lozanoreiber1@gmail.com
- **LinkedIn**: https://www.linkedin.com/in/reiberlozano/

## 🧰 Stack

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14-4169E1?logo=postgresql&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle-ORM-000000?logo=drizzle&logoColor=white)

- **🖥️ Frontend**: ⚛️ React 18, ⚡ Vite 5, 🟦 TypeScript, 🎨 TailwindCSS, 🧩 Radix UI, 🔄 React Query
- **🧠 Backend**: 🟢 Node.js, 🚂 Express, 🟦 TypeScript (entrypoint `server/index.ts`) y rutas legacy en 🟨 JavaScript (carpeta `server/routes/*.js`)
- **🗄️ DB**: 🐘 PostgreSQL
- **🧬 ORM / Schema**: 🌧️ Drizzle (`shared/schema.ts` + `drizzle.config.ts`)

## 📁 Estructura del repo

```text
crm-nuevo/
├─ client/
│  ├─ src/
│  ├─ index.html
│  ├─ package.json
│  └─ .env              # NO versionar (usar .env.example)
├─ server/
│  ├─ middleware/
│  ├─ routes/
│  ├─ index.ts          # servidor principal (API + sirve el cliente en producción)
│  ├─ index.js          # servidor legacy/alterno
│  ├─ db.js
│  ├─ package.json
│  └─ .env              # NO versionar (usar .env.example)
├─ shared/
│  └─ schema.ts         # schema/tipos compartidos (Drizzle)
├─ drizzle.config.ts
├─ package.json
└─ README.md
```

- `client/`
  - App React (Vite)
  - Variables de entorno: `client/.env` (NO versionar)
- `server/`
  - API Express
  - Variables de entorno: `server/.env` (NO versionar)
  - `server/index.ts`: servidor principal (API + sirve el cliente en producción vía `dist/public`)
  - `server/index.js`: servidor alterno/legacy (solo API) — úsalo solo si sabes por qué lo necesitas
- `shared/`
  - `schema.ts`: tablas y tipos compartidos (Drizzle)
- `drizzle.config.ts`
  - Configuración Drizzle (usa `process.env.DATABASE_URL`)

## ✅ Requisitos

- Node.js 18+ (recomendado 20+)
- PostgreSQL 14+

## 🔐 Variables de entorno

### Frontend (`client/.env`)

Crea `client/.env` basado en `client/.env.example`.

- `VITE_API_URL`: URL base del backend (ej. `http://localhost:4000`)
- `VITE_SESSION_TIMEOUT_MINUTES`: timeout de sesión
- `VITE_GEMINI_API_KEY`: API key para Gemini (si aplica)

### Backend (`server/.env`)

Crea `server/.env` basado en `server/.env.example`.

- `PORT`: puerto del server
- `JWT_SECRET`: secreto para firmar JWT
- DB (elige uno):
  - `DATABASE_URL`: string de conexión Postgres (requerido por Drizzle y algunos módulos)
  - o variables individuales: `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`

## 📦 Instalación

Instala dependencias del proyecto (root):

```bash
npm install
```

Opcionalmente, también puedes instalar dentro de `client/` y `server/` si trabajas por separado:

```bash
npm install
# o
cd client && npm install
cd server && npm install
```

## 🗄️ Base de datos (Drizzle)

Este repo usa `drizzle.config.ts` apuntando a:

- `schema`: `./shared/schema.ts`
- `out`: `./migrations`
- `dbCredentials.url`: `process.env.DATABASE_URL`

Para aplicar cambios a la DB (según tu flujo):

```bash
npm run db:push
```

> Asegúrate de tener `DATABASE_URL` configurado en tu `server/.env` o en el entorno.

## 🧪 Ejecución en desarrollo

El script del root levanta el backend (TypeScript):

```bash
npm run dev
```

Si quieres correr el frontend por separado:

```bash
npm run dev --prefix client
```

Notas:

- El backend expone rutas bajo `/api/*`.
- En desarrollo, la app puede usar `VITE_API_URL` para apuntar a la API.

## 🚀 Build y producción

Compila client + server bundle:

```bash
npm run build
```

Luego inicia el servidor:

```bash
npm start
```

Esto debería servir:

- API (Express)
- Frontend estático desde `dist/public`

## 🔌 Endpoints (referencia rápida)

- `GET /api/leads`
- `GET /api/routes`
- `GET /api/appointments`
- `GET /api/dashboard/stats`

Auth (ruta legacy):

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/verify`

## 🛡️ Seguridad

- No versionar `.env`.
- Rota cualquier credencial si se compartió/subió en algún momento.
- No hardcodear API keys en el frontend; `VITE_*` se expone al navegador.
- Para producción, configura CORS/orígenes permitidos y usa HTTPS.

## 📌 Convenciones

- Mantén el schema en `shared/schema.ts`.
- Cambios de DB: aplica con Drizzle (evita editar tablas manualmente sin reflejar el schema).

## 🧯 Troubleshooting

- **Error de conexión a DB**: revisa `DATABASE_URL` o variables `DB_*`.
- **JWT inválido**: revisa `JWT_SECRET` y expiración del token.
- **CORS**: revisa la configuración de `cors()` en el servidor.
