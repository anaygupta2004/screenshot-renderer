import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Enhanced APIs for the screenshot manager
const api = {
  // Screenshot Management
  captureScreenshot: () => electronAPI.ipcRenderer.invoke('capture-screenshot'),
  getAllScreenshots: (page?: number, limit?: number) => electronAPI.ipcRenderer.invoke('get-all-screenshots', page, limit),
  getScreenshot: (id: string) => electronAPI.ipcRenderer.invoke('get-screenshot', id),
  deleteScreenshot: (id: string) => electronAPI.ipcRenderer.invoke('delete-screenshot', id),
  toggleFavorite: (id: string) => electronAPI.ipcRenderer.invoke('toggle-favorite', id),
  
  // Search and Filtering
  searchScreenshots: (query: string, limit?: number) => electronAPI.ipcRenderer.invoke('search-screenshots', query, limit),
  
  // Tags
  getAllTags: () => electronAPI.ipcRenderer.invoke('get-all-tags'),
  addTag: (name: string, color: string) => electronAPI.ipcRenderer.invoke('add-tag', name, color),
  tagScreenshot: (screenshotId: string, tagId: number) => electronAPI.ipcRenderer.invoke('tag-screenshot', screenshotId, tagId),
  
  // Folders
  getAllFolders: () => electronAPI.ipcRenderer.invoke('get-all-folders'),
  addFolder: (folderData: any) => electronAPI.ipcRenderer.invoke('add-folder', folderData),
  getScreenshotsForFolder: (folderId: number) => electronAPI.ipcRenderer.invoke('get-screenshots-for-folder', folderId),
  addScreenshotToFolder: (screenshotId: string, folderId: number) => electronAPI.ipcRenderer.invoke('add-screenshot-to-folder', screenshotId, folderId),
  removeScreenshotFromFolder: (screenshotId: string, folderId: number) => electronAPI.ipcRenderer.invoke('remove-screenshot-from-folder', screenshotId, folderId),
  
  // AI Processing
  reprocessScreenshot: (id: string) => electronAPI.ipcRenderer.invoke('reprocess-screenshot', id),
  getScreenshotMetadata: (id: string) => electronAPI.ipcRenderer.invoke('get-screenshot-metadata', id),
  
  // Export and Preview
  previewScreenshot: (id: string) => electronAPI.ipcRenderer.invoke('preview-screenshot', id),
  exportScreenshot: (id: string, filename: string, format?: string) => electronAPI.ipcRenderer.invoke('export-screenshot', id, filename, format),
  
  // Stats and Info
  getAppStats: () => electronAPI.ipcRenderer.invoke('get-app-stats'),
  
  // Event Listeners
  onScreenshotProcessed: (callback: (data: any) => void) => {
    electronAPI.ipcRenderer.on('screenshot-processed', (_, data) => callback(data))
  },
  onOpenPreferences: (callback: () => void) => {
    electronAPI.ipcRenderer.on('open-preferences', callback)
  },
  onFocusSearch: (callback: () => void) => {
    electronAPI.ipcRenderer.on('focus-search', callback)
  },
  onImportScreenshots: (callback: () => void) => {
    electronAPI.ipcRenderer.on('import-screenshots', callback)
  },
  
  // Legacy APIs for backward compatibility
  requestScreenshot: () => electronAPI.ipcRenderer.invoke('request-screenshot'),
  extractTextFromImage: (imageData: string) => electronAPI.ipcRenderer.invoke('extract-text-from-image', imageData),
  
  // Utility
  removeAllListeners: (channel: string) => electronAPI.ipcRenderer.removeAllListeners(channel),
  log: (message: string, level: string = 'info') => electronAPI.ipcRenderer.send('log-message', { message, level })
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
