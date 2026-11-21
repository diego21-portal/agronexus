#!/usr/bin/env bash
# Ephemeral CI only. Uses prebuilt :ci images, a fresh SQLite DB and a test CA.
# The deployment smoke itself remains read-only in ops/smoke.sh.
set -euo pipefail
test_dir=$(mktemp -d)
cleanup() {
  docker logs agronexus-ci-web 2>&1 || true
  docker logs agronexus-ci-proxy 2>&1 || true
  docker rm -f agronexus-ci-proxy agronexus-ci-web >/dev/null 2>&1 || true
  docker volume rm agronexus-ci-static >/dev/null 2>&1 || true
  docker network rm agronexus-ci >/dev/null 2>&1 || true
  rm -rf "$test_dir"
}
trap cleanup EXIT

docker run --rm \
  -e SECRET_KEY=agronexus-ci-only-secret-key-for-settings-validation-2026 \
  -e ALLOWED_HOSTS=app.test,api.test \
  -e DATABASE_URL=postgresql://ci:ci@database.invalid/ci \
  -e CORS_ALLOWED_ORIGINS=https://app.test \
  -e CSRF_TRUSTED_ORIGINS=https://app.test,https://api.test \
  agronexus-backend:ci python manage.py check --deploy --tag security

docker network create agronexus-ci >/dev/null
docker volume create agronexus-ci-static >/dev/null
docker run -d --name agronexus-ci-web --network agronexus-ci --network-alias web \
  -e DJANGO_SETTINGS_MODULE=config.settings.local \
  -e ALLOWED_HOSTS=app.test,api.test,127.0.0.1 \
  -e DB_ENGINE=django.db.backends.sqlite3 -e DB_NAME=/tmp/smoke.sqlite3 \
  -v agronexus-ci-static:/app/staticfiles \
  agronexus-backend:ci sh -c 'python manage.py migrate --noinput && python manage.py collectstatic --noinput && exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 1' >/dev/null

mkdir "$test_dir/tls"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -keyout "$test_dir/tls/privkey.pem" -out "$test_dir/tls/fullchain.pem" \
  -subj /CN=app.test -addext subjectAltName=DNS:app.test,DNS:api.test 2>/dev/null
docker run -d --name agronexus-ci-proxy --network agronexus-ci \
  -e APP_DOMAIN=app.test -e API_DOMAIN=api.test -e HTTPS_PORT=18443 \
  -p 127.0.0.1:18080:80 -p 127.0.0.1:18443:443 \
  -v "$test_dir/tls:/etc/nginx/tls:ro" \
  -v agronexus-ci-static:/srv/staticfiles:ro \
  agronexus-frontend:ci >/dev/null

# GitHub's disposable runner; never apply these host entries to production.
printf '127.0.0.1 app.test api.test\n' | sudo tee -a /etc/hosts >/dev/null
export NO_PROXY="${NO_PROXY:+$NO_PROXY,}app.test,api.test"
for attempt in {1..60}; do
  if curl --silent --fail --cacert "$test_dir/tls/fullchain.pem" https://app.test:18443/api/v1/products/ >/dev/null; then
    break
  fi
  if [[ "$attempt" == 60 ]]; then exit 1; fi
  sleep 1
done
docker exec agronexus-ci-proxy nginx -t
redirect=$(curl --silent -o /dev/null -w '%{redirect_url}' http://app.test:18080/account/orders)
[[ "$redirect" == https://app.test:18443/account/orders ]]
APP_ORIGIN=https://app.test:18443 API_ORIGIN=https://api.test:18443 \
  CA_CERT="$test_dir/tls/fullchain.pem" bash ops/smoke.sh
