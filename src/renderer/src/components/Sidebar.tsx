import { useState, useEffect } from 'react'
import { 
  Folder, 
  Heart, 
  Clock, 
  Camera, 
  Tag, 
  Settings,
  Plus,
  ChevronRight,
  ChevronDown,
  Image
} from 'lucide-react'

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

interface Tag {
  id?: number
  name: string
  color: string
  created_at: number
}

interface SidebarProps {
  onFolderSelect: (folderId: string | null) => void
  onTagSelect: (tagIds: number[]) => void
  selectedFolder: string | null
  selectedTags: number[]
}

const Sidebar: React.FC<SidebarProps> = ({ 
  onFolderSelect, 
  onTagSelect, 
  selectedFolder, 
  selectedTags 
}) => {
  const [folders, setFolders] = useState<Folder[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [stats, setStats] = useState<any>({})
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['smart-folders', 'folders', 'tags'])
  )

  useEffect(() => {
    loadFolders()
    loadTags()
    loadStats()
  }, [])

  const loadFolders = async () => {
    try {
      const folderData = await window.api.getAllFolders()
      setFolders(folderData)
    } catch (error) {
      console.error('Failed to load folders:', error)
    }
  }

  const loadTags = async () => {
    try {
      const tagData = await window.api.getAllTags()
      setTags(tagData)
    } catch (error) {
      console.error('Failed to load tags:', error)
    }
  }

  const loadStats = async () => {
    try {
      const statsData = await window.api.getAppStats()
      setStats(statsData)
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }

  const handleFolderClick = (folderId: string | null) => {
    onFolderSelect(folderId)
  }

  const handleTagToggle = (tagId: number) => {
    const newSelectedTags = selectedTags.includes(tagId)
      ? selectedTags.filter(id => id !== tagId)
      : [...selectedTags, tagId]
    onTagSelect(newSelectedTags)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getIconForFolder = (iconName: string) => {
    switch (iconName) {
      case 'image': return <Image size={16} />
      case 'heart': return <Heart size={16} />
      case 'clock': return <Clock size={16} />
      case 'camera': return <Camera size={16} />
      default: return <Folder size={16} />
    }
  }

  const smartFolders = folders.filter(f => f.is_smart)
  const regularFolders = folders.filter(f => !f.is_smart)

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* Header */}
      <div className="p-4 border-b border-gray-200/30 dark:border-gray-700/30">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Screenshot Manager
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {stats.total_screenshots || 0} items • {formatFileSize(stats.total_size || 0)}
        </p>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto bg-transparent">
        {/* Smart Folders */}
        <div className="p-2">
          <button
            onClick={() => toggleSection('smart-folders')}
            className="flex items-center w-full p-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-md"
          >
            {expandedSections.has('smart-folders') ? (
              <ChevronDown size={14} className="mr-1" />
            ) : (
              <ChevronRight size={14} className="mr-1" />
            )}
            Smart Folders
          </button>
          
          {expandedSections.has('smart-folders') && (
            <div className="ml-4 space-y-1">
              {smartFolders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => handleFolderClick(folder.id?.toString() || null)}
                  className={`flex items-center w-full p-2 text-sm rounded-md transition-colors ${
                    selectedFolder === folder.id?.toString()
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <span style={{ color: folder.color }} className="mr-2">
                    {getIconForFolder(folder.icon)}
                  </span>
                  <span className="flex-1 text-left">{folder.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Regular Folders */}
        {regularFolders.length > 0 && (
          <div className="p-2">
            <div
              onClick={() => toggleSection('folders')}
              className="flex items-center w-full p-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-md cursor-pointer"
            >
              {expandedSections.has('folders') ? (
                <ChevronDown size={14} className="mr-1" />
              ) : (
                <ChevronRight size={14} className="mr-1" />
              )}
              Folders
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  // TODO: Open create folder dialog
                }}
                className="ml-auto p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              >
                <Plus size={12} />
              </button>
            </div>
            
            {expandedSections.has('folders') && (
              <div className="ml-4 space-y-1">
                {regularFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => handleFolderClick(folder.id?.toString() || null)}
                    className={`flex items-center w-full p-2 text-sm rounded-md transition-colors ${
                      selectedFolder === folder.id?.toString()
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <span style={{ color: folder.color }} className="mr-2">
                      {getIconForFolder(folder.icon)}
                    </span>
                    <span className="flex-1 text-left">{folder.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        <div className="p-2">
          <div
            onClick={() => toggleSection('tags')}
            className="flex items-center w-full p-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-md cursor-pointer"
          >
            {expandedSections.has('tags') ? (
              <ChevronDown size={14} className="mr-1" />
            ) : (
              <ChevronRight size={14} className="mr-1" />
            )}
            Tags
            <button
              onClick={(e) => {
                e.stopPropagation()
                // TODO: Open create tag dialog
              }}
              className="ml-auto p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              <Plus size={12} />
            </button>
          </div>
          
          {expandedSections.has('tags') && (
            <div className="ml-4 space-y-1">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => tag.id && handleTagToggle(tag.id)}
                  className={`flex items-center w-full p-2 text-sm rounded-md transition-colors ${
                    tag.id && selectedTags.includes(tag.id)
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <Tag size={12} style={{ color: tag.color }} className="mr-2" />
                  <span className="flex-1 text-left">{tag.name}</span>
                </button>
              ))}
              
              {tags.length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 p-2">
                  No tags yet
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="p-2 border-t border-gray-200/50 dark:border-gray-700/50">
        <button className="flex items-center w-full p-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-md">
          <Settings size={16} className="mr-2" />
          Settings
        </button>
      </div>
    </div>
  )
}

export default Sidebar