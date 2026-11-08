FROM node:22-alpine
WORKDIR /app
COPY server.js ./
RUN chmod 0644 /app/server.js
USER 65532:0
EXPOSE 8080
CMD ["node", "server.js"]
