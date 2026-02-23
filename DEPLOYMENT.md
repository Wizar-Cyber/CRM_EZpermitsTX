# Deployment Guide (CRM)

Este documento deja un flujo simple y repetible para publicar cambios en el servidor.

## 1) Requisitos en servidor

- Código actualizado en `/opt/crm`
- Nginx (u otro web server) sirviendo el frontend desde una carpeta estática (por defecto `/var/www/crm`)
- Backend Express corriendo como servicio `systemd` (opcional, recomendado)
- Node.js + npm instalados

## 2) Variables recomendadas

### Frontend

`client/.env.production`

```env
VITE_API_URL=/api
```

### Backend

`server/.env`

```env
PORT=4000
CORS_ORIGINS=http://69.62.69.98:8081,http://localhost:5173,http://127.0.0.1:5173
```

> Nota: `server/index.js` ya quedó preparado para leer `CORS_ORIGINS` o `CORS_ORIGIN` (CSV).

## 3) Publicar una nueva versión

Desde el servidor:

```bash
cd /opt/crm
bash scripts/release.sh
```

El script ahora hace restart automático del backend en este orden:

1. Si defines `SERVER_SERVICE_NAME`, reinicia `systemd`.
2. Si no, intenta PM2 con `PM2_PROCESS_NAME` (por defecto `crm-backend`).
3. Si no encuentra backend, continúa y lo reporta en logs.

Además, el release ahora:

- Crea backup del frontend anterior en `/var/www/crm-releases/<timestamp>`
- Mantiene por defecto las últimas `5` versiones (configurable con `KEEP_RELEASES`)

### Si tienes nombre de servicio backend

```bash
cd /opt/crm
SERVER_SERVICE_NAME=crm-server \
CLIENT_DIST_TARGET=/var/www/crm \
bash scripts/release.sh
```

### Si quieres forzar otro nombre de proceso PM2

```bash
cd /opt/crm
PM2_PROCESS_NAME=mi-proceso-crm bash scripts/release.sh
```

### Variables opcionales útiles

```bash
CLIENT_DIST_TARGET=/var/www/crm
RELEASES_DIR=/var/www/crm-releases
KEEP_RELEASES=8
PM2_PROCESS_NAME=crm-backend
```

## 4.1) Rollback rápido

Volver al último backup:

```bash
cd /opt/crm
bash scripts/rollback.sh
```

Volver a una versión específica:

```bash
cd /opt/crm
bash scripts/rollback.sh 20260221-180508
```

Listar backups disponibles:

```bash
ls -1dt /var/www/crm-releases/* | head
```

## 4) Verificar que sí se publicó

- Revisar build metadata:

```bash
curl -s http://69.62.69.98:8081/build-info.json
```

Debe cambiar `builtAt` en cada deploy.

## 5) Si no ves cambios en navegador

1. Forzar recarga (`Ctrl+F5`) o abrir en incógnito.
2. Verificar `build-info.json` en la URL pública.
3. Confirmar que Nginx apunta al mismo `CLIENT_DIST_TARGET` usado por `release.sh`.
4. Revisar caché de `index.html` en Nginx (recomendado no-cache para index).

Ejemplo recomendado en Nginx:

```nginx
location = /index.html {
  add_header Cache-Control "no-cache, no-store, must-revalidate";
}

location /assets/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

## 6) Flujo sugerido para futuras actualizaciones

1. `git pull`
2. `bash scripts/release.sh`
3. `curl /build-info.json`
4. smoke test de login/leads/rutas
5. si algo falla: `bash scripts/rollback.sh`

