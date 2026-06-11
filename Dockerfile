# ─────────────────────────────────────────────────────────────────────────────
# Andante Labs Queue Manager — Next.js production image (standalone output).
# Multi-stage: install deps → build → minimal runtime as non-root with tini.
# ─────────────────────────────────────────────────────────────────────────────

# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    LOG_JSON=true
RUN apk add --no-cache tini

WORKDIR /app
# Next.js standalone bundle + static assets + public dir.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

USER node
EXPOSE 3000

# Liveness against the App Router health route.
HEALTHCHECK --interval=30s --timeout=5s --start-period=12s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini as PID 1 so SIGTERM reaches Node for a clean shutdown.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
