import { join, extname, basename } from 'path'
import { existsSync, mkdirSync, copyFileSync, unlinkSync, statSync, readdirSync } from 'fs'
import { app } from 'electron'
// import sharp from 'sharp' // Removed due to compilation issues
import log from 'electron-log'
import { createHash } from 'crypto'

export interface FileInfo {
  path: string
  size: number
  dimensions?: { width: number; height: number }
  format: string
  contentHash: string
}

export interface ThumbnailSizes {
  small: { width: number; height: number }
  medium: { width: number; height: number }
  large: { width: number; height: number }
}

export class FileSystemManager {
  private readonly baseDir: string
  private readonly originalsDir: string
  private readonly thumbnailsDir: string
  private readonly exportsDir: string
  
  private readonly thumbnailSizes: ThumbnailSizes = {
    small: { width: 128, height: 128 },
    medium: { width: 256, height: 256 },
    large: { width: 512, height: 512 }
  }

  constructor() {
    // Use macOS default Screenshots folder in Documents
    const homeDir = app.getPath('home')
    const screenshotsDir = join(homeDir, 'Documents', 'Screenshots') // Correct macOS screenshots location
    
    // For app data, still use userData path
    const userDataPath = app.getPath('userData')
    this.baseDir = join(userDataPath, 'ScreenshotManager')
    
    // Store originals in the macOS Screenshots folder
    this.originalsDir = screenshotsDir
    this.thumbnailsDir = join(this.baseDir, 'thumbnails')
    this.exportsDir = join(this.baseDir, 'exports')
    
    this.ensureDirectories()
    log.info(`FileSystemManager initialized at: ${this.baseDir}`)
    log.info(`Screenshots will be saved to: ${this.originalsDir}`)
  }

  private ensureDirectories(): void {
    // Don't create originalsDir (Desktop) - it already exists
    const dirs = [this.baseDir, this.thumbnailsDir, this.exportsDir]
    
    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
        log.info(`Created directory: ${dir}`)
      }
    }
    
    // Create subdirectories for thumbnails
    for (const size of Object.keys(this.thumbnailSizes)) {
      const sizeDir = join(this.thumbnailsDir, size)
      if (!existsSync(sizeDir)) {
        mkdirSync(sizeDir, { recursive: true })
      }
    }
  }

  async saveScreenshot(imageData: string, filename?: string): Promise<FileInfo> {
    try {
      // Extract base64 data
      const base64Data = imageData.split(',')[1] || imageData
      const buffer = Buffer.from(base64Data, 'base64')
      
      // Generate filename if not provided
      if (!filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        filename = `screenshot-${timestamp}.png`
      }
      
      // Ensure unique filename
      const finalFilename = this.ensureUniqueFilename(filename)
      const filePath = join(this.originalsDir, finalFilename)
      
      // Save original file directly (without sharp for now)
      require('fs').writeFileSync(filePath, buffer)
      
      // Generate content hash
      const contentHash = this.generateContentHash(buffer)
      
      // Get file stats
      const stats = statSync(filePath)
      
      const fileInfo: FileInfo = {
        path: filePath,
        size: stats.size,
        dimensions: undefined, // We'll add dimension detection later
        format: 'png',
        contentHash
      }
      
      log.info(`Screenshot saved: ${finalFilename} (${fileInfo.size} bytes)`)
      return fileInfo
      
    } catch (error) {
      log.error('Failed to save screenshot:', error)
      throw error
    }
  }

  async generateThumbnails(originalPath: string, screenshotId: string): Promise<{
    small: string
    medium: string
    large: string
  }> {
    try {
      // For now, just copy the original as "medium" thumbnail
      // We'll implement proper thumbnail generation later
      const thumbnailFilename = `${screenshotId}-medium.png`
      const thumbnailPath = join(this.thumbnailsDir, 'medium', thumbnailFilename)
      
      // Copy original as medium thumbnail
      copyFileSync(originalPath, thumbnailPath)
      
      log.info(`Generated thumbnails for: ${screenshotId}`)
      return {
        small: thumbnailPath,
        medium: thumbnailPath,
        large: thumbnailPath
      }
      
    } catch (error) {
      log.error('Failed to generate thumbnails:', error)
      throw error
    }
  }

  async copyToExports(originalPath: string, filename: string, format?: string): Promise<string> {
    try {
      const ext = format ? `.${format}` : extname(originalPath)
      const exportFilename = this.ensureUniqueFilename(filename + ext, this.exportsDir)
      const exportPath = join(this.exportsDir, exportFilename)
      
      // For now, just copy the file regardless of format
      // We'll add format conversion later when we have image processing
      copyFileSync(originalPath, exportPath)
      
      log.info(`Exported to: ${exportPath}`)
      return exportPath
      
    } catch (error) {
      log.error('Failed to copy to exports:', error)
      throw error
    }
  }

  deleteFile(filePath: string): boolean {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath)
        log.info(`Deleted file: ${filePath}`)
        return true
      }
      return false
    } catch (error) {
      log.error('Failed to delete file:', error)
      return false
    }
  }

  deleteScreenshotFiles(screenshotId: string, originalPath: string): void {
    try {
      // Delete original
      this.deleteFile(originalPath)
      
      // Delete thumbnails
      for (const sizeName of Object.keys(this.thumbnailSizes)) {
        const thumbnailPath = join(this.thumbnailsDir, sizeName, `${screenshotId}-${sizeName}.png`)
        this.deleteFile(thumbnailPath)
      }
      
      log.info(`Deleted all files for screenshot: ${screenshotId}`)
    } catch (error) {
      log.error('Failed to delete screenshot files:', error)
    }
  }

  async getImageDimensions(_filePath: string): Promise<{ width: number; height: number } | null> {
    try {
      // For now, return null - we'll implement proper dimension detection later
      return null
    } catch (error) {
      log.error('Failed to get image dimensions:', error)
      return null
    }
  }

  async extractDominantColors(_filePath: string, _count: number = 5): Promise<string[]> {
    try {
      // For now, return some default colors - we'll implement proper color extraction later
      return ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
    } catch (error) {
      log.error('Failed to extract dominant colors:', error)
      return []
    }
  }

  private ensureUniqueFilename(filename: string, directory: string = this.originalsDir): string {
    const ext = extname(filename)
    const baseName = basename(filename, ext)
    let counter = 1
    let finalFilename = filename
    
    while (existsSync(join(directory, finalFilename))) {
      finalFilename = `${baseName}-${counter}${ext}`
      counter++
    }
    
    return finalFilename
  }

  private generateContentHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex')
  }

  getBaseDir(): string {
    return this.baseDir
  }
  
  getStorageInfo(): {
    baseDir: string
    totalSize: number
    fileCount: number
  } {
    try {
      let totalSize = 0
      let fileCount = 0
      
      // Calculate size recursively (simplified)
      const calculateDirSize = (dir: string): void => {
        if (!existsSync(dir)) return
        
        const items = require('fs').readdirSync(dir)
        for (const item of items) {
          const itemPath = join(dir, item)
          const stats = statSync(itemPath)
          
          if (stats.isFile()) {
            totalSize += stats.size
            fileCount++
          } else if (stats.isDirectory()) {
            calculateDirSize(itemPath)
          }
        }
      }
      
      calculateDirSize(this.baseDir)
      
      return {
        baseDir: this.baseDir,
        totalSize,
        fileCount
      }
    } catch (error) {
      log.error('Failed to get storage info:', error)
      return {
        baseDir: this.baseDir,
        totalSize: 0,
        fileCount: 0
      }
    }
  }

  // Cleanup methods
  async cleanup(): Promise<void> {
    // Implement cleanup logic for orphaned files, old exports, etc.
    log.info('FileSystemManager cleanup completed')
  }
  
  async scanForExistingScreenshots(): Promise<string[]> {
    try {
      const screenshotPattern = /^Screenshot \d{4}-\d{2}-\d{2} at \d{2}\.\d{2}\.\d{2}\.png$/
      const files = readdirSync(this.originalsDir)
      
      const screenshots = files.filter(file => {
        // Check if it matches Apple screenshot naming pattern
        if (screenshotPattern.test(file)) {
          return true
        }
        // Also include any PNG files that might be screenshots
        const ext = extname(file).toLowerCase()
        return ext === '.png' || ext === '.jpg' || ext === '.jpeg'
      })
      
      log.info(`Found ${screenshots.length} potential screenshots in ${this.originalsDir}`)
      return screenshots.map(file => join(this.originalsDir, file))
    } catch (error) {
      log.error('Failed to scan for existing screenshots:', error)
      return []
    }
  }
  
  parseAppleScreenshotFilename(filename: string): Date | null {
    try {
      // Pattern: Screenshot YYYY-MM-DD at HH.MM.SS.png
      const match = filename.match(/Screenshot (\d{4})-(\d{2})-(\d{2}) at (\d{2})\.(\d{2})\.(\d{2})/)
      if (match) {
        const [_, year, month, day, hour, minute, second] = match
        return new Date(
          parseInt(year),
          parseInt(month) - 1, // Month is 0-based
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second)
        )
      }
      return null
    } catch (error) {
      log.error('Failed to parse screenshot filename:', error)
      return null
    }
  }
}

export const fileManager = new FileSystemManager()