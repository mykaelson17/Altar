# BI Platform — build multi-stage (Node)
# Node 22 (não 20): o node-gyp usado para compilar o better-sqlite3 depende de
# uma função interna do Node (util.markAsUncloneable) que só existe a partir
# do Node 22 — em Node 20 o build quebra com "webidl.util.markAsUncloneable
# is not a function" antes mesmo de compilar.
FROM node:22-alpine AS build
WORKDIR /app
# libs para compilar better-sqlite3
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package.json package-lock.json* bun.lock* ./
RUN if [ -f bun.lock ]; then npm i -g bun && bun install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci || npm install; \
    else npm install; fi
COPY . .
ENV NITRO_PRESET=node-server
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libc6-compat
# O build do TanStack Start/Nitro gera tudo (server + node_modules bundlados
# + public) dentro de .output — NÃO existe pasta "dist" nesse projeto.
COPY --from=build /app/.output ./.output
RUN mkdir -p /app/data
VOLUME ["/app/data"]
ENV SQLITE_PATH=/app/data/dashboard.db
ENV PORT=3000
EXPOSE 3000
CMD ["node", "--env-file-if-exists=.env", ".output/server/index.mjs"]
