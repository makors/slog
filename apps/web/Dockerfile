FROM node:22-bookworm-slim

RUN npm install --global bun@1.3.6

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/package.json
COPY apps/cli/package.json apps/cli/package.json

RUN bun install --frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["sh", "scripts/docker-web-dev.sh"]
