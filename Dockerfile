FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app ./
EXPOSE 8080
CMD ["sh", "-c", "node scripts/with-app-env.mjs vite preview --host 0.0.0.0 --port ${PORT:-8080}"]
