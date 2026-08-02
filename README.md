# anyFront — Portal de Embutidos ANY

Angular 15. Gestión de inventario y punto de venta: materia prima, proveedores, pedidos,
inventarios de fábrica/bodega/tienda, productos terminados, ventas y cierre de caja.

El backend es [`any_func_sql`](https://github.com/AngelDevGT/any_func_sql).

---

## Levantar el entorno

### 1. Backend

El portal no funciona solo. Primero, en un clon de `any_func_sql`:

```bash
cd ../any_func_sql
cp .env.example .env
docker compose up -d
```

Eso deja la API en `http://localhost:7071` con la base ya cargada con datos de prueba.

### 2. Portal

Único requisito: **Docker**.

```bash
docker compose up
```

Primera vez: varios minutos (`npm install` dentro del contenedor). Después,
**http://localhost:4200** con recarga automática al guardar.

```
Usuario de prueba:  admin.local@test.com  /  Local2026!   (rol Sistema, acceso completo)
```

```bash
docker compose logs -f web
docker compose down
```

### Sin Docker

```bash
npm install
npm run start:local     # contra el backend local (localhost:7071)
npm start               # contra el backend de Azure
```

---

## Entornos

Tres configuraciones, en `src/environments/`:

| Archivo | Cuándo se usa | Apunta a |
|---|---|---|
| `enviroment.ts` | `npm start`, y el build de producción | Azure |
| `enviroment.local.ts` | `npm run start:local` y el contenedor | `localhost:7071` |
| `enviroment.prod.ts` | (definido, hoy sin uso) | Azure |

> Los nombres tienen una errata histórica: es `enviroment`, sin la primera `n`. Cambiarla obliga
> a tocar todos los imports y `angular.json`.

**Para apuntar al backend local no se edita ningún archivo**: la configuración `local` de
`angular.json` sustituye `enviroment.ts` por `enviroment.local.ts` con `fileReplacements`. Así
nunca se despliega a producción apuntando a `localhost` por descuido.

`angular.json` no define `fileReplacements` para `production`, así que el build de producción usa
`enviroment.ts`. Es intencional; si algún día se activa, hay que mantener los dos archivos
alineados.

---

## Arquitectura

### Rutas y permisos

Todo cuelga de `AdminLayoutComponent`, protegido por el guard `canActivateV2`
([`src/app/helpers/auth.guard.ts`](src/app/helpers/auth.guard.ts)), que compara la URL destino
contra expresiones regulares almacenadas en `user.role.paths[].matchPattern`.

> **El acceso a las páginas viene de la base de datos.** Una página nueva necesita, además de su
> ruta en [`admin-layout.routing.ts`](src/app/layouts/admin-layout/admin-layout.routing.ts), una
> entrada en la columna `paths` del rol correspondiente. El mismo dato arma el menú lateral.

`/account/login` y `/account/register` son públicas.

### Sesión

`AccountService.login` guarda en `localStorage` el access token, el refresh token y el perfil.
`JwtInterceptor` adjunta `Authorization: Bearer` a todo lo que salga hacia `apiUrlBase` (salvo
`/Login`, `/Refresh`, `/Logout` y `/RegisterUser`) y, ante un 401, renueva la sesión con
`/Refresh` y reintenta la petición una sola vez. Si el refresh falla, `ErrorInterceptor` cierra
la sesión.

> En `app.module.ts` el orden de los interceptores importa: en la respuesta se ejecutan al revés
> que en la petición, así que `ErrorInterceptor` va declarado **antes** que `JwtInterceptor`.
> Invertirlos haría logout sin intentar renovar.

### Servicios

| Servicio | Para qué |
|---|---|
| `DataService` (`services/data/data.service.ts`) | Cliente HTTP de todo el dominio. También exporta `statusValues`, el catálogo de estados |
| `AccountService` (`services/account.service.ts`) | Sesión, tokens y el menú por rol |
| `AlertService` | Notificaciones (`.success()`, `.error()`, `.info()`, `.warn()`) |
| `PdfService`, `ExcelService` | Exportación |
| `PaginationStateService` | Conserva la página al volver desde un detalle |

Código muerto, no extender: `data2.service.ts` (de otro proyecto), `session.service.ts` y
`headers.service.ts` (sustituidos por `AccountService` y `JwtInterceptor`), `helpers/fake-backend.ts`
y `models/to-delete/`.

### Páginas y componentes

`src/app/pages/<dominio>/{list,view,add-edit}/` es la estructura estándar. Los componentes
reutilizables están en `src/app/components/` (`responsive-table`, `data-table`, `dynamic-dialog`,
`view-object`, `product-card`, `alert`, `sidebar`, `navbar`) vía `ComponentsModule`.

---

## `src/database/` — el backend vive aquí

Aunque este es el repositorio del frontend, **la lógica del backend está en este directorio**.
`any_func_sql` es un gateway genérico que ejecuta el SQL guardado en la tabla `sql_queries`.

| Archivo | Contenido |
|---|---|
| `definitions.sql` | Esquema PostgreSQL |
| `store_procedures.sql` | Procedimientos: normalización a unidad base, traslados entre inventarios, cierres |
| `data.sql` | Siembra `sql_queries`, **la tabla que define los endpoints disponibles** |
| `migrations/` | Cambios con fecha, más algunos `migration_*.sql` sueltos |

Consecuencia práctica: **agregar o cambiar un endpoint de datos es una fila SQL**, no TypeScript.
Para saber qué endpoints existen y qué devuelven, `data.sql` es la fuente de verdad.

Nota: estos archivos han quedado por detrás de producción (faltan tablas y endpoints). El
`seed/` de `any_func_sql` sí refleja el estado real y es el que conviene usar para desarrollar.

---

## Despliegue

Azure Static Web Apps, **desde la rama `produccion`**
(`.github/workflows/azure-static-web-apps-black-grass-0603bd40f.yml`). Publica
`dist/embutidos-any`.

> Hay un segundo workflow, `...lemon-ground-...`, que sigue disparando en `master`. Ambos están
> activos.

Los archivos de desarrollo (`docker/`, `docker-compose.yml`, `.dockerignore`) no intervienen: la
compilación es `npm run build` y sólo se publica el bundle.

---

## Notas

- **Las imágenes existentes no se ven en local.** Están en el Storage de producción y el portal
  las lee por URL directa; en local no hay acceso anónimo. Las que subas van al Azurite del
  backend.
- Los datos de prueba son reales pero anonimizados: correos `@local.test`, clientes `Cliente NN`.
  Cantidades, montos y fechas son auténticos, así que los reportes cuadran.
- `npm test` usa Karma y necesita Chrome; no corre dentro del contenedor.
