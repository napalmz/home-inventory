-- Per database creati prima dell'introduzione del canale (release|dev|unknown).
ALTER TABLE installations ADD COLUMN channel TEXT NOT NULL DEFAULT 'unknown';
