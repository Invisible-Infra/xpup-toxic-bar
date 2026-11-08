FROM node:22-alpine
WORKDIR /qa
COPY runner.js /qa/runner.js
RUN chmod 0644 /qa/runner.js
ENTRYPOINT ["node", "/qa/runner.js"]
