# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then \
      NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci --strict-ssl=true --omit=dev; \
    else \
      npm ci --strict-ssl=true --omit=dev; \
    fi && npm cache clean --force
COPY public ./public
COPY server ./server
COPY scripts ./scripts
RUN npm run build && mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "server/index.js"]
