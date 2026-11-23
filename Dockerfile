# Partimos de Nginx oficial para servir la aplicación web sin necesitar un servidor Node.
FROM nginx:stable-alpine

# Render usa el puerto 10000 por defecto; si configura otro, esta variable se puede sustituir.
ENV PORT=10000

# Nginx procesa esta plantilla al arrancar y coloca el puerto efectivo del servicio.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Guardamos la plantilla privada de configuración fuera del directorio público del sitio.
COPY nginx/runtime-config.js.template /etc/app/runtime-config.js.template

# Antes de iniciar Nginx, este script crea runtime-config.js con las variables de Render.
COPY docker/10-render-runtime-config.sh /docker-entrypoint.d/10-render-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/10-render-runtime-config.sh

# Copiamos solo los recursos públicos del juego: el inicializador de base de datos queda fuera.
COPY index.html /usr/share/nginx/html/index.html
COPY style.css /usr/share/nginx/html/style.css
COPY app.js /usr/share/nginx/html/app.js
COPY auth.js /usr/share/nginx/html/auth.js
COPY game.js /usr/share/nginx/html/game.js

# Declaramos el puerto HTTP que el contenedor expone a Render.
EXPOSE 10000

# Mantenemos Nginx en primer plano para que Docker supervise el proceso del servicio.
CMD ["nginx", "-g", "daemon off;"]
