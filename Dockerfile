# Railway production image for Ruksha Discipline (Telegram Mini App).
# Listens on 0.0.0.0:$PORT — Railway injects PORT, do not hard-bind 127.0.0.1.

FROM node:22-bookworm-slim AS build
WORKDIR /app

ENV NODE_ENV=development \
    npm_config_audit=false \
    npm_config_fund=false \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    VITE_AUTH_ENABLED=false

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    VITE_AUTH_ENABLED=false \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PATH="/app/node_modules/.bin:${PATH}"

COPY --from=build /app /app

RUN useradd --create-home --uid 1001 app \
  && chown -R app:app /app
USER app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=8s --start-period=40s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "scripts/railway-start.mjs"]
