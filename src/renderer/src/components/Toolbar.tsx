import { Camera, Grid, List, MoreHorizontal, Trash2, Heart, Download, Tag } from 'lucide-react'

interface ToolbarProps {
  currentView: 'grid' | 'list'
  onViewChange: (view: 'grid' | 'list') => void
  onCapture: () => void
  isCapturing: boolean
  selectedCount: number
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  currentView, 
  onViewChange, 
  onCapture, 
  isCapturing, 
  selectedCount 
}) => {
  return (
    <div className="flex items-center gap-2">
      {/* Selection Actions */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 mr-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {selectedCount} selected
          </span>
          
          <div className="flex items-center gap-1">
            <button
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Add to favorites"
            >
              <Heart size={16} className="text-gray-600 dark:text-gray-400" />
            </button>
            
            <button
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Add tags"
            >
              <Tag size={16} className="text-gray-600 dark:text-gray-400" />
            </button>
            
            <button
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Export"
            >
              <Download size={16} className="text-gray-600 dark:text-gray-400" />
            </button>
            
            <button
              className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors"
              title="Delete"
            >
              <Trash2 size={16} className="text-red-600 dark:text-red-400" />
            </button>
          </div>
          
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />
        </div>
      )}

      {/* View Controls - macOS Screenshot Tool Style */}
      <div className="flex items-center macos-button rounded-lg p-1">
        <button
          onClick={() => onViewChange('grid')}
          className={`p-1.5 rounded transition-colors ${
            currentView === 'grid'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
          }`}
          title="Grid view"
        >
          <Grid size={16} />
        </button>
        
        <button
          onClick={() => onViewChange('list')}
          className={`p-1.5 rounded transition-colors ${
            currentView === 'list'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
          }`}
          title="List view"
        >
          <List size={16} />
        </button>
      </div>

      {/* Capture Button */}
      <button
        onClick={onCapture}
        disabled={isCapturing}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200
          ${isCapturing
            ? 'macos-button opacity-50 cursor-not-allowed'
            : 'macos-button-accent'
          }
        `}
        title="Capture screenshot (⌘⇧5)"
      >
        <Camera size={16} className={isCapturing ? 'animate-pulse' : ''} />
        <span className="hidden sm:inline">
          {isCapturing ? 'Capturing...' : 'Capture'}
        </span>
      </button>

      {/* More Options */}
      <button
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        title="More options"
      >
        <MoreHorizontal size={16} className="text-gray-600 dark:text-gray-400" />
      </button>
    </div>
  )
}

export default Toolbar