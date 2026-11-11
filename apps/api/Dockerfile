# API de Cocina Central. Se construye desde la raíz del monorepo:
#   docker build -f apps/api/Dockerfile -t cocina-central-api .

ARG NODE_VERSION=24.21.0

# --- Build: instala el monorepo, compila la API y separa sus dependencias de producción ---
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /repo
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @cocina-central/api...

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @cocina-central/api build \
 && pnpm --filter @cocina-central/api deploy --prod --legacy /out \
 && cp -r apps/api/dist /out/dist

# --- Runtime: solo el bundle y las dependencias de producción ---
FROM node:${NODE_VERSION}-slim
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    API_DOCS_ENABLED=false
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>r.json()).then(b=>process.exit(b.status==='ok'?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/server.mjs"]
