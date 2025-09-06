FROM node:20-slim AS base
ENV NODE_ENV=production
WORKDIR /app

FROM base AS deps
COPY package*.json ./
# Install production dependencies (no lockfile required)
RUN npm install --omit=dev

FROM base AS runner
# Run as non-root user
USER node
COPY --from=deps /app/node_modules /app/node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node bin ./bin

EXPOSE 3000
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]

