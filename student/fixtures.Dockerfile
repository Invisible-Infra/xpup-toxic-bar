# Local-only fixtures image. Keep VPS bind-mount deployment unchanged.
FROM nginx:1.27-alpine
COPY deploy/fixtures/http/ /usr/share/nginx/html/
COPY deploy/fixtures/nginx-fixtures.conf /etc/nginx/conf.d/default.conf
# Git checkouts with restrictive host umask must still work for nginx workers.
RUN find /usr/share/nginx/html -type d -exec chmod 0755 {} + \
 && find /usr/share/nginx/html -type f -exec chmod 0644 {} + \
 && chmod 0644 /etc/nginx/conf.d/default.conf
