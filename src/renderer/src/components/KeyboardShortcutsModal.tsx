import { X, Keyboard } from 'lucide-react'

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  description: string
  category: string
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
  shortcuts: KeyboardShortcut[]
}

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ 
  isOpen, 
  onClose, 
  shortcuts 
}) => {
  if (!isOpen) return null

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

  const formatShortcut = (shortcut: KeyboardShortcut) => {
    const parts: string[] = []
    
    if (shortcut.metaKey) parts.push(isMac ? '⌘' : 'Ctrl')
    if (shortcut.ctrlKey && !isMac) parts.push('Ctrl')
    if (shortcut.shiftKey) parts.push(isMac ? '⇧' : 'Shift')
    if (shortcut.altKey) parts.push(isMac ? '⌥' : 'Alt')
    
    // Format special keys
    let key = shortcut.key
    switch (key.toLowerCase()) {
      case 'enter':
        key = isMac ? '↩' : 'Enter'
        break
      case 'escape':
        key = isMac ? '⎋' : 'Esc'
        break
      case 'backspace':
        key = isMac ? '⌫' : 'Backspace'
        break
      case 'delete':
        key = isMac ? '⌦' : 'Del'
        break
      case ' ':
        key = 'Space'
        break
      default:
        key = key.toUpperCase()
    }
    
    parts.push(key)
    return parts.join(isMac ? '' : '+')
  }

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = []
    }
    acc[shortcut.category].push(shortcut)
    return acc
  }, {} as Record<string, KeyboardShortcut[]>)

  const categoryOrder = [
    'Capture',
    'Navigation', 
    'View',
    'Selection',
    'Actions',
    'Editor',
    'Quick Actions',
    'Advanced',
    'General'
  ]

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden border border-white/20">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Keyboard size={24} className="text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Keyboard Shortcuts
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Power user shortcuts for faster workflow
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Close"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {categoryOrder.map(category => {
              const categoryShortcuts = groupedShortcuts[category]
              if (!categoryShortcuts || categoryShortcuts.length === 0) return null

              return (
                <div key={category} className="space-y-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200/50 dark:border-gray-700/50 pb-2">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {categoryShortcuts.map((shortcut, index) => (
                      <div 
                        key={`${category}-${index}`}
                        className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {shortcut.description}
                        </span>
                        <div className="flex items-center gap-1">
                          {formatShortcut(shortcut).split(isMac ? '' : '+').map((part, partIndex) => (
                            <span key={partIndex}>
                              <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded shadow-sm">
                                {part}
                              </kbd>
                              {!isMac && partIndex < formatShortcut(shortcut).split('+').length - 1 && (
                                <span className="mx-1 text-gray-400">+</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Keyboard size={16} />
            <span>Press <kbd className="px-1 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">⌘?</kbd> to toggle this help</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

export default KeyboardShortcutsModal