#!/bin/sh
echo "Generating config.json..."
cat <<EOF > /usr/share/nginx/html/config.json
{
  "VITE_BACKEND_BASE_URL": "${VITE_BACKEND_BASE_URL}"
}
EOF

exec nginx -g "daemon off;"