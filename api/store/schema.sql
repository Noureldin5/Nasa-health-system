-- Text records and relations. Numbers over time live in VictoriaMetrics (docs/TEAM.md).
-- Datetimes are naive ISO-8601 text (the demo clock is local station time).

CREATE TABLE IF NOT EXISTS crew (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL,
  module TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkins (
  crew_id    TEXT NOT NULL REFERENCES crew(id),
  day        TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (crew_id, day)
);

CREATE TABLE IF NOT EXISTS alerts (
  id            TEXT PRIMARY KEY,
  crew_id       TEXT NOT NULL REFERENCES crew(id),
  indicator     TEXT NOT NULL,
  what_changed  TEXT NOT NULL,
  next_step     TEXT NOT NULL,
  contact_if    TEXT NOT NULL,
  related_items TEXT NOT NULL,
  severity      REAL NOT NULL,
  state         TEXT NOT NULL,
  opened_at     TEXT NOT NULL,
  closed_at     TEXT
);

CREATE TABLE IF NOT EXISTS briefs (
  id           TEXT PRIMARY KEY,
  crew_id      TEXT NOT NULL REFERENCES crew(id),
  alert_id     TEXT REFERENCES alerts(id),
  question     TEXT NOT NULL,
  pinned_items TEXT NOT NULL,
  state        TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  sent_at      TEXT
);

CREATE TABLE IF NOT EXISTS replies (
  id           TEXT PRIMARY KEY,
  brief_id     TEXT NOT NULL REFERENCES briefs(id),
  author       TEXT NOT NULL,
  text         TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  delivered_at TEXT
);

CREATE TABLE IF NOT EXISTS ground_notes (
  id           TEXT PRIMARY KEY,
  crew_id      TEXT NOT NULL REFERENCES crew(id),
  kind         TEXT NOT NULL,
  target       TEXT,
  text         TEXT NOT NULL,
  reason       TEXT,
  author       TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  delivered_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_log (
  id       TEXT PRIMARY KEY,
  at       TEXT NOT NULL,
  up       TEXT NOT NULL,
  down     TEXT NOT NULL,
  item_ids TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS link_state (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  last_sync_at TEXT
);
INSERT OR IGNORE INTO link_state (id, last_sync_at) VALUES (1, NULL);
