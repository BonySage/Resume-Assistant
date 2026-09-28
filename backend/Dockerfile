# Backend API image. Build from the repo root so db/migrations is included:
#   docker compose build backend
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app/backend

# Install dependencies first so this layer is cached between code changes.
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY backend/src ./src
# migrate.js reads ../../db/migrations relative to src/, i.e. /app/db/migrations.
COPY db/migrations /app/db/migrations

# Uploaded resumes live on a volume (see docker-compose.yml).
ENV UPLOAD_DIR=/app/uploads
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 3000
# Apply any pending migrations, then start the API. `exec` makes node PID 1 so
# `docker stop` (SIGTERM) reaches it and it can shut down gracefully.
CMD ["sh", "-c", "node src/migrate.js && exec node src/index.js"]
