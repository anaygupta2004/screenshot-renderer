import { useState, useEffect, useRef } from 'react'
import { Search, X, Command } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  value, 
  onChange, 
  placeholder = "Search...",
  className = ""
}) => {
  const [isFocused, setIsFocused] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Load search history from localStorage
    const history = localStorage.getItem('screenshot-search-history')
    if (history) {
      try {
        setSearchHistory(JSON.parse(history))
      } catch (error) {
        console.error('Failed to load search history:', error)
      }
    }
  }, [])

  const saveToHistory = (query: string) => {
    if (!query.trim()) return
    
    const newHistory = [query, ...searchHistory.filter(h => h !== query)].slice(0, 10)
    setSearchHistory(newHistory)
    localStorage.setItem('screenshot-search-history', JSON.stringify(newHistory))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) {
      saveToHistory(value.trim())
      setShowSuggestions(false)
      inputRef.current?.blur()
    }
  }

  const handleClear = () => {
    onChange('')
    inputRef.current?.focus()
  }

  const handleFocus = () => {
    setIsFocused(true)
    if (searchHistory.length > 0) {
      setShowSuggestions(true)
    }
  }

  const handleBlur = () => {
    setIsFocused(false)
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => setShowSuggestions(false), 150)
  }

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion)
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const filteredSuggestions = searchHistory.filter(h => 
    h.toLowerCase().includes(value.toLowerCase()) && h !== value
  )

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className={`
          flex items-center bg-gray-100/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-lg border transition-all duration-200
          ${isFocused 
            ? 'border-blue-500/50 dark:border-blue-400/50 shadow-lg shadow-blue-500/20' 
            : 'border-gray-300/30 dark:border-gray-600/30 hover:border-gray-400/50 dark:hover:border-gray-500/50'
          }
        `}>
          <Search 
            size={18} 
            className={`ml-3 transition-colors duration-200 ${
              isFocused 
                ? 'text-blue-500 dark:text-blue-400' 
                : 'text-gray-400 dark:text-gray-500'
            }`} 
          />
          
          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="flex-1 px-3 py-2.5 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none"
            autoComplete="off"
          />
          
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="mr-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <X size={16} className="text-gray-400 dark:text-gray-500" />
            </button>
          )}
          
          <div className="mr-3 flex items-center text-xs text-gray-400 dark:text-gray-500">
            <Command size={12} className="mr-1" />
            <span>F</span>
          </div>
        </div>
      </form>

      {/* Search Suggestions */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-100/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-lg border border-gray-200/30 dark:border-gray-700/30 shadow-xl z-[100]">
          <div className="p-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 mb-1">
              Recent searches
            </div>
            {filteredSuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="flex items-center w-full px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <Search size={14} className="mr-2 text-gray-400 dark:text-gray-500" />
                <span className="flex-1 text-left">{suggestion}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Tips */}
      {isFocused && !value && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-100/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-lg border border-gray-200/30 dark:border-gray-700/30 shadow-xl z-[100]">
          <div className="p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Search tips
            </div>
            <div className="space-y-1 text-xs">
              <div className="text-gray-600 dark:text-gray-400">
                • Search by content, filename, or description
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                • Use quotes for exact phrases: "error message"
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                • Filter by type: type:code or type:interface
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchBar