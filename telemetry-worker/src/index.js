const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERSION_RE = /^[0-9A-Za-z.+_-]{1,32}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const MAX_BODY_BYTES = 2048;
const MAX_INVENTORIES = 1_000_000;
const ACTIVE_DAYS = 30;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

const PUBLIC_CACHE = { "Cache-Control": "public, max-age=3600" };

// Solo aggregati: nessun id, nessun dato per singola installazione.
async function loadPublicStats(env) {
  const since = new Date(Date.now() - ACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [active, byCountry, byVersion, byChannel] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM installations WHERE last_seen >= ?1").bind(since).first(),
    env.DB.prepare(
      "SELECT country, COUNT(*) AS n FROM installations WHERE last_seen >= ?1 AND country != 'XX' GROUP BY country ORDER BY n DESC, country",
    )
      .bind(since)
      .all(),
    env.DB.prepare(
      "SELECT version, COUNT(*) AS n FROM installations WHERE last_seen >= ?1 GROUP BY version ORDER BY n DESC, version DESC",
    )
      .bind(since)
      .all(),
    env.DB.prepare(
      "SELECT channel, COUNT(*) AS n FROM installations WHERE last_seen >= ?1 GROUP BY channel ORDER BY n DESC, channel",
    )
      .bind(since)
      .all(),
  ]);
  return {
    active_installations: active.n,
    active_window_days: ACTIVE_DAYS,
    countries: byCountry.results,
    versions: byVersion.results,
    channels: byChannel.results,
  };
}

async function handlePublicStats(env) {
  return json(await loadPublicStats(env), 200, PUBLIC_CACHE);
}

// Formato "endpoint badge" di shields.io: https://shields.io/badges/endpoint-badge
async function handleBadge(name, env) {
  const stats = await loadPublicStats(env);
  const badges = {
    installations: { label: "active installations", message: String(stats.active_installations), color: "blue" },
    countries: { label: "countries", message: String(stats.countries.length), color: "green" },
    version: { label: "most used version", message: stats.versions[0]?.version ?? "n/a", color: "informational" },
  };
  const badge = badges[name];
  if (!badge) return new Response("Not found", { status: 404 });
  return json({ schemaVersion: 1, ...badge, cacheSeconds: 3600 }, 200, PUBLIC_CACHE);
}

async function handlePing(request, env) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { id, version, inventories, last_activity: lastActivity, channel = "unknown" } = body ?? {};
  if (typeof id !== "string" || !UUID_RE.test(id)) return new Response("Invalid id", { status: 400 });
  if (typeof version !== "string" || !VERSION_RE.test(version)) {
    return new Response("Invalid version", { status: 400 });
  }
  if (!["release", "dev", "unknown"].includes(channel)) return new Response("Invalid channel", { status: 400 });
  if (!Number.isInteger(inventories) || inventories < 0 || inventories > MAX_INVENTORIES) {
    return new Response("Invalid inventories", { status: 400 });
  }

  let activity = null;
  if (lastActivity != null) {
    const parsed = typeof lastActivity === "string" ? Date.parse(lastActivity) : Number.NaN;
    if (Number.isNaN(parsed)) return new Response("Invalid last_activity", { status: 400 });
    activity = new Date(parsed).toISOString();
  }

  // La nazione arriva da Cloudflare; l'indirizzo IP non viene mai letto né salvato.
  const rawCountry = request.cf?.country ?? request.headers.get("CF-IPCountry") ?? "";
  const country = COUNTRY_RE.test(rawCountry) ? rawCountry : "XX";
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO installations (id, version, country, inventories, last_activity, first_seen, last_seen, channel)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?7)
     ON CONFLICT(id) DO UPDATE SET
       version = excluded.version,
       channel = excluded.channel,
       country = excluded.country,
       inventories = excluded.inventories,
       last_activity = excluded.last_activity,
       last_seen = excluded.last_seen`,
  )
    .bind(id.toLowerCase(), version, country, inventories, activity, now, channel)
    .run();

  return new Response(null, { status: 204 });
}

function timingSafeEqual(a, b) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function handleStats(request, env) {
  // Senza STATS_TOKEN configurato l'endpoint non esiste
  if (!env.STATS_TOKEN) return new Response("Not found", { status: 404 });
  const auth = request.headers.get("Authorization") ?? "";
  if (!timingSafeEqual(auth, `Bearer ${env.STATS_TOKEN}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const since = new Date(Date.now() - ACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [total, active, byCountry, byVersion, byChannel] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(inventories), 0) AS inventories FROM installations").first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM installations WHERE last_seen >= ?1").bind(since).first(),
    env.DB.prepare(
      "SELECT country, COUNT(*) AS n FROM installations WHERE last_seen >= ?1 GROUP BY country ORDER BY n DESC",
    )
      .bind(since)
      .all(),
    env.DB.prepare(
      "SELECT version, COUNT(*) AS n FROM installations WHERE last_seen >= ?1 GROUP BY version ORDER BY n DESC",
    )
      .bind(since)
      .all(),
    env.DB.prepare(
      "SELECT channel, COUNT(*) AS n FROM installations WHERE last_seen >= ?1 GROUP BY channel ORDER BY n DESC",
    )
      .bind(since)
      .all(),
  ]);

  return json({
    installations_total: total.n,
    installations_active: active.n,
    active_window_days: ACTIVE_DAYS,
    inventories_total: total.inventories,
    active_by_country: byCountry.results,
    active_by_version: byVersion.results,
    active_by_channel: byChannel.results,
  });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/ping" && request.method === "POST") return handlePing(request, env);
    if (pathname === "/stats" && request.method === "GET") return handleStats(request, env);
    if (pathname === "/public-stats" && request.method === "GET") return handlePublicStats(env);
    const badge = pathname.match(/^\/badge\/([a-z]+)$/);
    if (badge && request.method === "GET") return handleBadge(badge[1], env);
    return new Response("Not found", { status: 404 });
  },
};
