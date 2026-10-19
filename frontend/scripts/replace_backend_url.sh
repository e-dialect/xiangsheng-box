#!/usr/bin/env sh
set -eu
BACKEND_URL="${VITE_BACKEND_URL:-}"
echo "replacing backend URL with ${BACKEND_URL:-same-origin}"
if grep -rq 'VITE_BACKEND_URL_RUNTIME_REPLACEMENT' /usr/share/nginx/html; then
  find '/usr/share/nginx/html' -name '*.js' -exec sed -i -e 's,VITE_BACKEND_URL_RUNTIME_REPLACEMENT,'"$BACKEND_URL"',g' {} \;
fi
exec nginx -g "daemon off;"
