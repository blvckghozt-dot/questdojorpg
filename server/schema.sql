-- QuestDojo RPG (D1)
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE,          -- device key for players who are not signed in
  account_id TEXT UNIQUE,          -- Math a Day account (account.mathaday.app), when linked
  nick TEXT NOT NULL, race TEXT NOT NULL, element TEXT NOT NULL,
  exp INTEGER NOT NULL DEFAULT 0,
  kills TEXT NOT NULL DEFAULT '{}', -- {monsterId: weekKey}
  week TEXT NOT NULL, w_clears INTEGER NOT NULL DEFAULT 0, w_wins INTEGER NOT NULL DEFAULT 0, w_battles INTEGER NOT NULL DEFAULT 0,
  t_clears INTEGER NOT NULL DEFAULT 0, t_wins INTEGER NOT NULL DEFAULT 0, t_battles INTEGER NOT NULL DEFAULT 0,
  energy_n INTEGER NOT NULL DEFAULT 10, energy_at INTEGER NOT NULL,
  created INTEGER NOT NULL, updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS players_week_clears ON players (week, w_clears DESC, updated);
CREATE INDEX IF NOT EXISTS players_week_wins ON players (week, w_wins DESC, updated);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY, player_id TEXT NOT NULL, monster TEXT NOT NULL, seed INTEGER NOT NULL,
  started INTEGER NOT NULL, done INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS runs_player ON runs (player_id, started);
