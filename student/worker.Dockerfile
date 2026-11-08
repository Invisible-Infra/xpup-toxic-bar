# Local-only worker image. Do not change deploy/* Dockerfiles used by VPS.
# Source paths are relative to the repository-root build context.
FROM node:22-alpine
WORKDIR /app
ARG WORKER_DIR
COPY ${WORKER_DIR}/server.js /app/server.js
# Git checkout may preserve restrictive 0600 source permissions.
RUN chmod 0644 /app/server.js
USER 65532:0
CMD ["node", "server.js"]
