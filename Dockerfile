# Single-stage image with full deps so drizzle-kit (a devDependency) is present
# at runtime for migrations. Size isn't a concern for a self-hosted single-user
# tool; reliability of `db:migrate` on boot is.
FROM node:22-slim

WORKDIR /app

# Install deps first for layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# App source (node_modules/.next/.env* excluded via .dockerignore).
COPY . .

# Build the Next app. Runtime env (DB/Google/etc.) is read lazily, so the build
# doesn't need it.
RUN npm run build

EXPOSE 5050

# Apply pending migrations, then start. `next start` runs NODE_ENV=production,
# so instrumentation boots the sender + reply-sync workers.
CMD ["sh", "-lc", "npm run db:migrate && npm run start"]
