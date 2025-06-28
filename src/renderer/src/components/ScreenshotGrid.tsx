import { useState, useCallback, useMemo } from 'react'
import { 
  Heart, 
  Trash2, 
  Download, 
  Eye,
  Calendar,
  FileText,
  Loader2,
  ImageIcon
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

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

interface ScreenshotGridProps {
  screenshots: Screenshot[]
  selectedScreenshots: Set<string>
  viewMode: 'grid' | 'list'
  isLoading: boolean
  onSelectionChange: (selectedIds: Set<string>) => void
  onToggleFavorite: (screenshotId: string) => void
  onDelete: (screenshotId: string) => void
  onEdit?: (screenshot: Screenshot) => void
}

const ScreenshotGrid: React.FC<ScreenshotGridProps> = ({
  screenshots,
  selectedScreenshots,
  viewMode,
  isLoading,
  onSelectionChange,
  onToggleFavorite,
  onDelete,
  onEdit
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  const formatDate = useCallback((timestamp: number) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
  }, [])

  const handleImageError = useCallback((screenshotId: string) => {
    setImageErrors(prev => new Set(prev).add(screenshotId))
  }, [])

  const handleItemClick = useCallback((screenshotId: string, event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey) {
      // Multi-select
      const newSelection = new Set(selectedScreenshots)
      if (newSelection.has(screenshotId)) {
        newSelection.delete(screenshotId)
      } else {
        newSelection.add(screenshotId)
      }
      onSelectionChange(newSelection)
    } else {
      // Single select or deselect
      const newSelection = selectedScreenshots.has(screenshotId) 
        ? new Set<string>() 
        : new Set<string>([screenshotId])
      onSelectionChange(newSelection)
    }
  }, [selectedScreenshots, onSelectionChange])

  const handleItemDoubleClick = useCallback((screenshot: Screenshot, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (onEdit) {
      onEdit(screenshot)
    }
  }, [onEdit])

  const ScreenshotCard = useMemo(() => ({ screenshot }: { screenshot: Screenshot }) => {
    const isSelected = selectedScreenshots.has(screenshot.id)
    const isHovered = hoveredId === screenshot.id
    const hasImageError = imageErrors.has(screenshot.id)
    
    return (
      <div
        className={`
          relative group cursor-pointer transition-all duration-200 rounded-xl overflow-hidden hover-lift
          ${isSelected 
            ? 'ring-2 ring-blue-500 dark:ring-blue-400 shadow-macos-lg' 
            : 'shadow-macos'
          }
        `}
        onClick={(e) => handleItemClick(screenshot.id, e)}
        onDoubleClick={(e) => handleItemDoubleClick(screenshot, e)}
        onMouseEnter={() => setHoveredId(screenshot.id)}
        onMouseLeave={() => setHoveredId(null)}
      >
        {/* Thumbnail */}
        <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
          {hasImageError || !screenshot.thumbnail_path ? (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon size={32} className="text-gray-400 dark:text-gray-600" />
            </div>
          ) : (
            <img
              src={`screenshot://${screenshot.thumbnail_path || screenshot.filepath}`}
              alt={screenshot.filename}
              className="w-full h-full object-cover rounded-lg"
              onError={() => handleImageError(screenshot.id)}
            />
          )}
          
          {/* Overlay Actions */}
          {(isHovered || isSelected) && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent">
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onEdit) {
                        onEdit(screenshot)
                      }
                    }}
                    className="p-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-md transition-all duration-200"
                    title="Edit"
                  >
                    <Eye size={12} className="text-white" />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFavorite(screenshot.id)
                    }}
                    className="p-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-md transition-all duration-200"
                    title={screenshot.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart 
                      size={12} 
                      className={screenshot.is_favorite ? 'text-red-400 fill-current' : 'text-white'} 
                    />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      window.api.exportScreenshot(screenshot.id, screenshot.filename)
                    }}
                    className="p-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-md transition-all duration-200"
                    title="Export"
                  >
                    <Download size={12} className="text-white" />
                  </button>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(screenshot.id)
                  }}
                  className="p-1.5 bg-red-500/80 hover:bg-red-600/90 backdrop-blur-sm rounded-md transition-all duration-200"
                  title="Delete"
                >
                  <Trash2 size={12} className="text-white" />
                </button>
              </div>
            </div>
          )}
          
          {/* Selection Indicator */}
          {isSelected && (
            <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-blue-500 dark:bg-blue-400 rounded-full flex items-center justify-center shadow-lg">
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
            </div>
          )}
          
          {/* Favorite Indicator */}
          {screenshot.is_favorite && !isSelected && (
            <div className="absolute top-1.5 right-1.5 p-1 bg-white/20 backdrop-blur-sm rounded-full">
              <Heart size={12} className="text-red-400 fill-current" />
            </div>
          )}
        </div>
        
        {/* Info */}
        <div className="p-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-t border-gray-200/50 dark:border-gray-700/50">
          <h3 className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate leading-tight">
            {screenshot.filename}
          </h3>
          
          <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
            <span className="truncate">{formatDate(screenshot.created_at)}</span>
            <span className="ml-2 shrink-0">{formatFileSize(screenshot.file_size)}</span>
          </div>
          
          {screenshot.width && screenshot.height && (
            <div className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
              {screenshot.width} × {screenshot.height}
            </div>
          )}
        </div>
      </div>
    )
  }, [selectedScreenshots, hoveredId, imageErrors, handleItemClick, handleItemDoubleClick, onToggleFavorite, formatDate, formatFileSize, handleImageError])

  const ScreenshotListItem = useMemo(() => ({ screenshot }: { screenshot: Screenshot }) => {
    const isSelected = selectedScreenshots.has(screenshot.id)
    const hasImageError = imageErrors.has(screenshot.id)
    
    return (
      <div
        className={`
          flex items-center p-3 cursor-pointer macos-list-item
          ${isSelected 
            ? 'bg-blue-100/70 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700' 
            : ''
          }
        `}
        onClick={(e) => handleItemClick(screenshot.id, e)}
        onDoubleClick={(e) => handleItemDoubleClick(screenshot, e)}
      >
        {/* Thumbnail */}
        <div className="w-16 h-12 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden flex-shrink-0">
          {hasImageError || !screenshot.thumbnail_path ? (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon size={16} className="text-gray-400 dark:text-gray-600" />
            </div>
          ) : (
            <img
              src={`screenshot://${screenshot.thumbnail_path || screenshot.filepath}`}
              alt={screenshot.filename}
              className="w-full h-full object-cover rounded-lg"
              onError={() => handleImageError(screenshot.id)}
            />
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1 ml-3 min-w-0">
          <div className="flex items-center">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {screenshot.filename}
            </h3>
            {screenshot.is_favorite && (
              <Heart size={12} className="ml-2 text-red-500 fill-current flex-shrink-0" />
            )}
          </div>
          
          <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              {formatDate(screenshot.created_at)}
            </span>
            
            <span className="flex items-center gap-1">
              <FileText size={10} />
              {formatFileSize(screenshot.file_size)}
            </span>
            
            {screenshot.width && screenshot.height && (
              <span className="text-[11px]">
                {screenshot.width} × {screenshot.height}
              </span>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1 ml-3">
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (onEdit) {
                onEdit(screenshot)
              }
            }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
            title="Edit"
          >
            <Eye size={12} className="text-gray-600 dark:text-gray-300" />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite(screenshot.id)
            }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
            title={screenshot.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart 
              size={12} 
              className={screenshot.is_favorite ? 'text-red-500 fill-current' : 'text-gray-600 dark:text-gray-300'} 
            />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              window.api.exportScreenshot(screenshot.id, screenshot.filename)
            }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
            title="Export"
          >
            <Download size={12} className="text-gray-600 dark:text-gray-300" />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(screenshot.id)
            }}
            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors"
            title="Delete"
          >
            <Trash2 size={12} className="text-red-600 dark:text-red-400" />
          </button>
        </div>
      </div>
    )
  }, [selectedScreenshots, imageErrors, handleItemClick, handleItemDoubleClick, onToggleFavorite, onDelete, formatDate, formatFileSize, handleImageError])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-gray-400 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-gray-600 dark:text-gray-400">Loading screenshots...</p>
        </div>
      </div>
    )
  }

  if (screenshots.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <ImageIcon size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No screenshots found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Capture your first screenshot to get started
          </p>
          <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-md transition-colors">
            Capture Screenshot
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-transparent">
      {viewMode === 'grid' ? (
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {screenshots.map((screenshot) => (
              <ScreenshotCard key={screenshot.id} screenshot={screenshot} />
            ))}
          </div>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {screenshots.map((screenshot) => (
            <ScreenshotListItem key={screenshot.id} screenshot={screenshot} />
          ))}
        </div>
      )}
    </div>
  )
}

export default ScreenshotGrid