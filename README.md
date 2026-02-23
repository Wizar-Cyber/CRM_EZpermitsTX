# CRM System

Sistema de gestión de relaciones con clientes (CRM) para EZ Permits.

## Estructura del Proyecto

```
/opt/crm/
├── client/                 # Frontend React + TypeScript
│   ├── src/
│   │   ├── components/     # Componentes reutilizables
│   │   │   ├── ui/         # Primitivos UI (shadcn/ui)
│   │   │   ├── settings/   # Paneles de configuración
│   │   │   └── maps/       # Componentes de mapas
│   │   ├── features/
│   │   │   └── hooks/      # Custom hooks (useAuth, useToast, etc.)
│   │   ├── lib/            # Utilidades y API client
│   │   └── pages/          # Páginas/vistas principales
│   ├── public/             # Assets estáticos
│   └── dist/               # Build de producción (generado)
│
├── server/                 # Backend Express + PostgreSQL
│   ├── routes/             # Endpoints REST API
│   ├── middleware/         # Auth, roles, etc.
│   └── utils/              # Utilidades (audit, etc.)
│
├── shared/                 # Código compartido
│   └── schema.ts           # Esquemas Drizzle ORM
│
└── scripts/                # Scripts de deployment
    ├── release.sh          # Publicar nueva versión
    ├── rollback.sh         # Revertir a versión anterior
    └── write-build-info.mjs
```

## Stack Tecnológico

### Frontend
- **React 19** + TypeScript
- **Vite** - Build tool
- **TanStack Query** - Data fetching y cache
- **shadcn/ui** - Componentes UI (Radix + Tailwind)
- **Leaflet** - Mapas interactivos
- **Wouter** - Routing ligero
- **React Big Calendar** - Calendario de citas

### Backend
- **Express 5** - Framework web
- **PostgreSQL** - Base de datos
- **Drizzle ORM** - ORM con type safety
- **JWT** - Autenticación
- **bcryptjs** - Hash de contraseñas

## Comandos

### Frontend

```bash
cd client

# Desarrollo
npm run dev

# Build producción
npm run build

# Type checking
npm run check
```

### Backend

```bash
cd server

# Desarrollo (con nodemon o similar)
node index.js

# Con PM2
pm2 start index.js --name crm-backend
```

### Deployment

```bash
# Publicar nueva versión (frontend + reinicio backend)
./scripts/release.sh

# Rollback a versión anterior
./scripts/rollback.sh

# Rollback a versión específica
./scripts/rollback.sh 20260223-120000
```

## Módulos Principales

| Página | Descripción |
|--------|-------------|
| `/` | Dashboard con métricas |
| `/leads` | Gestión de leads (tabla filtrable) |
| `/delivery` | Leads en estado Delivery/Follow-up |
| `/clients` | Gestión de clientes (Kanban) |
| `/routes` | Planificación de rutas |
| `/appointments` | Calendario de citas |
| `/map` | Vista de mapa con leads/clientes |
| `/settings` | Configuración del sistema |

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Autenticación |
| `GET` | `/api/leads` | Listar leads |
| `POST` | `/api/leads/:id/create-client` | Convertir lead a cliente |
| `GET` | `/api/clientes` | Listar clientes |
| `PATCH` | `/api/clientes/:id/status` | Actualizar estado cliente |
| `GET` | `/api/routes` | Listar rutas |
| `POST` | `/api/routes` | Crear ruta |
| `GET` | `/api/appointments` | Listar citas |
| `POST` | `/api/appointments` | Crear cita |
| `GET` | `/api/dashboard/stats` | Métricas dashboard |
| `GET` | `/api/admin/users` | Listar usuarios (admin) |

## Configuración

### Variables de Entorno

**Frontend** (`client/.env`)
```env
VITE_API_URL=/api
```

**Backend** (`server/.env`)
```env
PORT=4000
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-secret-key
CORS_ORIGINS=http://localhost:5173
```

## Documentación Adicional

- [DEPLOYMENT.md](DEPLOYMENT.md) - Guía de deployment detallada
- [TECH_AUDIT_2026-02-22.md](TECH_AUDIT_2026-02-22.md) - Auditoría técnica
- [design_guidelines.md](design_guidelines.md) - Guías de diseño UI/UX
