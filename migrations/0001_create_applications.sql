-- Applications to join Pineapple: one row per email (stored lowercased).
CREATE TABLE applications (
  email TEXT NOT NULL COLLATE NOCASE PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
