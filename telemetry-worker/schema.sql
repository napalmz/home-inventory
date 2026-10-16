-- Una riga per installazione: nessun IP, nessun dato dell'inventario.
CREATE TABLE IF NOT EXISTS installations (
  id            TEXT PRIMARY KEY,
  version       TEXT NOT NULL,
  country       TEXT NOT NULL,
  inventories   INTEGER NOT NULL,
  last_activity TEXT,
  first_seen    TEXT NOT NULL,
  last_seen     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_installations_last_seen ON installations (last_seen);
