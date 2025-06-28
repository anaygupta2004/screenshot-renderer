import { useState, useEffect, useCallback } from 'react'
import { 
  Search, 
  Camera, 
  Heart, 
  Clock, 
  Folder, 
  Tag, 
  Settings, 
  Grid, 
  List,
  Filter,
  Plus,
  X
} from 'lucide-react'

// Components
import Sidebar from './components/Sidebar'
import ScreenshotGrid from './components/ScreenshotGrid'
import SearchBar from './components/SearchBar'
import Toolbar from './components/Toolbar'
import ScreenshotEditor from './components/ScreenshotEditor'
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal'

// Hooks
import useKeyboardShortcuts, { shortcuts } from './hooks/useKeyboardShortcuts'

// Types
interface Screenshot {
  id: string
  filepath: string
  thumbnail_path?: string
  filename: string
  created_at: number
  file_size: number
  width?: number
  height?: number
  is_favorite: boolean
}

interface AppState {
  screenshots: Screenshot[]
  selectedScreenshots: Set<string>
  currentView: 'grid' | 'list'
  searchQuery: string
  selectedFolder: string | null
  selectedTags: number[]
  isLoading: boolean
  error: string | null
  editingScreenshot: Screenshot | null
}

function App() {
  console.log('App component is rendering')
  
  const [showShortcutsModal, setShowShortcutsModal] = useState(false)
  const [state, setState] = useState<AppState>({
    screenshots: [],
    selectedScreenshots: new Set(),
    currentView: 'grid',
    searchQuery: '',
    selectedFolder: null,
    selectedTags: [],
    isLoading: false,
    error: null,
    editingScreenshot: null
  })

  // Keyboard shortcuts setup
  const keyboardShortcuts = [
    shortcuts.captureScreen(() => handleScreenshot()),
    shortcuts.search(() => document.querySelector<HTMLInputElement>('input[type="search"]')?.focus()),
    shortcuts.refresh(() => loadScreenshots()),
    shortcuts.toggleGrid(() => setState(prev => ({ ...prev, currentView: 'grid' }))),
    shortcuts.toggleList(() => setState(prev => ({ ...prev, currentView: 'list' }))),
    shortcuts.selectAll(() => {
      const allIds = new Set(state.screenshots.map(s => s.id))
      setState(prev => ({ ...prev, selectedScreenshots: allIds }))
    }),
    shortcuts.deselectAll(() => setState(prev => ({ ...prev, selectedScreenshots: new Set() }))),
    shortcuts.deleteSelected(() => {
      if (state.selectedScreenshots.size > 0) {
        Array.from(state.selectedScreenshots).forEach(id => handleDeleteScreenshot(id))
      }
    }),
    shortcuts.favoriteSelected(() => {
      if (state.selectedScreenshots.size > 0) {
        Array.from(state.selectedScreenshots).forEach(id => handleToggleFavorite(id))
      }
    }),
    shortcuts.exportSelected(() => {
      if (state.selectedScreenshots.size > 0) {
        // TODO: Implement bulk export
        console.log('Export selected screenshots:', Array.from(state.selectedScreenshots))
      }
    }),
    shortcuts.openEditor(() => {
      if (state.selectedScreenshots.size === 1) {
        const screenshot = state.screenshots.find(s => s.id === Array.from(state.selectedScreenshots)[0])
        if (screenshot) handleEditScreenshot(screenshot)
      }
    }),
    shortcuts.closeEditor(() => {
      if (state.editingScreenshot) handleCloseEditor()
    }),
    shortcuts.showShortcuts(() => setShowShortcutsModal(true)),
  ]

  useKeyboardShortcuts({ 
    shortcuts: keyboardShortcuts, 
    enabled: !state.editingScreenshot && !showShortcutsModal 
  })

  // Load screenshots on component mount
  useEffect(() => {
    loadScreenshots()
    
    // Set up event listeners
    window.api.onScreenshotProcessed((data) => {
      console.log('Screenshot processed:', data)
      loadScreenshots() // Refresh the list
    })

    window.api.onFocusSearch(() => {
      const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement
      if (searchInput) {
        searchInput.focus()
      }
    })

    return () => {
      window.api.removeAllListeners('screenshot-processed')
      window.api.removeAllListeners('focus-search')
    }
  }, [])

  const loadScreenshots = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      let screenshots: Screenshot[]
      
      if (state.searchQuery) {
        const results = await window.api.searchScreenshots(state.searchQuery)
        screenshots = results.map(result => result.screenshot)
      } else if (state.selectedFolder) {
        screenshots = await window.api.getScreenshotsForFolder(parseInt(state.selectedFolder))
      } else {
        screenshots = await window.api.getAllScreenshots(0, 100)
      }
      
      setState(prev => ({ 
        ...prev, 
        screenshots, 
        isLoading: false 
      }))
    } catch (error) {
      console.error('Failed to load screenshots:', error)
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to load screenshots', 
        isLoading: false 
      }))
    }
  }, [state.searchQuery, state.selectedFolder])

  // Reload when search query or folder changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadScreenshots()
    }, 300) // Debounce search

    return () => clearTimeout(timeoutId)
  }, [state.searchQuery, state.selectedFolder, loadScreenshots])

  const handleSearch = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }))
  }, [])

  const handleScreenshot = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const screenshot = await window.api.captureScreenshot()
      if (screenshot) {
        // Refresh the screenshots list
        setTimeout(() => {
          loadScreenshots()
        }, 1000) // Give time for AI processing
      }
    } catch (error) {
      console.error('Screenshot failed:', error)
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to capture screenshot', 
        isLoading: false 
      }))
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [loadScreenshots])

  const handleToggleFavorite = useCallback(async (screenshotId: string) => {
    try {
      await window.api.toggleFavorite(screenshotId)
      loadScreenshots()
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
    }
  }, [loadScreenshots])

  const handleDeleteScreenshot = useCallback(async (screenshotId: string) => {
    try {
      await window.api.deleteScreenshot(screenshotId)
      loadScreenshots()
    } catch (error) {
      console.error('Failed to delete screenshot:', error)
    }
  }, [loadScreenshots])

  const handleSelectionChange = useCallback((selectedIds: Set<string>) => {
    setState(prev => ({ ...prev, selectedScreenshots: selectedIds }))
  }, [])

  const handleViewChange = useCallback((view: 'grid' | 'list') => {
    setState(prev => ({ ...prev, currentView: view }))
  }, [])

  const handleEditScreenshot = useCallback((screenshot: Screenshot) => {
    setState(prev => ({ ...prev, editingScreenshot: screenshot }))
  }, [])

  const handleCloseEditor = useCallback(() => {
    setState(prev => ({ ...prev, editingScreenshot: null }))
  }, [])

  const handleSaveEditedScreenshot = useCallback(async (editedImageData: string) => {
    // TODO: Implement saving edited screenshot
    console.log('Saving edited screenshot:', editedImageData)
    handleCloseEditor()
  }, [handleCloseEditor])

  console.log('App component about to return JSX', { state })
  
  return (
    <div className="flex h-screen text-gray-900 dark:text-white bg-transparent rounded-xl overflow-hidden">
      {/* Native macOS Sidebar */}
      <div className="w-64 macos-vibrancy-sidebar">
        <Sidebar 
          onFolderSelect={(folderId) => setState(prev => ({ ...prev, selectedFolder: folderId }))}
          onTagSelect={(tagIds) => setState(prev => ({ ...prev, selectedTags: tagIds }))}
          selectedFolder={state.selectedFolder}
          selectedTags={state.selectedTags}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col macos-vibrancy-content">
        {/* Header with Search and Toolbar */}
        <header className="h-16 macos-vibrancy-toolbar flex items-center px-6 gap-4">
          <SearchBar 
            value={state.searchQuery}
            onChange={handleSearch}
            placeholder="Search screenshots..."
            className="flex-1"
          />
          
          <Toolbar
            currentView={state.currentView}
            onViewChange={handleViewChange}
            onCapture={handleScreenshot}
            isCapturing={state.isLoading}
            selectedCount={state.selectedScreenshots.size}
          />
        </header>

        {/* Error Display */}
        {state.error && (
          <div className="mx-6 mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-red-800 dark:text-red-200 text-sm">{state.error}</p>
              <button
                onClick={() => setState(prev => ({ ...prev, error: null }))}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-hidden bg-transparent">
          <ScreenshotGrid
            screenshots={state.screenshots}
            selectedScreenshots={state.selectedScreenshots}
            viewMode={state.currentView}
            isLoading={state.isLoading}
            onSelectionChange={handleSelectionChange}
            onToggleFavorite={handleToggleFavorite}
            onDelete={handleDeleteScreenshot}
            onEdit={handleEditScreenshot}
          />
        </main>

        {/* Status Bar */}
        <div className="h-8 bg-gray-100/80 dark:bg-gray-900/80 backdrop-blur-2xl border-t border-white/20 flex items-center px-6 text-xs text-gray-600 dark:text-gray-300">
          <span>{state.screenshots.length} screenshot{state.screenshots.length !== 1 ? 's' : ''}</span>
          {state.selectedScreenshots.size > 0 && (
            <span className="ml-4">{state.selectedScreenshots.size} selected</span>
          )}
        </div>
      </div>

      {/* Screenshot Editor Modal */}
      {state.editingScreenshot && (
        <ScreenshotEditor
          screenshot={state.editingScreenshot}
          onClose={handleCloseEditor}
          onSave={handleSaveEditedScreenshot}
        />
      )}

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
        shortcuts={keyboardShortcuts}
      />
    </div>
  )
}

export default App
