# Xnapper Alternative - Architecture Design

## Overview
Transform the basic OCR app into a comprehensive screenshot management and editing application with advanced features.

## Core Architecture

### 1. Data Layer
```
ScreenshotDatabase (SQLite)
├── screenshots (id, filepath, thumbnail_path, created_at, updated_at, size, dimensions)
├── metadata (screenshot_id, ocr_text, ai_title, ai_description, content_hash)
├── tags (id, name, color)
├── screenshot_tags (screenshot_id, tag_id)
├── folders (id, name, parent_id, filter_rules, auto_rules)
├── screenshot_folders (screenshot_id, folder_id)
└── search_index (screenshot_id, content, keywords, processed_at)
```

### 2. File System Structure
```
~/Screenshots/
├── originals/          # Full resolution screenshots
├── thumbnails/         # Generated thumbnails (256x256, 512x512)
├── exports/           # Edited/exported files
└── database.sqlite    # Metadata database
```

### 3. Application Architecture

#### Main Process (Electron)
- **DatabaseManager**: SQLite operations, schema management
- **ScreenshotCapture**: Enhanced screenshot functionality
- **FileSystemManager**: File operations, thumbnail generation
- **SearchIndexer**: Full-text search, content indexing
- **AIProcessor**: BAML integration for OCR, naming, content analysis

#### Renderer Process (React)
- **LibraryView**: Grid/list views with filtering and search
- **EditorView**: Canvas-based editing with tools
- **SearchView**: Advanced search with semantic capabilities
- **SettingsView**: App configuration and preferences
- **SidebarView**: Folders, tags, filters navigation

### 4. Key Features Implementation

#### Semantic Search
- OCR text indexing with full-text search
- AI-powered content understanding via BAML
- Context-aware search suggestions
- Filter by date, size, type, content

#### Auto-naming System
- BAML analysis of screenshot content
- Context detection (app, website, document type)
- Intelligent title generation
- Bulk renaming capabilities

#### Dynamic Folder System
- Smart folders with rule-based auto-organization
- Custom filters (date ranges, content types, keywords)
- Nested folder structure
- Tag-based organization

#### Editing Suite
- Canvas-based editor with layers
- Annotation tools (arrows, shapes, text, blur)
- Color picker and brush tools
- Undo/redo system
- Export options (PNG, JPG, PDF, etc.)

## Technology Stack Enhancement

### New Dependencies
- `better-sqlite3`: Fast SQLite database
- `fuse.js`: Fuzzy search capabilities
- `fabric.js`: Canvas editing functionality
- `sharp`: Image processing and thumbnails
- `date-fns`: Date utilities
- `lucide-react`: Modern icon system

### UI Framework
- Maintain React + TypeScript
- Enhanced TailwindCSS with custom macOS styling
- CSS `backdrop-filter` for translucent effects
- Framer Motion for smooth animations

## Performance Considerations
- Virtual scrolling for large screenshot libraries
- Lazy loading of thumbnails and metadata
- Background processing for OCR and indexing
- Efficient database queries with proper indexing
- Memory management for large images