import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { app } from 'electron'
import log from 'electron-log'
import { v4 as uuidv4 } from 'uuid'

export interface Screenshot {
  id: string
  filepath: string
  thumbnail_path?: string
  filename: string
  original_filename?: string
  created_at: number
  updated_at: number
  file_size: number
  width?: number
  height?: number
  format: string
  content_hash?: string
  is_favorite: boolean
}

export interface ScreenshotMetadata {
  id?: number
  screenshot_id: string
  ocr_text?: string
  ai_title?: string
  ai_description?: string
  ai_keywords?: string[]
  dominant_colors?: string[]
  confidence_score?: number
  processed_at?: number
  comprehensive_description?: string
}

export interface Tag {
  id?: number
  name: string
  color: string
  created_at: number
}

export interface Folder {
  id?: number
  name: string
  parent_id?: number
  icon: string
  color: string
  sort_order: number
  is_smart: boolean
  filter_rules?: any
  created_at: number
  updated_at: number
}

export interface SearchResult {
  screenshot: Screenshot
  metadata?: ScreenshotMetadata
  tags?: Tag[]
  folders?: Folder[]
  relevance_score?: number
}

export class DatabaseManager {
  private db: Database.Database
  private dbPath: string

  constructor() {
    const userDataPath = app.getPath('userData')
    const dbDir = join(userDataPath, 'ScreenshotManager')
    
    // Create directory if it doesn't exist
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true })
    }
    
    this.dbPath = join(dbDir, 'screenshots.db')
    this.db = new Database(this.dbPath)
    
    // Configure database settings
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.db.pragma('temp_store = MEMORY')
    this.db.pragma('mmap_size = 268435456') // 256MB
    
    this.initializeDatabase()
    log.info(`Database initialized at: ${this.dbPath}`)
  }

  private initializeDatabase(): void {
    try {
      const schema = `
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
            dominant_colors TEXT, -- JSON array of color hex codes
            confidence_score REAL,
            processed_at INTEGER,
            comprehensive_description TEXT, -- Detailed analysis for semantic search
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

        -- Insert default folders
        INSERT OR IGNORE INTO folders (id, name, parent_id, icon, color, is_smart, filter_rules, created_at, updated_at) VALUES
        (1, 'All Screenshots', NULL, 'image', '#3B82F6', 1, '{"type": "all"}', 1640995200000, 1640995200000),
        (2, 'Recent', NULL, 'clock', '#10B981', 1, '{"type": "recent", "days": 7}', 1640995200000, 1640995200000),
        (3, 'Favorites', NULL, 'heart', '#EF4444', 1, '{"type": "favorites"}', 1640995200000, 1640995200000),
        (4, 'Screenshots', NULL, 'camera', '#8B5CF6', 0, '{}', 1640995200000, 1640995200000);

        -- Insert default settings
        INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
        ('app_version', '1.0.0', 1640995200000),
        ('thumbnail_size', '256', 1640995200000),
        ('auto_ocr', 'true', 1640995200000),
        ('auto_naming', 'true', 1640995200000),
        ('storage_path', '', 1640995200000),
        ('max_storage_size', '5368709120', 1640995200000);
      `
      
      this.db.exec(schema)
      log.info('Database schema initialized successfully')
      
      // Run migrations
      this.runMigrations()
    } catch (error) {
      log.error('Failed to initialize database schema:', error)
      throw error
    }
  }

  private runMigrations(): void {
    try {
      // Get current database version
      let currentVersion = 0
      try {
        const versionResult = this.db.prepare("SELECT value FROM settings WHERE key = 'schema_version'").get() as any
        if (versionResult) {
          currentVersion = parseInt(versionResult.value)
        }
      } catch (error) {
        // Settings table might not exist yet, start from version 0
        log.info('No schema version found, starting from version 0')
      }

      const targetVersion = 2 // Current target schema version

      if (currentVersion >= targetVersion) {
        log.info(`Database schema is up to date (version ${currentVersion})`)
        return
      }

      log.info(`Migrating database from version ${currentVersion} to ${targetVersion}`)

      // Migration to version 1: Add comprehensive_description column
      if (currentVersion < 1) {
        const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='screenshot_metadata'").all()
        
        if (tables.length > 0) {
          // Check if comprehensive_description column exists
          const columns = this.db.prepare("PRAGMA table_info(screenshot_metadata)").all() as any[]
          const hasComprehensiveDesc = columns.some(col => col.name === 'comprehensive_description')
          
          if (!hasComprehensiveDesc) {
            this.db.exec('ALTER TABLE screenshot_metadata ADD COLUMN comprehensive_description TEXT')
            log.info('Added comprehensive_description column to screenshot_metadata')
          }
        }
        
        // Update version
        this.db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)").run('schema_version', '1', Date.now())
        log.info('Migrated to schema version 1')
      }

      // Migration to version 2: Any future migrations would go here
      if (currentVersion < 2) {
        // Future migrations...
        
        // Update version
        this.db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)").run('schema_version', '2', Date.now())
        log.info('Migrated to schema version 2')
      }

      log.info('Database migration completed successfully')
    } catch (error) {
      log.error('Migration failed:', error)
      // Don't throw, just log - the app should still work
    }
  }

  // Screenshot operations
  async addScreenshot(screenshot: Omit<Screenshot, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const id = uuidv4()
    const now = Date.now()
    
    const stmt = this.db.prepare(`
      INSERT INTO screenshots (
        id, filepath, thumbnail_path, filename, original_filename,
        created_at, updated_at, file_size, width, height, format, content_hash, is_favorite
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    try {
      stmt.run(
        id, screenshot.filepath, screenshot.thumbnail_path, screenshot.filename,
        screenshot.original_filename, now, now, screenshot.file_size,
        screenshot.width, screenshot.height, screenshot.format,
        screenshot.content_hash, screenshot.is_favorite ? 1 : 0
      )
      
      log.info(`Screenshot added with ID: ${id}`)
      return id
    } catch (error) {
      log.error('Failed to add screenshot:', error)
      throw error
    }
  }

  async getScreenshot(id: string): Promise<Screenshot | null> {
    const stmt = this.db.prepare('SELECT * FROM screenshots WHERE id = ?')
    const result = stmt.get(id) as any
    
    if (!result) return null
    
    return this.mapDbScreenshot(result)
  }

  async getAllScreenshots(limit?: number, offset?: number): Promise<Screenshot[]> {
    let query = 'SELECT * FROM screenshots ORDER BY created_at DESC'
    
    if (limit) {
      query += ` LIMIT ${limit}`
      if (offset) {
        query += ` OFFSET ${offset}`
      }
    }
    
    const stmt = this.db.prepare(query)
    const results = stmt.all() as any[]
    
    return results.map(this.mapDbScreenshot)
  }

  async updateScreenshot(id: string, updates: Partial<Screenshot>): Promise<boolean> {
    const fields = Object.keys(updates).filter(key => key !== 'id')
    if (fields.length === 0) return false
    
    const setClause = fields.map(field => `${field} = ?`).join(', ')
    const values = fields.map(field => {
      const value = (updates as any)[field]
      // Convert booleans to integers for SQLite
      if (typeof value === 'boolean') {
        return value ? 1 : 0
      }
      // Ensure we only pass simple types that SQLite can bind
      if (value === undefined || value === null) {
        return null
      }
      if (typeof value === 'object') {
        return JSON.stringify(value)
      }
      return value
    })
    values.push(Date.now()) // updated_at
    values.push(id) // WHERE clause
    
    const stmt = this.db.prepare(`
      UPDATE screenshots 
      SET ${setClause}, updated_at = ?
      WHERE id = ?
    `)
    
    try {
      const result = stmt.run(...values)
      return result.changes > 0
    } catch (error) {
      log.error('Failed to update screenshot:', error)
      throw error
    }
  }

  async deleteScreenshot(id: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM screenshots WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  // Metadata operations
  async addMetadata(metadata: ScreenshotMetadata): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO screenshot_metadata (
        screenshot_id, ocr_text, ai_title, ai_description, ai_keywords,
        dominant_colors, confidence_score, processed_at, comprehensive_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    try {
      const result = stmt.run(
        metadata.screenshot_id,
        metadata.ocr_text,
        metadata.ai_title,
        metadata.ai_description,
        JSON.stringify(metadata.ai_keywords || []),
        JSON.stringify(metadata.dominant_colors || []),
        metadata.confidence_score,
        metadata.processed_at || Date.now(),
        metadata.comprehensive_description
      )
      
      return result.lastInsertRowid as number
    } catch (error) {
      log.error('Failed to add metadata:', error)
      throw error
    }
  }

  async getMetadata(screenshotId: string): Promise<ScreenshotMetadata | null> {
    const stmt = this.db.prepare('SELECT * FROM screenshot_metadata WHERE screenshot_id = ? ORDER BY processed_at DESC LIMIT 1')
    const result = stmt.get(screenshotId) as any
    
    if (!result) return null
    
    return {
      ...result,
      ai_keywords: JSON.parse(result.ai_keywords || '[]'),
      dominant_colors: JSON.parse(result.dominant_colors || '[]')
    }
  }

  // Search operations
  async updateSearchIndex(screenshotId: string, content: string, keywords: string[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO search_index (screenshot_id, content, keywords, indexed_at)
      VALUES (?, ?, ?, ?)
    `)
    
    try {
      stmt.run(screenshotId, content, keywords.join(' '), Date.now())
    } catch (error) {
      log.error('Failed to update search index:', error)
      throw error
    }
  }

  async searchScreenshots(query: string, limit: number = 50): Promise<SearchResult[]> {
    try {
      // Check if comprehensive_description column exists
      const columns = this.db.prepare("PRAGMA table_info(screenshot_metadata)").all() as any[]
      const hasComprehensiveDesc = columns.some(col => col.name === 'comprehensive_description')
      
      let searchQuery: string
      let searchParams: any[]
      
      if (hasComprehensiveDesc) {
        // Enhanced text search including comprehensive description for semantic-like search
        searchQuery = `
          SELECT DISTINCT
            s.*,
            m.ocr_text, m.ai_title, m.ai_description, m.ai_keywords, m.dominant_colors, m.comprehensive_description
          FROM screenshots s
          LEFT JOIN screenshot_metadata m ON m.screenshot_id = s.id
          LEFT JOIN search_index si ON si.screenshot_id = s.id
          WHERE 
            s.filename LIKE '%' || ? || '%' OR
            m.ocr_text LIKE '%' || ? || '%' OR
            m.ai_title LIKE '%' || ? || '%' OR
            m.ai_description LIKE '%' || ? || '%' OR
            m.comprehensive_description LIKE '%' || ? || '%' OR
            si.content LIKE '%' || ? || '%'
          ORDER BY s.created_at DESC
          LIMIT ?
        `
        searchParams = [query, query, query, query, query, query, limit]
      } else {
        // Fallback search without comprehensive_description
        searchQuery = `
          SELECT DISTINCT
            s.*,
            m.ocr_text, m.ai_title, m.ai_description, m.ai_keywords, m.dominant_colors
          FROM screenshots s
          LEFT JOIN screenshot_metadata m ON m.screenshot_id = s.id
          LEFT JOIN search_index si ON si.screenshot_id = s.id
          WHERE 
            s.filename LIKE '%' || ? || '%' OR
            m.ocr_text LIKE '%' || ? || '%' OR
            m.ai_title LIKE '%' || ? || '%' OR
            m.ai_description LIKE '%' || ? || '%' OR
            si.content LIKE '%' || ? || '%'
          ORDER BY s.created_at DESC
          LIMIT ?
        `
        searchParams = [query, query, query, query, query, limit]
      }
      
      const stmt = this.db.prepare(searchQuery)
      const results = stmt.all(...searchParams) as any[]
      
      return results.map(row => ({
        screenshot: this.mapDbScreenshot(row),
        metadata: row.ocr_text ? {
          screenshot_id: row.id,
          ocr_text: row.ocr_text,
          ai_title: row.ai_title,
          ai_description: row.ai_description,
          ai_keywords: JSON.parse(row.ai_keywords || '[]'),
          dominant_colors: JSON.parse(row.dominant_colors || '[]'),
          comprehensive_description: row.comprehensive_description || undefined
        } : undefined,
        relevance_score: row.rank
      }))
    } catch (error) {
      log.error('Search failed:', error)
      throw error
    }
  }

  // Tag operations
  async addTag(name: string, color: string = '#3B82F6'): Promise<number> {
    const stmt = this.db.prepare('INSERT INTO tags (name, color, created_at) VALUES (?, ?, ?)')
    const result = stmt.run(name, color, Date.now())
    return result.lastInsertRowid as number
  }

  async getAllTags(): Promise<Tag[]> {
    const stmt = this.db.prepare('SELECT * FROM tags ORDER BY name')
    return stmt.all() as Tag[]
  }

  async tagScreenshot(screenshotId: string, tagId: number): Promise<boolean> {
    const stmt = this.db.prepare('INSERT OR IGNORE INTO screenshot_tags (screenshot_id, tag_id, created_at) VALUES (?, ?, ?)')
    const result = stmt.run(screenshotId, tagId, Date.now())
    return result.changes > 0
  }
  
  async getTagsForScreenshot(screenshotId: string): Promise<Tag[]> {
    const stmt = this.db.prepare(`
      SELECT t.* FROM tags t
      JOIN screenshot_tags st ON st.tag_id = t.id
      WHERE st.screenshot_id = ?
      ORDER BY t.name
    `)
    return stmt.all(screenshotId) as Tag[]
  }

  // Folder operations
  async addFolder(folder: Omit<Folder, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO folders (name, parent_id, icon, color, sort_order, is_smart, filter_rules, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    const now = Date.now()
    const result = stmt.run(
      folder.name, folder.parent_id, folder.icon, folder.color,
      folder.sort_order, folder.is_smart ? 1 : 0,
      JSON.stringify(folder.filter_rules || {}), now, now
    )
    
    return result.lastInsertRowid as number
  }

  async getAllFolders(): Promise<Folder[]> {
    const stmt = this.db.prepare('SELECT * FROM folders ORDER BY sort_order, name')
    const results = stmt.all() as any[]
    
    return results.map(row => ({
      ...row,
      is_smart: Boolean(row.is_smart),
      filter_rules: JSON.parse(row.filter_rules || '{}')
    }))
  }
  
  async getFoldersForScreenshot(screenshotId: string): Promise<Folder[]> {
    const stmt = this.db.prepare(`
      SELECT f.* FROM folders f
      JOIN screenshot_folders sf ON sf.folder_id = f.id
      WHERE sf.screenshot_id = ?
      ORDER BY f.sort_order, f.name
    `)
    const results = stmt.all(screenshotId) as any[]
    
    return results.map(row => ({
      ...row,
      is_smart: Boolean(row.is_smart),
      filter_rules: JSON.parse(row.filter_rules || '{}')
    }))
  }
  
  async getScreenshotsForFolder(folderId: number): Promise<Screenshot[]> {
    const folder = this.db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId) as any
    if (!folder) return []
    
    const folderObj: Folder = {
      ...folder,
      is_smart: Boolean(folder.is_smart),
      filter_rules: JSON.parse(folder.filter_rules || '{}')
    }
    
    if (folderObj.is_smart) {
      return this.getScreenshotsForSmartFolder(folderObj)
    } else {
      const stmt = this.db.prepare(`
        SELECT s.* FROM screenshots s
        JOIN screenshot_folders sf ON sf.screenshot_id = s.id
        WHERE sf.folder_id = ?
        ORDER BY s.created_at DESC
      `)
      const results = stmt.all(folderId) as any[]
      return results.map(this.mapDbScreenshot)
    }
  }
  
  private async getScreenshotsForSmartFolder(folder: Folder): Promise<Screenshot[]> {
    const rules = folder.filter_rules || {}
    
    switch (rules.type) {
      case 'all':
        return this.getAllScreenshots()
        
      case 'recent':
        const daysAgo = rules.days || 7
        const since = Date.now() - (daysAgo * 24 * 60 * 60 * 1000)
        const stmt = this.db.prepare('SELECT * FROM screenshots WHERE created_at > ? ORDER BY created_at DESC')
        const results = stmt.all(since) as any[]
        return results.map(this.mapDbScreenshot)
        
      case 'favorites':
        const favStmt = this.db.prepare('SELECT * FROM screenshots WHERE is_favorite = 1 ORDER BY created_at DESC')
        const favResults = favStmt.all() as any[]
        return favResults.map(this.mapDbScreenshot)
        
      case 'tag':
        if (!rules.tagId) return []
        const tagStmt = this.db.prepare(`
          SELECT s.* FROM screenshots s
          JOIN screenshot_tags st ON st.screenshot_id = s.id
          WHERE st.tag_id = ?
          ORDER BY s.created_at DESC
        `)
        const tagResults = tagStmt.all(rules.tagId) as any[]
        return tagResults.map(this.mapDbScreenshot)
        
      case 'date_range':
        const startDate = rules.startDate || 0
        const endDate = rules.endDate || Date.now()
        const rangeStmt = this.db.prepare('SELECT * FROM screenshots WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC')
        const rangeResults = rangeStmt.all(startDate, endDate) as any[]
        return rangeResults.map(this.mapDbScreenshot)
        
      case 'content_type':
        // Filter by AI-detected content type
        const contentType = rules.contentType || ''
        const contentStmt = this.db.prepare(`
          SELECT DISTINCT s.* FROM screenshots s
          JOIN screenshot_metadata m ON m.screenshot_id = s.id
          WHERE m.ai_keywords LIKE '%' || ? || '%'
          ORDER BY s.created_at DESC
        `)
        const contentResults = contentStmt.all(contentType) as any[]
        return contentResults.map(this.mapDbScreenshot)
        
      default:
        return []
    }
  }
  
  async addScreenshotToFolder(screenshotId: string, folderId: number): Promise<boolean> {
    const stmt = this.db.prepare('INSERT OR IGNORE INTO screenshot_folders (screenshot_id, folder_id, added_at) VALUES (?, ?, ?)')
    const result = stmt.run(screenshotId, folderId, Date.now())
    return result.changes > 0
  }
  
  async removeScreenshotFromFolder(screenshotId: string, folderId: number): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM screenshot_folders WHERE screenshot_id = ? AND folder_id = ?')
    const result = stmt.run(screenshotId, folderId)
    return result.changes > 0
  }

  // Utility methods
  private mapDbScreenshot(row: any): Screenshot {
    return {
      ...row,
      is_favorite: Boolean(row.is_favorite)
    }
  }

  async getScreenshotByFilename(filename: string): Promise<Screenshot | null> {
    const stmt = this.db.prepare('SELECT * FROM screenshots WHERE filename = ?')
    const result = stmt.get(filename) as any
    
    if (!result) return null
    
    return this.mapDbScreenshot(result)
  }
  
  async getSetting(key: string): Promise<string | null> {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?')
    const result = stmt.get(key) as any
    return result ? result.value : null
  }
  
  async setSetting(key: string, value: string): Promise<void> {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
    stmt.run(key, value, Date.now())
  }
  
  async getStats(): Promise<{
    total_screenshots: number
    total_size: number
    tags_count: number
    folders_count: number
  }> {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_screenshots,
        COALESCE(SUM(file_size), 0) as total_size
      FROM screenshots
    `).get() as any
    
    const tags = this.db.prepare('SELECT COUNT(*) as count FROM tags').get() as any
    const folders = this.db.prepare('SELECT COUNT(*) as count FROM folders WHERE is_smart = 0').get() as any
    
    return {
      total_screenshots: stats.total_screenshots,
      total_size: stats.total_size,
      tags_count: tags.count,
      folders_count: folders.count
    }
  }

  close(): void {
    if (this.db) {
      this.db.close()
      log.info('Database connection closed')
    }
  }
}

export const dbManager = new DatabaseManager()