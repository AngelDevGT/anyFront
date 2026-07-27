# Migración de imágenes → thumbnails

Script de **una sola vez** para las imágenes **ya existentes** en Azure Blob Storage.
Redimensiona cada original y genera su miniatura (`_thumb`). No forma parte de la app
Angular (usa librerías de Node y credenciales del storage que no deben ir al frontend).

## Qué hace

Por cada blob original del contenedor:
1. (Opcional) respalda el original en `BACKUP_CONTAINER`.
2. Redimensiona a máx. **1280px** y **sobreescribe** el mismo blob → el campo `photo` de la BD sigue válido.
3. Genera un thumbnail de máx. **300px** y lo sube como `{nombre}_thumb.{ext}`.
4. Aplica `Cache-Control: public, max-age=2592000` (30 días).

Es **idempotente**: salta los blobs que ya son thumbnails y los que ya tienen su thumb.

## Uso

```bash
cd scripts/migrate-images
cp .env.example .env          # completar AZURE_STORAGE_CONNECTION_STRING
npm install

# 1) Simular primero (no escribe nada):
#    DRY_RUN=true en el .env
npm run migrate

# 2) Ejecución real: poner DRY_RUN=false en el .env
npm run migrate
```

## Después del script: poblar la BD

El script **no toca la base de datos**. Una vez subidos los thumbs, correr manualmente
en Postgres (Opción A):

```
src/database/migrations/2026-07-06-add-thumb-column.sql
```

Ese archivo agrega la columna `thumb` (si falta) y la rellena con `photo + _thumb`
para las filas existentes, dejando la BD consistente con los blobs recién creados.

## Notas

- **Backup recomendado la primera vez:** setear `BACKUP_CONTAINER=image-container-backup`
  para conservar los originales de alta resolución antes de sobreescribir.
- Todas las salidas se normalizan a **JPEG** (mejor compresión para fotos). Si necesitás
  conservar PNG con transparencia, ajustar la función `resize()` en `migrate.js`.
