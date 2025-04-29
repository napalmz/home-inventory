#!/bin/sh

#echo "Generating config.json..."
#cat <<EOF > /usr/share/nginx/html/config.json
#{
#  "VITE_BACKEND_BASE_URL": "${BACKEND_BASE_URL}"
#}
#EOF

echo "Configuring nginx proxy..."
# Usa envsubst per sostituire BACKEND_BASE_URL nel file di template
envsubst '${BACKEND_BASE_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

exec nginx -g "daemon off;"