# Next.js template

This is a Next.js template with shadcn/ui.

## Local development with Docker

Start the web app and Postgres together:

```bash
docker compose up web
```

The app runs at http://localhost:3000 and Postgres is exposed on port `5432`.
Postgres is bound to `127.0.0.1` only, so it is reachable from your machine but not exposed to your LAN.

For local development outside Docker, copy the example env file and start only the database:

```bash
cp apps/web/.env.example apps/web/.env
docker compose up db
bun run --cwd apps/web dev
```

The default development database URL is:

```bash
postgres://slog:slog@localhost:5432/slog
```

The Docker setup uses `slog` for the default database, username, and password. Override them by setting these environment variables before running Docker Compose:

```bash
POSTGRES_DB=my_app
POSTGRES_USER=my_app
POSTGRES_PASSWORD=change-me
POSTGRES_PORT=5433
DOCKER_DATABASE_URL=postgres://my_app:change-me@db:5432/my_app
```

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```
