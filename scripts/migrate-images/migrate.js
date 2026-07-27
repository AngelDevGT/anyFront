/**
 * Migración de imágenes (una sola vez).
 *
 * Por cada blob "original" del contenedor:
 *   1. (Opcional) respalda el original en un contenedor de backup.
 *   2. Redimensiona a máx. 1280px y sobreescribe el mismo blob (la BD no cambia).
 *   3. Genera un thumbnail de máx. 300px y lo sube como {nombre}_thumb.{ext}.
 *   4. Aplica Cache-Control agresivo (los nombres son únicos e inmutables).
 *
 * Es idempotente: salta los blobs que ya son thumbnails y (por defecto) los que
 * ya tienen su thumb generado.
 *
 * Uso:
 *   1. Copiar .env.example a .env y completar las variables.
 *   2. npm install
 *   3. npm run migrate            # ejecución real
 *      DRY_RUN=true npm run migrate   # simulación (no escribe nada)
 *
 * IMPORTANTE: después de correr esto, ejecutar el UPDATE de
 * src/database/migrations/2026-07-06-add-thumb-column.sql para poblar la columna thumb.
 */

require('dotenv').config();
const { BlobServiceClient } = require('@azure/storage-blob');
const sharp = require('sharp');

// ---------- Configuración (vía variables de entorno) ----------
const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.CONTAINER_NAME || 'image-container';
const BACKUP_CONTAINER = process.env.BACKUP_CONTAINER || ''; // vacío = sin backup
const DRY_RUN = String(process.env.DRY_RUN || '').toLowerCase() === 'true';
const SKIP_EXISTING_THUMBS = String(process.env.SKIP_EXISTING_THUMBS || 'true').toLowerCase() === 'true';

const FULL_MAX = 1280;
const THUMB_MAX = 300;
const FULL_QUALITY = 75;
const THUMB_QUALITY = 70;
const CACHE_CONTROL = 'public, max-age=2592000'; // 30 días

const THUMB_SUFFIX = '_thumb';
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;

// ---------- Helpers ----------
function isThumbName(name) {
    // foto_thumb.jpg  ó  foto_thumb (sin extensión)
    return new RegExp(`${THUMB_SUFFIX}(\\.[^.]+)?$`, 'i').test(name);
}

function buildThumbName(name) {
    // Inserta _thumb antes de la extensión; si no hay extensión, lo agrega al final.
    return IMAGE_EXT.test(name)
        ? name.replace(/(\.[^.]+)$/, `${THUMB_SUFFIX}$1`)
        : `${name}${THUMB_SUFFIX}`;
}

function contentTypeFor(name) {
    const ext = (name.match(/\.([^.]+)$/) || [, 'jpeg'])[1].toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'gif') return 'image/gif';
    return 'image/jpeg';
}

async function streamToBuffer(readable) {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

async function resize(buffer, maxSide, quality) {
    // Sólo reduce si excede el lado máximo (withoutEnlargement).
    return sharp(buffer)
        .rotate() // respeta la orientación EXIF
        .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
}

// ---------- Main ----------
async function main() {
    if (!CONNECTION_STRING) {
        console.error('ERROR: falta AZURE_STORAGE_CONNECTION_STRING en el .env');
        process.exit(1);
    }

    console.log(`Contenedor:        ${CONTAINER_NAME}`);
    console.log(`Backup:            ${BACKUP_CONTAINER || '(desactivado)'}`);
    console.log(`Modo:              ${DRY_RUN ? 'DRY RUN (simulación)' : 'REAL'}`);
    console.log('---------------------------------------------');

    const service = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
    const container = service.getContainerClient(CONTAINER_NAME);

    let backup = null;
    if (BACKUP_CONTAINER) {
        backup = service.getContainerClient(BACKUP_CONTAINER);
        if (!DRY_RUN) await backup.createIfNotExists();
    }

    // Índice de blobs existentes (para saber si un thumb ya existe).
    const existing = new Set();
    for await (const b of container.listBlobsFlat()) existing.add(b.name);

    let processed = 0, skipped = 0, errors = 0;

    for (const name of existing) {
        // Saltar thumbs y no-imágenes.
        if (isThumbName(name)) { continue; }
        if (!IMAGE_EXT.test(name)) { skipped++; continue; }

        const thumbName = buildThumbName(name);
        if (SKIP_EXISTING_THUMBS && existing.has(thumbName)) {
            skipped++;
            continue;
        }

        try {
            const src = container.getBlockBlobClient(name);
            const original = await streamToBuffer((await src.download()).readableStreamBody);

            // respalda el original antes de sobreescribir (si hay contenedor de backup)
            if (backup && !DRY_RUN) {
                await backup.getBlockBlobClient(name).uploadData(original, {
                    blobHTTPHeaders: { blobContentType: contentTypeFor(name) },
                });
            }

            const fullBuf = await resize(original, FULL_MAX, FULL_QUALITY);
            const thumbBuf = await resize(original, THUMB_MAX, THUMB_QUALITY);

            if (!DRY_RUN) {
                // 1) sobreescribe el full con el mismo nombre
                await src.uploadData(fullBuf, {
                    blobHTTPHeaders: { blobContentType: 'image/jpeg', blobCacheControl: CACHE_CONTROL },
                });
                // 2) sube el thumb
                await container.getBlockBlobClient(thumbName).uploadData(thumbBuf, {
                    blobHTTPHeaders: { blobContentType: 'image/jpeg', blobCacheControl: CACHE_CONTROL },
                });
            }

            processed++;
            console.log(
                `[${processed}] ${name}  ` +
                `full ${(original.length / 1024).toFixed(0)}KB -> ${(fullBuf.length / 1024).toFixed(0)}KB | ` +
                `thumb ${(thumbBuf.length / 1024).toFixed(0)}KB (${thumbName})`
            );
        } catch (err) {
            errors++;
            console.error(`  ERROR con ${name}:`, err.message);
        }
    }

    console.log('---------------------------------------------');
    console.log(`Procesadas: ${processed} | Saltadas: ${skipped} | Errores: ${errors}`);
    console.log('\nRecordá correr el UPDATE de la BD:');
    console.log('  src/database/migrations/2026-07-06-add-thumb-column.sql');
}

main().catch((e) => { console.error(e); process.exit(1); });
