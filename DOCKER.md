# Running Pulse locally with Docker

`docker compose` brings up everything Pulse needs for storage — **PostgreSQL** and
**MinIO** — and automatically creates the `pulse-media` bucket the app uploads to.
You then run the Spring Boot app from your IDE (or `./mvnw spring-boot:run`).

## 1. One-time setup

```bash
cp .env.example .env       # then open .env and set DB_PASSWORD
```

## 2. Start the infrastructure

```bash
docker compose up -d
```

This starts:

| Service   | Where                                   | Notes                                |
|-----------|-----------------------------------------|--------------------------------------|
| Postgres  | `localhost:5432`                        | db `pulse_db`, user `postgres`       |
| MinIO API | `localhost:9000`                        | the app talks to this                |
| MinIO UI  | `localhost:9001`                        | login `minioadmin` / `minioadmin123` |
| bucket    | created automatically (`pulse-media`)   | one-shot `minio-init` job            |

Check status: `docker compose ps`  ·  Logs: `docker compose logs -f minio-init`

## 3. Run the app (from your IDE or the terminal)

The app already defaults the MinIO settings, so you only need the two secrets:

```bash
DB_PASSWORD=your-password \
JWT_SECRET=dev-secret-change-me-please-32chars-minimum-0123456789 \
./mvnw spring-boot:run
```

The app connects to `localhost:5432` and `localhost:9000` — no extra config.

## 4. Frontend

```bash
cd frontend && npm install && npm run dev
```

## Stopping

```bash
docker compose down        # stop, keep all data
docker compose down -v     # stop and WIPE Postgres + MinIO data
```

---

## Optional: run the whole stack (including the app) in Docker

```bash
docker compose --profile full up -d --build
```

This also builds and runs the Spring Boot app (`Dockerfile`) in a container.

> **Heads-up about media:** in this mode the app reaches MinIO at `minio:9000`
> (the container network name), so presigned URLs for uploaded images/videos
> point to `minio:9000` and **won't load in your browser**. Every other feature
> works. For full media support, run the app outside Docker (step 3 above) — that
> way the app and your browser both use `localhost:9000`.