import { ElectronAPI } from '@electron-toolkit/preload'

interface Screenshot {
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

interface ScreenshotMetadata {
  id?: number
  screenshot_id: string
  ocr_text?: string
  ai_title?: string
  ai_description?: string
  ai_keywords?: string[]
  dominant_colors?: string[]
  confidence_score?: number
  processed_at?: number
}

interface Tag {
  id?: number
  name: string
  color: string
  created_at: number
}

interface Folder {
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

interface SearchResult {
  screenshot: Screenshot
  metadata?: ScreenshotMetadata
  tags?: Tag[]
  folders?: Folder[]
  relevance_score?: number
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      // Screenshot Management
      captureScreenshot: () => Promise<string | null>
      getAllScreenshots: (page?: number, limit?: number) => Promise<Screenshot[]>
      getScreenshot: (id: string) => Promise<Screenshot | null>
      deleteScreenshot: (id: string) => Promise<boolean>
      toggleFavorite: (id: string) => Promise<boolean>
      
      // Search and Filtering
      searchScreenshots: (query: string, limit?: number) => Promise<SearchResult[]>
      
      // Tags
      getAllTags: () => Promise<Tag[]>
      addTag: (name: string, color: string) => Promise<number>
      tagScreenshot: (screenshotId: string, tagId: number) => Promise<boolean>
      
      // Folders
      getAllFolders: () => Promise<Folder[]>
      addFolder: (folderData: Omit<Folder, 'id' | 'created_at' | 'updated_at'>) => Promise<number>
      getScreenshotsForFolder: (folderId: number) => Promise<Screenshot[]>
      addScreenshotToFolder: (screenshotId: string, folderId: number) => Promise<boolean>
      removeScreenshotFromFolder: (screenshotId: string, folderId: number) => Promise<boolean>
      
      // AI Processing
      reprocessScreenshot: (id: string) => Promise<boolean>
      getScreenshotMetadata: (id: string) => Promise<ScreenshotMetadata | null>
      
      // Export and Preview
      previewScreenshot: (id: string) => Promise<boolean>
      exportScreenshot: (id: string, filename: string, format?: string) => Promise<string | null>
      
      // Stats and Info
      getAppStats: () => Promise<{
        total_screenshots: number
        total_size: number
        tags_count: number
        folders_count: number
        storage: {
          baseDir: string
          totalSize: number
          fileCount: number
        }
      }>
      
      // Event Listeners
      onScreenshotProcessed: (callback: (data: any) => void) => void
      onOpenPreferences: (callback: () => void) => void
      onFocusSearch: (callback: () => void) => void
      onImportScreenshots: (callback: () => void) => void
      
      // Legacy APIs
      requestScreenshot: () => Promise<string>
      extractTextFromImage: (imageData: string) => Promise<any>
      
      // Utility
      removeAllListeners: (channel: string) => void
      log: (message: string, level?: string) => void
    }
  }
}
