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
| Suelos | `/soil-analyses`, `/farms/:farmId/soil-analyses`, `/lots/:lotId/soil-analyses`, `/recommendations`, `/soil-reference-ranges` | Análisis con diagnóstico automático, recomendaciones y catálogo de rangos de referencia |
| Ambiente | `/environment` | Condiciones ambientales |
| Bioinsumos | `/bioinputs`, `/farms/:farmId/bioinputs`, `/bioinputs/:id`, `/bioinputs/applications` | Elaboración, composición, aplicaciones y trazabilidad |
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
- Al registrar un análisis de suelo se genera un diagnóstico por parámetro
  (`BAJO`, `OPTIMO`, `ALTO` o `SIN_REFERENCIA`) comparando contra el catálogo
  `SoilReferenceRange`, que administran los técnicos. Un rango específico del
  cultivo del lote tiene prioridad sobre el general. El rango usado se copia al
  diagnóstico, y cada valor fuera de rango genera una recomendación automática.
  Todo se guarda en una sola transacción.
- Análisis, recomendaciones, bioinsumos y aplicaciones validan que lote, labor
  y bioinsumo pertenezcan a la misma finca, y quedan en el log de auditoría.

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

## Pruebas

```bash
npm test
```

Las pruebas de integración (`*.integration.spec.ts`) corren solo si
`TEST_DATABASE_URL` apunta a una base PostgreSQL de prueba con las migraciones
aplicadas. **Borran los datos de esa base**: nunca uses la de Supabase.

```bash
docker run -d --name rizomas-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16-alpine
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/postgres
DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
npm test
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
