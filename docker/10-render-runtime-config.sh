#!/bin/sh
set -eu

# No arrancamos el sitio si faltan los datos públicos que necesita Supabase JS.
: "${SUPABASE_URL:?Define SUPABASE_URL en las variables de entorno de Render.}"
: "${SUPABASE_ANON_KEY:?Define la clave publicable SUPABASE_ANON_KEY en Render.}"

# Generamos el archivo que el navegador leerá, usando solo variables permitidas.
envsubst '${SUPABASE_URL} ${SUPABASE_ANON_KEY}' \
    < /etc/app/runtime-config.js.template \
    > /usr/share/nginx/html/runtime-config.js
