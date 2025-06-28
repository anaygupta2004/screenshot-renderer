import { app, shell, BrowserWindow, ipcMain, desktopCapturer, Menu, globalShortcut, protocol, Tray, Notification, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { b } from '../../baml_client/async_client.js'
import { Image } from '@boundaryml/baml'
import dotenv from 'dotenv'
import log from 'electron-log'

// Import our new services
import { dbManager, Screenshot } from './database/DatabaseManager'
import { fileManager } from './services/FileSystemManager'
import { aiProcessor } from './services/AIProcessor'
import { OpenAIEmbeddingService } from './services/OpenAIEmbeddingService'

// Initialize the logger for renderer processes
log.initialize()

// Load environment variables from .env file
dotenv.config()

// Helper function to detect default screenshot naming patterns
function isDefaultScreenshotName(filename: string): boolean {
  // Apple's default screenshot patterns:
  // "Screenshot 2023-12-25 at 10.30.45 AM.png"
  // "CleanShot 2023-12-25 at 10.30.45@2x.png" 
  // Our app's pattern: "screenshot_1750583345439.png"
  
  const defaultPatterns = [
    /^Screenshot \d{4}-\d{2}-\d{2} at \d{1,2}\.\d{2}\.\d{2}( AM| PM)?\.png$/i,
    /^CleanShot \d{4}-\d{2}-\d{2} at \d{1,2}\.\d{2}\.\d{2}(@2x)?\.png$/i,
    /^screenshot_\d+\.png$/i,
    /^Screen Shot \d{4}-\d{2}-\d{2} at \d{1,2}\.\d{2}\.\d{2}( AM| PM)?\.png$/i
  ]
  
  return defaultPatterns.some(pattern => pattern.test(filename))
}

// Helper function to check if a file should be renamed
function shouldRenameFile(filename: string): boolean {
  return isDefaultScreenshotName(filename)
}

// Helper function to rename screenshot files with meaningful names
async function renameScreenshotFile(filepath: string, currentFilename: string, aiTitle: string): Promise<string | null> {
  try {
    const fs = require('fs').promises
    const path = require('path')
    
    // Clean the AI title to make it a valid filename
    const cleanTitle = aiTitle
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with dashes
      .toLowerCase()
      .substring(0, 50) // Limit length
    
    if (cleanTitle.length < 3) {
      log.warn(`⚠️ Clean title too short for renaming: "${cleanTitle}"`)
      return null
    }
    
    // Extract timestamp from original filename if possible
    const timestampMatch = currentFilename.match(/(\d{13,})/)
    const timestamp = timestampMatch ? timestampMatch[1] : Date.now().toString()
    
    // Create new filename
    const newFilename = `${cleanTitle}-${timestamp}.png`
    const dir = path.dirname(filepath)
    const newFilepath = path.join(dir, newFilename)
    
    // Check if new filename already exists
    try {
      await fs.access(newFilepath)
      log.warn(`⚠️ File already exists: ${newFilename}`)
      return null
    } catch {
      // File doesn't exist, good to rename
    }
    
    // Rename the file
    await fs.rename(filepath, newFilepath)
    log.info(`✅ Renamed file: ${currentFilename} → ${newFilename}`)
    
    return newFilename
  } catch (error) {
    log.error(`❌ Failed to rename file ${currentFilename}:`, error)
    return null
  }
}

// Global references
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let embeddingService: OpenAIEmbeddingService | null = null

function createWindow(): void {
  // Create the browser window with modern macOS styling
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 20 },
    transparent: true,
    backgroundColor: '#00000000', // Fully transparent
    vibrancy: 'fullscreen-ui', // macOS frosted glass effect for main content  
    visualEffectState: 'active',
    backgroundMaterial: 'mica',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    
    // Set up global shortcuts
    setupGlobalShortcuts()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupGlobalShortcuts(): void {
  // Global screenshot shortcut (Cmd+Shift+5 on macOS)
  const shortcut = process.platform === 'darwin' ? 'Cmd+Shift+5' : 'Ctrl+Shift+5'
  
  globalShortcut.register(shortcut, async () => {
    try {
      await captureScreenshot()
    } catch (error) {
      log.error('Global shortcut screenshot failed:', error)
    }
  })
  
  log.info(`Global screenshot shortcut registered: ${shortcut}`)
}

async function captureScreenshot(): Promise<string | null> {
  try {
    log.info('Starting screenshot capture process')
    
    // Hide main window before capturing
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide()
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Capture screenshot
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 3840, height: 2160 }
    })

    if (sources.length === 0) {
      throw new Error('No screen sources available')
    }

    const screenshot = sources[0].thumbnail.toDataURL()
    
    // Save screenshot with enhanced metadata
    const fileInfo = await fileManager.saveScreenshot(screenshot)
    
    // Add to database
    const screenshotData: Omit<Screenshot, 'id' | 'created_at' | 'updated_at'> = {
      filepath: fileInfo.path,
      filename: require('path').basename(fileInfo.path),
      file_size: fileInfo.size,
      width: fileInfo.dimensions?.width,
      height: fileInfo.dimensions?.height,
      format: fileInfo.format,
      content_hash: fileInfo.contentHash,
      is_favorite: false
    }
    
    const screenshotId = await dbManager.addScreenshot(screenshotData)
    
    // Generate thumbnails
    const thumbnails = await fileManager.generateThumbnails(fileInfo.path, screenshotId)
    
    // Update database with thumbnail path
    await dbManager.updateScreenshot(screenshotId, {
      thumbnail_path: thumbnails.medium
    })
    
    // Process with AI in background
    processScreenshotWithAI(screenshotId, fileInfo.path).catch(err => {
      log.error('Background AI processing failed:', err)
    })
    
    // Show main window again
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    
    log.info(`Screenshot captured and saved: ${screenshotId}`)
    
    // Send native notification
    sendNativeNotification(
      'Screenshot Captured',
      'Screenshot saved and processing started',
      {
        onClick: () => {
          if (mainWindow) {
            mainWindow.show()
            app.dock?.show()
          }
        }
      }
    )
    
    return screenshot
    
  } catch (error) {
    // Ensure main window is shown even if error occurs
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
    }
    log.error('Error capturing screenshot:', error)
    throw error
  }
}

async function importExistingScreenshots(): Promise<void> {
  try {
    log.info('Scanning for existing screenshots...')
    const existingPaths = await fileManager.scanForExistingScreenshots()
    
    let imported = 0
    for (const filePath of existingPaths) {
      try {
        // Check if already in database
        const filename = require('path').basename(filePath)
        const existing = await dbManager.getScreenshotByFilename(filename)
        
        if (existing) {
          log.info(`Screenshot already imported: ${filename}`)
          continue
        }
        
        // Get file info
        const stats = require('fs').statSync(filePath)
        const fileSize = stats.size
        
        // Parse date from filename if possible (handled by database manager)
        
        // Calculate content hash
        const buffer = require('fs').readFileSync(filePath)
        const contentHash = require('crypto').createHash('sha256').update(buffer).digest('hex')
        
        // Add to database
        const screenshotData: Omit<Screenshot, 'id' | 'created_at' | 'updated_at'> = {
          filepath: filePath,
          filename: filename,
          file_size: fileSize,
          format: 'png',
          content_hash: contentHash,
          is_favorite: false
        }
        
        const screenshotId = await dbManager.addScreenshot(screenshotData)
        
        // Generate thumbnails
        const thumbnails = await fileManager.generateThumbnails(filePath, screenshotId)
        await dbManager.updateScreenshot(screenshotId, {
          thumbnail_path: thumbnails.medium
        })
        
        // Process with AI in background
        processScreenshotWithAI(screenshotId, filePath).catch(err => {
          log.error(`Failed to process imported screenshot ${filename}:`, err)
        })
        
        imported++
        log.info(`Imported screenshot: ${filename}`)
      } catch (error) {
        log.error(`Failed to import screenshot ${filePath}:`, error)
      }
    }
    
    log.info(`Imported ${imported} screenshots`)
    
    // Notify renderer if window is ready
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('screenshots-imported', { count: imported })
    }
  } catch (error) {
    log.error('Failed to import existing screenshots:', error)
  }
}

async function createEmbeddingsForExistingScreenshots(): Promise<void> {
  if (!embeddingService) {
    log.error('❌ Cannot create embeddings - embedding service not available')
    return
  }

  try {
    log.info('🔍 Checking for existing screenshots that need embeddings...')
    
    // First, purge any stale embeddings from the database
    log.info('🧹 Purging stale embeddings from vector database...')
    await embeddingService.purgeStaleEmbeddings()
    
    // Get all screenshots
    const screenshots = await dbManager.getAllScreenshots()
    let processed = 0
    let generated = 0
    let renamed = 0
    let skipped = 0
    let errors = 0
    
    for (const screenshot of screenshots) {
      try {
        // Get metadata for this screenshot
        const metadata = await dbManager.getMetadata(screenshot.id)
        
        // Check if file needs renaming (generic timestamp names)
        const needsRename = shouldRenameFile(screenshot.filename)
        if (needsRename && metadata?.ai_title) {
          const newFilename = await renameScreenshotFile(screenshot.filepath, screenshot.filename, metadata.ai_title)
          if (newFilename) {
            // Update database with new filename and filepath
            const newFilepath = screenshot.filepath.replace(screenshot.filename, newFilename)
            await dbManager.updateScreenshot(screenshot.id, { 
              filename: newFilename,
              filepath: newFilepath
            })
            screenshot.filename = newFilename
            screenshot.filepath = newFilepath
            renamed++
            log.info(`📝 Renamed ${screenshot.filename} to ${newFilename}`)
          }
        }
        
        if (metadata && metadata.comprehensive_description) {
          log.info(`📝 Creating embedding for existing screenshot: ${screenshot.filename}`)
          
          await embeddingService.addImage(screenshot.id, screenshot.filepath, {
            ocr_text: metadata.ocr_text,
            ai_title: metadata.ai_title,
            ai_description: metadata.ai_description,
            keywords: metadata.ai_keywords,
            comprehensive_description: metadata.comprehensive_description
          })
          
          processed++
          log.info(`✅ Embedding created for ${screenshot.filename}`)
        } else {
          // Generate comprehensive description for screenshots that don't have one
          log.info(`🤖 Generating comprehensive description for ${screenshot.filename}...`)
          
          try {
            // Process the screenshot with AI to generate comprehensive description
            await processScreenshotWithAI(screenshot.id, screenshot.filepath)
            
            // Get the updated metadata
            const updatedMetadata = await dbManager.getMetadata(screenshot.id)
            
            if (updatedMetadata?.comprehensive_description) {
              // Now create the embedding
              await embeddingService.addImage(screenshot.id, screenshot.filepath, {
                ocr_text: updatedMetadata.ocr_text,
                ai_title: updatedMetadata.ai_title,
                ai_description: updatedMetadata.ai_description,
                keywords: updatedMetadata.ai_keywords,
                comprehensive_description: updatedMetadata.comprehensive_description
              })
              
              generated++
              processed++
              log.info(`✅ Generated description and created embedding for ${screenshot.filename}`)
            } else {
              skipped++
              log.warn(`⚠️ Failed to generate comprehensive description for ${screenshot.filename}`)
            }
          } catch (aiError) {
            skipped++
            log.error(`❌ Failed to generate description for ${screenshot.filename}:`, aiError)
          }
        }
      } catch (error) {
        errors++
        log.error(`❌ Failed to process embedding for ${screenshot.filename}:`, error)
      }
    }
    
    log.info(`📊 Embedding processing complete: ${processed} created (${generated} generated), ${renamed} renamed, ${skipped} skipped, ${errors} errors`)
    log.info(`📊 Total embeddings now: ${embeddingService.getItemCount()}`)
  } catch (error) {
    log.error('❌ Failed to process existing screenshots for embeddings:', error)
  }
}

async function processScreenshotWithAI(screenshotId: string, imagePath: string): Promise<void> {
  try {
    log.info(`Starting AI processing for screenshot: ${screenshotId}`)
    
    const analysisResult = await aiProcessor.processScreenshot(screenshotId, imagePath)
    
    // Save metadata to database
    if (analysisResult.ocr_text || analysisResult.ai_title) {
      log.info('💾 Saving metadata to database...')
      log.info('📊 Metadata being saved:', {
        has_ocr: !!analysisResult.ocr_text,
        has_title: !!analysisResult.ai_title,
        has_description: !!analysisResult.ai_description,
        has_comprehensive: !!analysisResult.comprehensive_description,
        comprehensive_length: analysisResult.comprehensive_description?.length || 0
      })
      
      await dbManager.addMetadata({
        screenshot_id: screenshotId,
        ocr_text: analysisResult.ocr_text,
        ai_title: analysisResult.ai_title,
        ai_description: analysisResult.ai_description,
        ai_keywords: analysisResult.ai_keywords || [],
        confidence_score: analysisResult.confidence_score,
        comprehensive_description: analysisResult.comprehensive_description
      })
      
      log.info('✅ Metadata saved to database successfully')
      
      // Create embedding for semantic search using comprehensive description
      if (embeddingService && analysisResult.comprehensive_description) {
        try {
          log.info('🔍 Creating embedding for semantic search...')
          log.info('📊 Embedding service item count before:', embeddingService.getItemCount())
          log.info('📝 Comprehensive description length:', analysisResult.comprehensive_description.length)
          
          await embeddingService.addImage(screenshotId, imagePath, {
            ocr_text: analysisResult.ocr_text,
            ai_title: analysisResult.ai_title,
            ai_description: analysisResult.ai_description,
            keywords: analysisResult.ai_keywords,
            comprehensive_description: analysisResult.comprehensive_description
          })
          
          log.info('✅ Embedding created successfully for semantic search')
          log.info('📊 Embedding service item count after:', embeddingService.getItemCount())
        } catch (embeddingError) {
          log.error('❌ Failed to create embedding for semantic search:', embeddingError)
          log.error('   Error details:', embeddingError instanceof Error ? embeddingError.message : String(embeddingError))
        }
      } else if (!embeddingService) {
        log.error('❌ Embedding service not available for semantic search')
        log.error('   Service is null/undefined - initialization may have failed')
      } else {
        log.error('❌ No comprehensive description available for embedding')
        log.error('   AI comprehensive description generation failed')
        log.error('   OCR text length:', analysisResult.ocr_text?.length || 0)
        log.error('   AI title:', analysisResult.ai_title || 'none')
      }
      
      // Update search index
      const searchContent = [
        analysisResult.ocr_text || '',
        analysisResult.ai_title || '',
        analysisResult.ai_description || '',
        ...(analysisResult.ai_keywords || [])
      ].filter(Boolean).join(' ')
      
      await dbManager.updateSearchIndex(
        screenshotId,
        searchContent,
        analysisResult.ai_keywords || []
      )
      
      // Auto-rename if AI title is available and screenshot has default naming
      try {
        if (analysisResult.ai_title && analysisResult.ai_title.length > 3) {
          log.info(`🏷️ Checking auto-rename for title: "${analysisResult.ai_title}"`)
          const screenshot = await dbManager.getScreenshot(screenshotId)
          
          if (screenshot && isDefaultScreenshotName(screenshot.filename)) {
            log.info(`🔄 Screenshot has default name "${screenshot.filename}", auto-renaming...`)
            
            const cleanTitle = analysisResult.ai_title
              .replace(/[^\w\s\-]/g, '')
              .replace(/\s+/g, '-')
              .toLowerCase()
              .substring(0, 50) // Limit filename length
            
            if (cleanTitle.length > 3) {
              const timestamp = new Date().toISOString().split('T')[0]
              const newFilename = `${cleanTitle}-${timestamp}.png`
              
              await dbManager.updateScreenshot(screenshotId, { 
                filename: newFilename
              })
              
              log.info(`✅ Auto-renamed screenshot from "${screenshot.filename}" to: ${newFilename}`)
            } else {
              log.warn(`⚠️ Clean title too short (${cleanTitle.length} chars): "${cleanTitle}"`)
            }
          } else if (screenshot) {
            log.info(`ℹ️ Screenshot "${screenshot.filename}" doesn't match default naming pattern, skipping rename`)
          } else {
            log.error(`❌ Screenshot ${screenshotId} not found for auto-rename`)
          }
        } else {
          log.warn(`⚠️ No valid AI title for auto-rename: "${analysisResult.ai_title || 'none'}"`)
        }
      } catch (renameError) {
        log.error(`❌ Auto-rename failed for ${screenshotId}:`, renameError)
        log.error('   Error details:', renameError instanceof Error ? renameError.message : String(renameError))
      }
    }
    
    log.info(`AI processing completed for screenshot: ${screenshotId}`)
    
    // Send native notification for completed processing
    sendNativeNotification(
      'Screenshot Processed',
      `AI analysis complete: ${analysisResult.ai_title || 'Screenshot ready'}`,
      {
        onClick: () => {
          if (mainWindow) {
            mainWindow.show()
            app.dock?.show()
          }
        }
      }
    )
    
    // Notify renderer about the processed screenshot
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('screenshot-processed', {
        id: screenshotId,
        analysis: analysisResult
      })
    }
    
  } catch (error) {
    log.error(`AI processing failed for screenshot ${screenshotId}:`, error)
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.screenshotmanager')
  
  // Register custom protocol for loading local images
  protocol.registerFileProtocol('screenshot', (request, callback) => {
    const url = request.url.substr(13) // Remove 'screenshot://'
    callback({ path: decodeURIComponent(url) })
  })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize OpenAI embedding service
  try {
    embeddingService = new OpenAIEmbeddingService(fileManager.getBaseDir())
    // Don't wait for initialization - let it happen in background
    embeddingService.initialize().then(() => {
      log.info('✅ OpenAI embedding service initialized successfully')
      log.info('📊 Current embedding count:', embeddingService?.getItemCount() || 0)
      
      // Process existing screenshots that need embeddings
      createEmbeddingsForExistingScreenshots().catch(error => {
        log.error('❌ Failed to create embeddings for existing screenshots:', error)
      })
    }).catch(error => {
      log.error('❌ OpenAI embedding initialization failed:', error)
      log.error('   Error details:', error instanceof Error ? error.message : String(error))
      log.error('   Semantic search will be unavailable')
      embeddingService = null // Clear service if initialization fails
    })
  } catch (error) {
    log.error('❌ Failed to create OpenAI embedding service:', error)
    log.error('   Error details:', error instanceof Error ? error.message : String(error))
    embeddingService = null
  }
  
  setupIpcHandlers()
  createAppMenu()
  createMenuBarTray()
  configureDockMenu()
  createWindow()
  
  // Import existing screenshots on startup
  importExistingScreenshots().catch(err => {
    log.error('Failed to import existing screenshots:', err)
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

function setupIpcHandlers(): void {
  // Screenshot Management
  ipcMain.handle('capture-screenshot', captureScreenshot)
  
  ipcMain.handle('get-all-screenshots', async (_, page = 0, limit = 50) => {
    try {
      return await dbManager.getAllScreenshots(limit, page * limit)
    } catch (error) {
      log.error('Failed to get screenshots:', error)
      throw error
    }
  })
  
  ipcMain.handle('get-screenshot', async (_, id: string) => {
    try {
      return await dbManager.getScreenshot(id)
    } catch (error) {
      log.error('Failed to get screenshot:', error)
      throw error
    }
  })
  
  ipcMain.handle('delete-screenshot', async (_, id: string) => {
    try {
      const screenshot = await dbManager.getScreenshot(id)
      if (screenshot) {
        fileManager.deleteScreenshotFiles(id, screenshot.filepath)
        
        // Remove from embedding index
        if (embeddingService) {
          embeddingService.removeItem(id)
        }
        
        return await dbManager.deleteScreenshot(id)
      }
      return false
    } catch (error) {
      log.error('Failed to delete screenshot:', error)
      throw error
    }
  })
  
  ipcMain.handle('toggle-favorite', async (_, id: string) => {
    try {
      const screenshot = await dbManager.getScreenshot(id)
      if (screenshot) {
        return await dbManager.updateScreenshot(id, {
          is_favorite: !screenshot.is_favorite
        })
      }
      return false
    } catch (error) {
      log.error('Failed to toggle favorite:', error)
      throw error
    }
  })

  // Search and Filtering
  ipcMain.handle('search-screenshots', async (_, query: string, limit = 50) => {
    try {
      log.info('🔍 Starting search for query:', query, 'limit:', limit)
      
      // Perform both text search and semantic search
      log.info('📝 Performing text search...')
      const textResults = await dbManager.searchScreenshots(query, limit)
      log.info('📝 Text search results:', textResults.length)
      
      // Perform semantic search if embedding service is available
      if (embeddingService) {
        try {
          log.info('🧠 Performing semantic search...')
          log.info('📊 Embedding service has', embeddingService.getItemCount(), 'items')
          const semanticResults = await embeddingService.searchByText(query, limit)
          log.info('🧠 Semantic search results:', semanticResults.length)
        
          // Merge results, prioritizing semantic search
          const resultMap = new Map()
          
          // Add semantic results first (higher priority)
          for (const result of semanticResults) {
            const screenshot = await dbManager.getScreenshot(result.id)
            if (screenshot) {
              const metadata = await dbManager.getMetadata(result.id)
              const tags = await dbManager.getTagsForScreenshot(result.id)
              const folders = await dbManager.getFoldersForScreenshot(result.id)
              
              resultMap.set(result.id, {
                screenshot,
                metadata,
                tags,
                folders,
                relevance_score: result.score
              })
            }
          }
          
          // Add text search results (lower priority but still included)
          for (const result of textResults) {
            if (!resultMap.has(result.screenshot.id)) {
              resultMap.set(result.screenshot.id, result)
            }
          }
          
          log.info('🔍 Combined search results:', resultMap.size)
          return Array.from(resultMap.values()).slice(0, limit)
        } catch (semanticError) {
          log.error('❌ Semantic search failed, falling back to text search:', semanticError)
          log.error('   Error details:', semanticError instanceof Error ? semanticError.message : String(semanticError))
        }
      } else {
        log.warn('⚠️ Embedding service not available, using text search only')
      }
      
      return textResults
    } catch (error) {
      log.error('Search failed:', error)
      // Return empty array instead of throwing
      return []
    }
  })

  // Tags
  ipcMain.handle('get-all-tags', async () => {
    try {
      return await dbManager.getAllTags()
    } catch (error) {
      log.error('Failed to get tags:', error)
      throw error
    }
  })
  
  ipcMain.handle('add-tag', async (_, name: string, color: string) => {
    try {
      return await dbManager.addTag(name, color)
    } catch (error) {
      log.error('Failed to add tag:', error)
      throw error
    }
  })
  
  ipcMain.handle('tag-screenshot', async (_, screenshotId: string, tagId: number) => {
    try {
      return await dbManager.tagScreenshot(screenshotId, tagId)
    } catch (error) {
      log.error('Failed to tag screenshot:', error)
      throw error
    }
  })

  // Folders
  ipcMain.handle('get-all-folders', async () => {
    try {
      return await dbManager.getAllFolders()
    } catch (error) {
      log.error('Failed to get folders:', error)
      throw error
    }
  })
  
  ipcMain.handle('add-folder', async (_, folderData) => {
    try {
      return await dbManager.addFolder(folderData)
    } catch (error) {
      log.error('Failed to add folder:', error)
      throw error
    }
  })
  
  ipcMain.handle('get-screenshots-for-folder', async (_, folderId: number) => {
    try {
      return await dbManager.getScreenshotsForFolder(folderId)
    } catch (error) {
      log.error('Failed to get screenshots for folder:', error)
      throw error
    }
  })
  
  ipcMain.handle('add-screenshot-to-folder', async (_, screenshotId: string, folderId: number) => {
    try {
      return await dbManager.addScreenshotToFolder(screenshotId, folderId)
    } catch (error) {
      log.error('Failed to add screenshot to folder:', error)
      throw error
    }
  })
  
  ipcMain.handle('remove-screenshot-from-folder', async (_, screenshotId: string, folderId: number) => {
    try {
      return await dbManager.removeScreenshotFromFolder(screenshotId, folderId)
    } catch (error) {
      log.error('Failed to remove screenshot from folder:', error)
      throw error
    }
  })

  // AI Processing
  ipcMain.handle('reprocess-screenshot', async (_, id: string) => {
    try {
      const screenshot = await dbManager.getScreenshot(id)
      if (screenshot) {
        await processScreenshotWithAI(id, screenshot.filepath)
        return true
      }
      return false
    } catch (error) {
      log.error('Failed to reprocess screenshot:', error)
      throw error
    }
  })
  
  ipcMain.handle('get-screenshot-metadata', async (_, id: string) => {
    try {
      return await dbManager.getMetadata(id)
    } catch (error) {
      log.error('Failed to get metadata:', error)
      throw error
    }
  })

  // Preview
  ipcMain.handle('preview-screenshot', async (_, id: string) => {
    try {
      const screenshot = await dbManager.getScreenshot(id)
      if (screenshot) {
        await shell.openPath(screenshot.filepath)
        return true
      }
      return false
    } catch (error) {
      log.error('Failed to preview screenshot:', error)
      throw error
    }
  })

  // Export
  ipcMain.handle('export-screenshot', async (_, id: string, filename: string, format?: string) => {
    try {
      const screenshot = await dbManager.getScreenshot(id)
      if (screenshot) {
        return await fileManager.copyToExports(screenshot.filepath, filename, format)
      }
      return null
    } catch (error) {
      log.error('Failed to export screenshot:', error)
      throw error
    }
  })

  // Stats and Info
  ipcMain.handle('get-app-stats', async () => {
    try {
      const dbStats = await dbManager.getStats()
      const storageInfo = fileManager.getStorageInfo()
      
      return {
        ...dbStats,
        storage: storageInfo
      }
    } catch (error) {
      log.error('Failed to get app stats:', error)
      throw error
    }
  })

  // Legacy handlers for backward compatibility
  ipcMain.handle('request-screenshot', captureScreenshot)
  
  ipcMain.handle('extract-text-from-image', async (_, imageData: string) => {
    try {
      const base64Data = imageData.split(',')[1] || imageData
      const image = Image.fromBase64('image/png', base64Data)
      const result = await b.ExtractTextFromImage(image)
      return result
    } catch (error) {
      log.error('Error extracting text with BAML:', error)
      throw error
    }
  })

  // Test and Debug IPC
  ipcMain.on('ping', () => log.info('pong'))
  
  ipcMain.handle('debug-embedding-service', async () => {
    try {
      const result = {
        serviceAvailable: !!embeddingService,
        itemCount: embeddingService?.getItemCount() || 0,
        apiKeyConfigured: !!process.env.OPENAI_API_KEY,
        serviceInfo: embeddingService ? 'initialized' : 'not available'
      }
      log.info('🔍 Debug embedding service:', result)
      return result
    } catch (error) {
      log.error('Debug embedding service failed:', error)
      return { error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('create-embeddings-for-existing', async () => {
    try {
      log.info('🔍 Manual request to create embeddings for existing screenshots')
      await createEmbeddingsForExistingScreenshots()
      return {
        success: true,
        message: 'Embeddings creation completed',
        itemCount: embeddingService?.getItemCount() || 0
      }
    } catch (error) {
      log.error('❌ Failed to create embeddings for existing screenshots:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }
    }
  })
  
  ipcMain.handle('test-ai-processing', async (_, screenshotId: string) => {
    try {
      log.info(`🧪 Testing AI processing for screenshot: ${screenshotId}`)
      const screenshot = await dbManager.getScreenshot(screenshotId)
      if (!screenshot) {
        throw new Error(`Screenshot ${screenshotId} not found`)
      }
      
      // Force reprocess the screenshot
      await processScreenshotWithAI(screenshotId, screenshot.filepath)
      return { success: true, message: 'AI processing completed' }
    } catch (error) {
      log.error('Test AI processing failed:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }
    }
  })
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cleanup()
    app.quit()
  }
})

app.on('before-quit', () => {
  cleanup()
})

function cleanup(): void {
  try {
    // Destroy tray
    if (tray && !tray.isDestroyed()) {
      tray.destroy()
      tray = null
    }
    
    // Unregister global shortcuts
    globalShortcut.unregisterAll()
    
    // Close database connection
    dbManager.close()
    
    // Cleanup file manager
    fileManager.cleanup()
    
    // Cleanup embedding service
    if (embeddingService) {
      embeddingService.cleanup()
    }
    
    log.info('Application cleanup completed')
  } catch (error) {
    log.error('Error during cleanup:', error)
  }
}

// Create native macOS menu bar tray
function createMenuBarTray(): void {
  if (process.platform !== 'darwin') return
  
  try {
    // Create tray icon from app icon
    const iconPath = join(__dirname, '../../resources/icon.png')
    let trayIcon: Electron.NativeImage
    
    try {
      trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    } catch {
      // Fallback: create a simple template icon
      trayIcon = nativeImage.createEmpty()
    }
    
    tray = new Tray(trayIcon)
    tray.setToolTip('Screenshot Manager')
    
    // Create context menu for tray
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Capture Screenshot',
        accelerator: 'CommandOrControl+Shift+5',
        click: () => {
          captureScreenshot()
        }
      },
      {
        label: 'Show App',
        click: () => {
          if (mainWindow) {
            mainWindow.show()
            app.dock?.show()
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Preferences...',
        accelerator: 'CommandOrControl+,',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send('open-preferences')
            mainWindow.show()
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: 'CommandOrControl+Q',
        click: () => {
          app.quit()
        }
      }
    ])
    
    tray.setContextMenu(contextMenu)
    
    // Show/hide app on tray click
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide()
          app.dock?.hide()
        } else {
          mainWindow.show()
          app.dock?.show()
        }
      }
    })
    
    log.info('Menu bar tray created successfully')
  } catch (error) {
    log.error('Failed to create menu bar tray:', error)
  }
}

// Send native macOS notifications
function sendNativeNotification(title: string, body: string, options?: { onClick?: () => void }) {
  if (!Notification.isSupported()) return
  
  const notification = new Notification({
    title,
    body,
    icon: join(__dirname, '../../resources/icon.png'),
    sound: 'Glass', // macOS system sound
  })
  
  if (options?.onClick) {
    notification.on('click', options.onClick)
  }
  
  notification.show()
}

// Configure dock menu for macOS
function configureDockMenu(): void {
  if (process.platform !== 'darwin') return
  
  const dockMenu = Menu.buildFromTemplate([
    {
      label: 'Capture Screenshot',
      click: () => captureScreenshot()
    },
    {
      label: 'Show Recent Screenshots',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          app.dock?.show()
        }
      }
    }
  ])
  
  app.dock?.setMenu(dockMenu)
}

// Create application menu for macOS
function createAppMenu(): void {
  if (process.platform !== 'darwin') return
  
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { 
          label: 'Preferences...',
          accelerator: 'Cmd+,',
          click: () => {
            // Open preferences window
            if (mainWindow) {
              mainWindow.webContents.send('open-preferences')
            }
          }
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Capture Screenshot',
          accelerator: 'Cmd+Shift+5',
          click: () => {
            captureScreenshot().catch(err => {
              log.error('Menu screenshot capture failed:', err)
            })
          }
        },
        { type: 'separator' },
        {
          label: 'Import Screenshots...',
          accelerator: 'Cmd+I',
          click: () => {
            // TODO: Implement import functionality
            if (mainWindow) {
              mainWindow.webContents.send('import-screenshots')
            }
          }
        },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Search',
          accelerator: 'Cmd+F',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('focus-search')
            }
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
