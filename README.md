# RIZOMAS Back

API backend de la plataforma agrotecnológica RIZOMAS. Está construida con
[NestJS](https://nestjs.com/), [Prisma](https://www.prisma.io/) y
PostgreSQL (Supabase).

## Requisitos

- Node.js 20 o superior.
- npm 10 o superior.
- Una base de datos PostgreSQL. Para despliegues en Render se recomienda usar
  el Transaction Pooler de Supabase.
- Un proyecto de Supabase si se utilizará autenticación JWT.

## Instalación local

```bash
npm install
copy .env.example .env
npm run prisma:generate
npm run build
```

En PowerShell, el segundo comando equivalente es:

```powershell
Copy-Item .env.example .env
```

Completa las variables de `.env` antes de iniciar la aplicación.

## Variables de entorno

Las variables disponibles están documentadas en
[.env.example](./.env.example). Las más importantes son:

| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto HTTP. Render proporciona este valor automáticamente. |
| `DATABASE_URL` | Cadena de conexión PostgreSQL usada por Prisma. |
| `SUPABASE_URL` | URL del proyecto Supabase. |
| `SUPABASE_JWT_SECRET` | Secreto JWT de Supabase, si se valida el token localmente. |
| `SUPABASE_JWKS_URL` | URL JWKS alternativa para validar tokens de Supabase. |
| `CORS_ORIGIN` | Orígenes permitidos separados por comas. |

No subas `.env` al repositorio ni compartas sus secretos. El archivo está
ignorado por Git; utiliza `.env.example` como plantilla.

### Conexión con Supabase

Para desarrollo local puede utilizarse la conexión directa de Supabase:

```text
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

Para Render utiliza preferiblemente el Transaction Pooler:

```text
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

Si la contraseña contiene caracteres especiales, codifícala usando
percent-encoding antes de colocarla en la URL.

La autenticación de la API espera un encabezado:

```http
Authorization: Bearer <supabase-access-token>
```

Las rutas marcadas como públicas no requieren token. El usuario autenticado
se relaciona con el usuario local mediante `authUserId` o correo electrónico.

### Cloudflare R2

Las evidencias usan un bucket R2 privado. El backend genera URLs prefirmadas
para que el cliente cargue o descargue archivos sin exponer las credenciales.
Configura en `.env`:

```text
R2_ACCOUNT_ID=<account-id>
R2_ACCESS_KEY_ID=<s3-access-key-id>
R2_SECRET_ACCESS_KEY=<s3-secret-access-key>
R2_BUCKET=<bucket-name>
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_SIGNED_URL_TTL_SECONDS=900
```

El token de API general de Cloudflare no se utiliza para estas operaciones S3.
Después de crear una URL de carga, el cliente debe enviar el archivo
directamente a R2 con `PUT` y el `Content-Type` solicitado; posteriormente
puede guardar el `objectKey` al crear la evidencia.

Endpoints protegidos:

```http
POST /api/v1/evidence/upload-url
POST /api/v1/evidence/download-url
```

Las claves se generan bajo `farms/<farmId>/evidence/`. No hagas público el
bucket ni subas Access Keys al repositorio. Si una credencial fue compartida
por accidente, revócala y genera otra en Cloudflare antes de usar producción.

## Base de datos y Prisma

Generar el cliente Prisma:

```bash
npm run prisma:generate
```

Crear y aplicar una migración durante el desarrollo:

```bash
npm run prisma:migrate
```

Aplicar migraciones existentes en un entorno de despliegue:

```bash
npm run prisma:migrate:deploy
```

Abrir Prisma Studio:

```bash
npm run prisma:studio
```

> **Importante:** si la base de Supabase ya fue creada o sincronizada con
> `prisma db push`, no ejecutes la migración inicial directamente sin revisar
> el estado de la base y baselinarla. Compara primero el esquema remoto con
> `prisma migrate diff` o genera una migración incremental.

### Fase 1: PostGIS, RLS y Custom Claims

La migración
`prisma/migrations/20261006150000_enable_postgis_and_rls/migration.sql`
habilita PostGIS y activa RLS en las tablas sensibles. Sus políticas relacionan
el `sub` o `email` del JWT con `User.authUserId`/`User.email` y luego validan
la pertenencia a la finca mediante `Farm.ownerId` y `FarmUser`.

Aplica la migración únicamente después de revisar el estado de la base remota:

```bash
npm run prisma:migrate:deploy
```

El archivo `supabase/auth-hook.sql` crea el Custom Access Token Hook que añade
`user_role` y `app_metadata.user_role` al token. Después de ejecutarlo en el
SQL Editor de Supabase, selecciona
`public.rizomas_custom_access_token_hook` en **Authentication > Hooks >
Custom Access Token**.

Las políticas RLS se aplican a los roles `authenticated` y `anon`. El rol
propietario que usa Prisma no se fuerza con `FORCE ROW LEVEL SECURITY`, por lo
que las validaciones de NestJS siguen siendo obligatorias para las consultas
del backend. No se debe interpretar RLS como sustituto de los Guards.

## Ejecución

Desarrollo con recarga automática:

```bash
npm run start:dev
```

Ejecución local sin recarga:

```bash
npm run start:local
```

Ejecución de producción usando el código ya compilado:

```bash
npm run build
npm start
```

El prefijo global de la API es `/api/v1`.

## Verificación de salud

La ruta pública de health check valida que la aplicación esté disponible y que
Prisma pueda conectarse a la base de datos:

```http
GET /api/v1/health
```

Respuesta esperada:

```json
{
  "status": "ok",
  "database": "ok"
}
```

## Módulos de la API

Todas las rutas están bajo `/api/v1` y, salvo las rutas públicas, requieren
un token de Supabase válido.

| Grupo | Prefijo | Responsabilidad |
| --- | --- | --- |
| Usuarios | `/users` | Usuarios, estados y miembros de fincas |
| Fincas | `/farms` | Registro y administración de fincas |
| Lotes | `/farms/:farmId/lots`, `/lots/:id` | Lotes productivos |
| Cultivos | `/crops`, `/lots/:lotId/crops` | Cultivos y seguimiento |
| Ciclos | `/cycles` | Ciclos productivos |
| Labores | `/labors`, `/harvests`, `/agronomic-management` | Labores, cosechas y manejo agronómico |
| Suelos | `/soil-analyses`, `/recommendations` | Análisis y recomendaciones |
| Ambiente | `/environment` | Condiciones ambientales |
| Bioinsumos | `/bioinputs` | Bioinsumos y aplicaciones |
| Café | `/coffee-processes` | Procesos de café |
| Evidencias | `/evidence` | Evidencias y moderación |
| Indicadores | `/indicators` | Definiciones y valores de indicadores |
| Comercial | `/commercial` | Compras, ventas y libro de movimientos |
| Trazabilidad | `/traceability` | Trazabilidad por finca y cosecha |
| Reportes | `/reports` | Reportes de producción |
| Sincronización | `/sync/batch` | Sincronización de operaciones offline |
| Publicaciones | `/publications` | Publicaciones y consulta pública |

La consulta pública de publicaciones está disponible en:

```http
GET /api/v1/publications
GET /api/v1/publications/:id
```

## Seguridad y reglas de negocio

- La autenticación JWT se aplica globalmente; las rutas públicas se declaran
  explícitamente en el código.
- El control de roles se aplica mediante `RolesGuard`.
- Las operaciones de labores validan que la finca, lote, cultivo y trabajador
  estén relacionados correctamente.
- Una labor debe asociarse exactamente a un lote o a un cultivo, nunca a ambos
  ni a ninguno.
- Las operaciones de cosecha y los eventos de auditoría se registran dentro de
  transacciones cuando corresponde.
- Las evidencias incluyen estado de moderación, revisor, fecha, puntuación y
  razón de rechazo.

## Despliegue en Render

Configura el servicio como **Web Service** conectado al repositorio y utiliza:

**Build Command**

```bash
npm install && npm run build
```

**Start Command**

```bash
npm start
```

Configura en Render las mismas variables de entorno necesarias para producción,
especialmente `DATABASE_URL`, `SUPABASE_URL` y `SUPABASE_JWKS_URL` o
`SUPABASE_JWT_SECRET`.

No uses `nest start` como comando de producción en Render: compila durante el
arranque y puede superar el límite de memoria del servicio. `npm start` ejecuta
directamente `node dist/main`.

Después de cada despliegue verifica:

```text
https://<servicio>.onrender.com/api/v1/health
```

## Scripts disponibles

| Comando | Uso |
| --- | --- |
| `npm run build` | Genera Prisma y compila NestJS |
| `npm run start:dev` | Desarrollo con watch |
| `npm start` | Arranque de producción |
| `npm run lint` | Ejecuta ESLint y aplica correcciones |
| `npm test` | Ejecuta Jest |
| `npm run prisma:generate` | Genera el cliente Prisma |
| `npm run prisma:migrate` | Crea/aplica migraciones en desarrollo |
| `npm run prisma:migrate:deploy` | Aplica migraciones en despliegue |
| `npm run prisma:studio` | Abre Prisma Studio |

## Estado y próximos pasos

El backend cuenta con los módulos principales de gestión agrícola,
trazabilidad, evidencias, indicadores, publicaciones, autenticación y
auditoría. GIS/FOLIA permanece fuera del alcance actual.

Antes de un entorno productivo se recomienda completar:

- Políticas RLS en Supabase.
- Permisos completos por finca.
- Almacenamiento privado R2 con URLs prefirmadas.
- Moderación automática de evidencias.
- Pruebas unitarias y de integración para autenticación, permisos,
  sincronización, labores y trazabilidad.
- Auditoría controlada de dependencias (`npm audit`) y actualización revisada
  de vulnerabilidades.
