#!/bin/sh

#echo "Generating config.json..."
#cat <<EOF > /usr/share/nginx/html/config.json
#{
#  "VITE_BACKEND_BASE_URL": "${BACKEND_BASE_URL}"
#}
#EOF

# Se APP_ENV_LABEL è valorizzata (es. DEV) la antepone al titolo della pagina
if [ -n "${APP_ENV_LABEL}" ]; then
  LABEL=$(printf '%s' "${APP_ENV_LABEL}" | sed -e 's/[&|\\]/\\&/g' -e 's/</\&lt;/g')
  sed -i "s|<title>|<title>[${LABEL}] |" /usr/share/nginx/html/index.html
fi

echo "Configuring nginx proxy..."
# Usa envsubst per sostituire BACKEND_BASE_URL nel file di template
envsubst '${BACKEND_BASE_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

exec nginx -g "daemon off;"