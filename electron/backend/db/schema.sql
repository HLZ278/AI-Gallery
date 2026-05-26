-- YourPicture SQLite Schema

CREATE TABLE IF NOT EXISTS libraries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS media_items (
  id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  file_hash TEXT NOT NULL,
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  taken_at INTEGER,
  imported_at INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  thumb_path TEXT,
  analysis_status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analysis_results (
  media_id TEXT PRIMARY KEY,
  raw_json TEXT NOT NULL,
  description TEXT,
  objects TEXT,
  people TEXT,
  scene TEXT,
  location TEXT,
  story TEXT,
  trend_tags TEXT,
  mood TEXT,
  colors TEXT,
  ocr_text TEXT,
  model_name TEXT,
  prompt_version TEXT,
  analyzed_at INTEGER,
  FOREIGN KEY (media_id) REFERENCES media_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS burst_groups (
  id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  taken_at INTEGER,
  item_count INTEGER,
  FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS media_metadata (
  media_id TEXT PRIMARY KEY,
  exif_json TEXT,
  geo_text TEXT,
  burst_group_id TEXT,
  live_photo_pair_id TEXT,
  duration_ms INTEGER,
  frame_count INTEGER,
  is_panorama INTEGER DEFAULT 0,
  FOREIGN KEY (media_id) REFERENCES media_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS media_fts USING fts5(
  media_id UNINDEXED,
  description,
  objects,
  people,
  scene,
  location,
  story,
  trend_tags,
  ocr_text,
  content='',
  contentless_delete=1
);

CREATE TABLE IF NOT EXISTS media_embeddings (
  media_id TEXT PRIMARY KEY,
  embedding TEXT NOT NULL,
  source_text TEXT NOT NULL DEFAULT '',
  model_name TEXT,
  updated_at INTEGER,
  FOREIGN KEY (media_id) REFERENCES media_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_media_library ON media_items(library_id);
CREATE INDEX IF NOT EXISTS idx_media_taken_at ON media_items(taken_at);
CREATE INDEX IF NOT EXISTS idx_media_type ON media_items(media_type);
CREATE INDEX IF NOT EXISTS idx_media_status ON media_items(analysis_status);
CREATE INDEX IF NOT EXISTS idx_embeddings_updated ON media_embeddings(updated_at);
