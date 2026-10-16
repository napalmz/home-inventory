# Home Inventory telemetry endpoint

**IT** — Cloudflare Worker + database D1 che riceve i ping anonimi opt-in del backend (vedi la sezione "Telemetria anonima" del [README](../README.md)).

**EN** — Cloudflare Worker + D1 database that receives the backend's anonymous opt-in pings (see the "Anonymous telemetry" section of the [README](../README.md)).

## Deploy

```bash
cd telemetry-worker
npx wrangler login
npx wrangler d1 create home-inventory-telemetry   # copia database_id in wrangler.toml
npx wrangler d1 execute home-inventory-telemetry --remote --file=schema.sql
```

**IT** — Se il database esiste già (creato prima del campo `channel`), applica la migrazione. **EN** — If the database already exists (created before the `channel` field), apply the migration:

```bash
npx wrangler d1 execute home-inventory-telemetry --remote --file=migrations/001_add_channel.sql
```

Deploy:

```bash
npx wrangler deploy
```

**IT** — Il comando `deploy` stampa l'URL pubblico (es. `https://home-inventory-telemetry.<account>.workers.dev`). Imposta `<URL>/ping` in `DEFAULT_TELEMETRY_URL` in `backend/telemetry_service.py`.

**EN** — The `deploy` command prints the public URL (e.g. `https://home-inventory-telemetry.<account>.workers.dev`). Set `<URL>/ping` as `DEFAULT_TELEMETRY_URL` in `backend/telemetry_service.py`.

## Endpoints

| Endpoint | Description |
|---|---|
| `POST /ping` | Receives `id`, `version`, `inventories`, `last_activity`; validates them and updates one row per installation. The country comes from Cloudflare; the IP is never stored. |
| `GET /stats` | Aggregated statistics (total/active installations, by country, by version). Requires `Authorization: Bearer <STATS_TOKEN>`; it does not exist until the secret is set. |
| `GET /public-stats` | Public, aggregated and cached for 1 hour: active installations, countries, versions and channels. No ids or per-installation data. Used by the app's About tab. |
| `GET /badge/installations`, `/badge/countries`, `/badge/version` | Public [shields.io endpoint badges](https://shields.io/badges/endpoint-badge) for the GitHub README. |

```bash
npx wrangler secret put STATS_TOKEN
curl -H "Authorization: Bearer <STATS_TOKEN>" https://<worker-url>/stats
```

**IT** — Un'installazione è "attiva" se ha inviato un ping negli ultimi 30 giorni.

**EN** — An installation is "active" if it sent a ping in the last 30 days.

## README badges

**IT** — Dopo il deploy, sostituisci `<WORKER_URL>` e decommenta il blocco di badge in cima al [README](../README.md).

**EN** — After deploying, replace `<WORKER_URL>` and uncomment the badge block at the top of the [README](../README.md).

```markdown
![Active installations](https://img.shields.io/endpoint?url=https://<WORKER_URL>/badge/installations)
```
