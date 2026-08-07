# Card Nest deployment on Coolify

The repository contains the Expo mobile application, hosted Supabase schema and tooling, and a standalone Next.js website. Coolify must deploy only the root `docker-compose.yml`; that Compose file has one service and builds with `context: ./web`.

Production website: `https://cardnest.ytosko.dev`

Health endpoint: `https://cardnest.ytosko.dev/api/health`

Supabase Auth callback: `https://cardnest.ytosko.dev/auth/callback`

## Prerequisites

1. Point the DNS `A` record for `cardnest.ytosko.dev` to the public IPv4 address of the Coolify server.
2. If an `AAAA` record exists, point it to the same server or remove it until IPv6 routing is configured.
3. Confirm the Coolify proxy is running and ports 80 and 443 reach the server.

## Create the resource

1. In Coolify, open the destination project and environment.
2. Select **New Resource**.
3. Choose **Public Repository** for a public repository. For a private repository, choose the configured **GitHub App** or **Deploy Key** connection.
4. Select or paste `https://github.com/Ytosko/card-nest`.
5. Choose the `main` branch.
6. Select **Docker Compose** as the build pack.
7. Set **Base Directory** to `/`.
8. Set **Docker Compose Location** to `/docker-compose.yml`.
9. Continue and select the `web` service.

## Attach the domain

Set the `web` service domain to:

```text
https://cardnest.ytosko.dev:3000
```

The `:3000` suffix tells Coolify that the application listens on container port 3000. Coolify still serves the public site on normal HTTPS port 443 and manages the reverse proxy and certificate. Do not add an Nginx, Caddy, or Traefik container.

## Environment variables

No Coolify environment variables are required for the initial website. `NODE_ENV`, `HOSTNAME`, and `PORT` are already defined in `docker-compose.yml` and contain no secrets.

The Expo and Supabase administration values in the repository-root `.env.example` are not web-container variables. Do not copy service-role, database, Postmark, Supabase access-token, or AI credentials into the website service.

## Deploy and verify

1. Click **Deploy**.
2. Confirm the Docker Compose build uses `web/Dockerfile` and the service reaches `healthy` state.
3. Open `https://cardnest.ytosko.dev`.
4. Verify the health endpoint:

   ```bash
   curl --fail --silent https://cardnest.ytosko.dev/api/health
   ```

5. Confirm these routes return successfully:

   ```text
   /
   /auth/callback
   /privacy
   /terms
   /api/health
   ```

## Automatic deployments

Enable automatic deployment for the `main` branch if desired. A new deployment rebuilds only `web/` because it is the sole Docker build context. The Expo application, Metro, local Supabase, and Postgres are never started by this Compose stack.

## Local container verification

From the repository root:

```bash
docker compose build
docker compose up -d
docker compose ps
docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/health').then(async r => { console.log(await r.text()); if (!r.ok) process.exit(1) })"
docker compose down
```

The Compose file intentionally does not publish a host port. The internal health check and Coolify proxy reach port 3000 on the Compose network.
