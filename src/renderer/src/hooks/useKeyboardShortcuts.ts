import { useEffect, useCallback } from 'react'

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  action: () => void
  description: string
  category: string
}

interface UseKeyboardShortcutsProps {
  shortcuts: KeyboardShortcut[]
  enabled?: boolean
}

export const useKeyboardShortcuts = ({ shortcuts, enabled = true }: UseKeyboardShortcutsProps) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // Don't trigger shortcuts when typing in input fields
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return
    }

    const matchingShortcut = shortcuts.find(shortcut => {
      const keyMatches = shortcut.key.toLowerCase() === event.key.toLowerCase()
      const ctrlMatches = !!shortcut.ctrlKey === event.ctrlKey
      const metaMatches = !!shortcut.metaKey === event.metaKey
      const shiftMatches = !!shortcut.shiftKey === event.shiftKey
      const altMatches = !!shortcut.altKey === event.altKey

      return keyMatches && ctrlMatches && metaMatches && shiftMatches && altMatches
    })

    if (matchingShortcut) {
      event.preventDefault()
      event.stopPropagation()
      matchingShortcut.action()
    }
  }, [shortcuts, enabled])

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
    return () => {} // Return empty cleanup function when disabled
  }, [handleKeyDown, enabled])

  return { shortcuts }
}

// Predefined shortcut combinations for macOS
export const createShortcut = (
  key: string, 
  action: () => void, 
  description: string, 
  category: string = 'General',
  modifiers: { cmd?: boolean; ctrl?: boolean; shift?: boolean; alt?: boolean } = {}
): KeyboardShortcut => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  
  return {
    key,
    metaKey: isMac ? modifiers.cmd : false,
    ctrlKey: !isMac ? modifiers.ctrl : false,
    shiftKey: modifiers.shift,
    altKey: modifiers.alt,
    action,
    description,
    category
  }
}

// Common shortcut patterns
export const shortcuts = {
  // Capture shortcuts
  captureScreen: (action: () => void) => createShortcut('5', action, 'Capture Screenshot', 'Capture', { cmd: true, shift: true }),
  captureArea: (action: () => void) => createShortcut('4', action, 'Capture Area', 'Capture', { cmd: true, shift: true }),
  
  // Navigation shortcuts
  search: (action: () => void) => createShortcut('f', action, 'Focus Search', 'Navigation', { cmd: true }),
  refresh: (action: () => void) => createShortcut('r', action, 'Refresh', 'Navigation', { cmd: true }),
  home: (action: () => void) => createShortcut('h', action, 'Go Home', 'Navigation', { cmd: true }),
  
  // View shortcuts
  toggleGrid: (action: () => void) => createShortcut('1', action, 'Grid View', 'View', { cmd: true }),
  toggleList: (action: () => void) => createShortcut('2', action, 'List View', 'View', { cmd: true }),
  toggleSidebar: (action: () => void) => createShortcut('/', action, 'Toggle Sidebar', 'View', { cmd: true }),
  
  // Selection shortcuts
  selectAll: (action: () => void) => createShortcut('a', action, 'Select All', 'Selection', { cmd: true }),
  deselectAll: (action: () => void) => createShortcut('d', action, 'Deselect All', 'Selection', { cmd: true }),
  
  // Actions shortcuts
  deleteSelected: (action: () => void) => createShortcut('Backspace', action, 'Delete Selected', 'Actions'),
  favoriteSelected: (action: () => void) => createShortcut('l', action, 'Toggle Favorite', 'Actions', { cmd: true }),
  exportSelected: (action: () => void) => createShortcut('e', action, 'Export Selected', 'Actions', { cmd: true }),
  copySelected: (action: () => void) => createShortcut('c', action, 'Copy Selected', 'Actions', { cmd: true }),
  
  // Editor shortcuts
  openEditor: (action: () => void) => createShortcut('Enter', action, 'Open Editor', 'Editor'),
  closeEditor: (action: () => void) => createShortcut('Escape', action, 'Close Editor', 'Editor'),
  saveEditor: (action: () => void) => createShortcut('s', action, 'Save Edits', 'Editor', { cmd: true }),
  
  // Quick actions
  quickExport: (action: () => void) => createShortcut('e', action, 'Quick Export', 'Quick Actions', { cmd: true, shift: true }),
  quickCopy: (action: () => void) => createShortcut('c', action, 'Quick Copy', 'Quick Actions', { cmd: true, shift: true }),
  quickDelete: (action: () => void) => createShortcut('Delete', action, 'Quick Delete', 'Quick Actions'),
  
  // Advanced shortcuts
  openPreferences: (action: () => void) => createShortcut(',', action, 'Preferences', 'Advanced', { cmd: true }),
  showShortcuts: (action: () => void) => createShortcut('?', action, 'Show Shortcuts', 'Advanced', { cmd: true }),
  devTools: (action: () => void) => createShortcut('i', action, 'Developer Tools', 'Advanced', { cmd: true, alt: true }),
}

export default useKeyboardShortcuts