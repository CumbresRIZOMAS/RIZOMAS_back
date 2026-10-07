#!/usr/bin/env bash
# Levanta el backend en local contra un PostgreSQL desechable en Docker.
#
#   ./scripts/dev-local.sh                 # base + migraciones + API en :3000
#   ./scripts/dev-local.sh tu@correo.com   # además crea tu usuario TECNICO
#
# No modifica tu .env: las variables de abajo solo aplican a esta ejecución
# (tienen prioridad sobre .env). El login usa el Supabase real del proyecto,
# así que el correo debe existir también en Supabase Auth.
set -euo pipefail

CONTAINER=rizomas-pg
DB_PORT=55432
EMAIL="${1:-}"
ROLE="${ROLE:-TECNICO}"
SUPABASE_REF=jbrslictkcyjwlvzabxo

cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  echo "✗ Docker no está corriendo. Abre Docker Desktop y vuelve a intentar." >&2
  exit 1
fi

if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "• PostgreSQL ya estaba corriendo ($CONTAINER)"
elif docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "• Arrancando PostgreSQL ($CONTAINER)"
  docker start "$CONTAINER" >/dev/null
else
  echo "• Creando PostgreSQL ($CONTAINER) en el puerto $DB_PORT"
  docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres -p "$DB_PORT:5432" postgres:16-alpine >/dev/null
fi

for _ in $(seq 1 30); do
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

export DATABASE_URL="postgresql://postgres:postgres@localhost:$DB_PORT/postgres"
export SUPABASE_URL="https://$SUPABASE_REF.supabase.co"
export SUPABASE_JWKS_URL="$SUPABASE_URL/auth/v1/.well-known/jwks.json"
export SUPABASE_JWT_SECRET=""
export CORS_ORIGIN="http://localhost:5173"
export PORT=3000
export PRISMA_HIDE_UPDATE_MESSAGE=1

[ -d node_modules ] || { echo "• Instalando dependencias"; npm install --silent; }

echo "• Aplicando migraciones"
npx prisma migrate deploy >/dev/null
npx prisma generate >/dev/null

if [ -n "$EMAIL" ]; then
  # psql solo interpola :'variables' cuando el SQL entra por stdin.
  docker exec -i "$CONTAINER" psql -qU postgres -v ON_ERROR_STOP=1 -v email="$EMAIL" -v role="$ROLE" >/dev/null <<'SQL'
INSERT INTO "User"(id, name, email, role, "updatedAt")
VALUES (gen_random_uuid(), split_part(:'email', '@', 1), :'email', :'role', now())
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, active = true;
SQL
  echo "• Usuario $EMAIL listo con rol $ROLE"
fi

echo
echo "✓ Base lista. Arrancando la API en http://localhost:$PORT/api/v1 (Ctrl+C para detener)"
echo "  Salud:   curl http://localhost:$PORT/api/v1/health"
echo "  Panel:   en rizomas-web, .env con VITE_API_URL=http://localhost:$PORT y luego npm run dev"
echo "  Borrar la base de prueba: docker rm -f $CONTAINER"
echo
exec npm run start:dev
