-- Screenshot Management Database Schema

-- Main screenshots table
CREATE TABLE IF NOT EXISTS screenshots (
    id TEXT PRIMARY KEY,
    filepath TEXT NOT NULL UNIQUE,
    thumbnail_path TEXT,
    filename TEXT NOT NULL,
    original_filename TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    file_size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    format TEXT NOT NULL DEFAULT 'png',
    content_hash TEXT,
    is_favorite INTEGER DEFAULT 0
);

-- Screenshot metadata (OCR, AI analysis)
CREATE TABLE IF NOT EXISTS screenshot_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    screenshot_id TEXT NOT NULL,
    ocr_text TEXT,
    ai_title TEXT,
    ai_description TEXT,
    ai_keywords TEXT, -- JSON array of keywords
    comprehensive_description TEXT, -- Detailed analysis for semantic search
    dominant_colors TEXT, -- JSON array of color hex codes
    confidence_score REAL,
    processed_at INTEGER,
    FOREIGN KEY(screenshot_id) REFERENCES screenshots(id) ON DELETE CASCADE
);

-- Tags system
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    created_at INTEGER NOT NULL
);

-- Screenshot-tag relationships
CREATE TABLE IF NOT EXISTS screenshot_tags (
    screenshot_id TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY(screenshot_id, tag_id),
    FOREIGN KEY(screenshot_id) REFERENCES screenshots(id) ON DELETE CASCADE,
    FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Folders/Collections system
CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER,
    icon TEXT DEFAULT 'folder',
    color TEXT DEFAULT '#6B7280',
    sort_order INTEGER DEFAULT 0,
    is_smart INTEGER DEFAULT 0,
    filter_rules TEXT, -- JSON object with filter rules
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(parent_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- Screenshot-folder relationships
CREATE TABLE IF NOT EXISTS screenshot_folders (
    screenshot_id TEXT NOT NULL,
    folder_id INTEGER NOT NULL,
    added_at INTEGER NOT NULL,
    PRIMARY KEY(screenshot_id, folder_id),
    FOREIGN KEY(screenshot_id) REFERENCES screenshots(id) ON DELETE CASCADE,
    FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- Full-text search index
CREATE TABLE IF NOT EXISTS search_index (
    screenshot_id TEXT PRIMARY KEY,
    content TEXT NOT NULL, -- Combined searchable content
    keywords TEXT, -- Space-separated keywords for faster search
    indexed_at INTEGER NOT NULL,
    FOREIGN KEY(screenshot_id) REFERENCES screenshots(id) ON DELETE CASCADE
);

-- App settings/preferences
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_screenshots_created_at ON screenshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_screenshots_filename ON screenshots(filename);
CREATE INDEX IF NOT EXISTS idx_screenshots_content_hash ON screenshots(content_hash);
CREATE INDEX IF NOT EXISTS idx_metadata_screenshot_id ON screenshot_metadata(screenshot_id);
CREATE INDEX IF NOT EXISTS idx_search_content ON search_index(content);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_screenshot_tags_screenshot_id ON screenshot_tags(screenshot_id);
CREATE INDEX IF NOT EXISTS idx_screenshot_tags_tag_id ON screenshot_tags(tag_id);

-- Create full-text search virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS fts_search USING fts5(
    screenshot_id,
    content,
    keywords,
    content='search_index',
    content_rowid='rowid'
);

-- Triggers to keep FTS table synchronized
CREATE TRIGGER IF NOT EXISTS fts_insert AFTER INSERT ON search_index BEGIN
    INSERT INTO fts_search(screenshot_id, content, keywords) 
    VALUES (new.screenshot_id, new.content, new.keywords);
END;

CREATE TRIGGER IF NOT EXISTS fts_delete AFTER DELETE ON search_index BEGIN
    DELETE FROM fts_search WHERE screenshot_id = old.screenshot_id;
END;

CREATE TRIGGER IF NOT EXISTS fts_update AFTER UPDATE ON search_index BEGIN
    DELETE FROM fts_search WHERE screenshot_id = old.screenshot_id;
    INSERT INTO fts_search(screenshot_id, content, keywords) 
    VALUES (new.screenshot_id, new.content, new.keywords);
END;

-- Insert default folders
INSERT OR IGNORE INTO folders (id, name, parent_id, icon, color, is_smart, filter_rules, created_at, updated_at) VALUES
(1, 'All Screenshots', NULL, 'image', '#3B82F6', 1, '{"type": "all"}', datetime('now'), datetime('now')),
(2, 'Recent', NULL, 'clock', '#10B981', 1, '{"type": "recent", "days": 7}', datetime('now'), datetime('now')),
(3, 'Favorites', NULL, 'heart', '#EF4444', 1, '{"type": "favorites"}', datetime('now'), datetime('now')),
(4, 'Screenshots', NULL, 'camera', '#8B5CF6', 0, '{}', datetime('now'), datetime('now'));

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
('app_version', '1.0.0', datetime('now')),
('thumbnail_size', '256', datetime('now')),
('auto_ocr', 'true', datetime('now')),
('auto_naming', 'true', datetime('now')),
('storage_path', '', datetime('now')),
('max_storage_size', '5368709120', datetime('now')); -- 5GB default