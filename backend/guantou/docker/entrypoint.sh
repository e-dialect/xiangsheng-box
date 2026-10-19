#!/usr/bin/env sh
set -eu

# Match the settings parser before selecting security policy or server type.
ENVIRONMENT="$(python -c 'import os; print(os.environ.get("ENVIRONMENT", "development").strip().lower())')"
export ENVIRONMENT
if [ "$ENVIRONMENT" = "production" ]; then
  if [ "$(id -u)" = "0" ]; then
    echo "Production must run with an explicit unprivileged UID" >&2
    exit 1
  fi
  export DJANGO_SETTINGS_MODULE=config.production
fi
python manage.py migrate --noinput
if ! python manage.py aggregate_product_events; then
  echo "warning: product event maintenance failed; continuing startup" >&2
fi
if [ "$ENVIRONMENT" = "production" ]; then
  exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 \
    --worker-class gthread --workers 1 --threads 2 --backlog 64 \
    --timeout 120 --graceful-timeout 30 --worker-tmp-dir /tmp \
    --access-logfile - --error-logfile - \
    --access-logformat '%(m)s %(U)s %(s)s %(L)s'
fi
exec python manage.py runserver 0.0.0.0:8000 --insecure
