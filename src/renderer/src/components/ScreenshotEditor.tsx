import { useState, useRef, useEffect } from 'react'
import { 
  X, 
  Download, 
  Copy, 
  Crop, 
  Type,
  Circle,
  Square,
  ArrowRight,
  Highlighter,
  Undo,
  Redo,
  Save,
  ZoomIn,
  ZoomOut,
  Move,
  Pen,
  Focus,
  Sparkles
} from 'lucide-react'

interface ScreenshotEditorProps {
  screenshot: {
    id: string
    filepath: string
    filename: string
    width?: number
    height?: number
  }
  onClose: () => void
  onSave?: (editedImageData: string) => void
}

type Tool = 'select' | 'text' | 'arrow' | 'rectangle' | 'circle' | 'highlight' | 'blur' | 'crop' | 'draw' | 'pixelate'

interface Annotation {
  id: string
  type: Tool
  x: number
  y: number
  width?: number
  height?: number
  text?: string
  color?: string
  strokeWidth?: number
}

const ScreenshotEditor: React.FC<ScreenshotEditorProps> = ({ screenshot, onClose, onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [selectedTool, setSelectedTool] = useState<Tool>('select')
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedColor, setSelectedColor] = useState('#FF0000')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [zoom, setZoom] = useState(1)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 })
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null)
  
  // History for undo/redo
  const [history, setHistory] = useState<Annotation[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  useEffect(() => {
    // Load the screenshot image
    const img = new Image()
    img.onload = () => {
      setImage(img)
      if (canvasRef.current) {
        const canvas = canvasRef.current
        canvas.width = img.width
        canvas.height = img.height
        redrawCanvas(img, [])
      }
    }
    img.src = `screenshot://${screenshot.filepath}`
  }, [screenshot])

  const redrawCanvas = (img: HTMLImageElement, annots: Annotation[]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Draw image
    ctx.drawImage(img, 0, 0)
    
    // Draw annotations
    annots.forEach(annotation => {
      drawAnnotation(ctx, annotation)
    })
    
    // Draw current annotation being created
    if (currentAnnotation) {
      drawAnnotation(ctx, currentAnnotation)
    }
  }

  const drawAnnotation = (ctx: CanvasRenderingContext2D, annotation: Annotation) => {
    ctx.save()
    
    ctx.strokeStyle = annotation.color || selectedColor
    ctx.lineWidth = annotation.strokeWidth || strokeWidth
    ctx.fillStyle = annotation.color || selectedColor
    
    switch (annotation.type) {
      case 'rectangle':
        ctx.strokeRect(
          annotation.x, 
          annotation.y, 
          annotation.width || 0, 
          annotation.height || 0
        )
        break
        
      case 'circle':
        const radius = Math.sqrt(
          Math.pow(annotation.width || 0, 2) + 
          Math.pow(annotation.height || 0, 2)
        ) / 2
        ctx.beginPath()
        ctx.arc(
          annotation.x + (annotation.width || 0) / 2,
          annotation.y + (annotation.height || 0) / 2,
          radius,
          0,
          2 * Math.PI
        )
        ctx.stroke()
        break
        
      case 'arrow':
        drawArrow(
          ctx,
          annotation.x,
          annotation.y,
          annotation.x + (annotation.width || 0),
          annotation.y + (annotation.height || 0)
        )
        break
        
      case 'highlight':
        ctx.globalAlpha = 0.3
        ctx.fillRect(
          annotation.x,
          annotation.y,
          annotation.width || 0,
          annotation.height || 0
        )
        break
        
      case 'text':
        ctx.font = '16px Arial'
        ctx.fillText(annotation.text || '', annotation.x, annotation.y)
        break
        
      case 'blur':
        // Simple blur effect using multiple overlapping rectangles
        ctx.globalAlpha = 0.1
        for (let i = 0; i < 10; i++) {
          ctx.fillRect(
            annotation.x + Math.random() * 4 - 2,
            annotation.y + Math.random() * 4 - 2,
            annotation.width || 0,
            annotation.height || 0
          )
        }
        break
        
      case 'pixelate':
        // Simple pixelation effect
        const pixelSize = 8
        ctx.fillStyle = annotation.color || selectedColor
        for (let x = annotation.x; x < annotation.x + (annotation.width || 0); x += pixelSize) {
          for (let y = annotation.y; y < annotation.y + (annotation.height || 0); y += pixelSize) {
            ctx.fillRect(x, y, pixelSize, pixelSize)
          }
        }
        break
    }
    
    ctx.restore()
  }

  const drawArrow = (
    ctx: CanvasRenderingContext2D, 
    fromX: number, 
    fromY: number, 
    toX: number, 
    toY: number
  ) => {
    const headLength = 10
    const angle = Math.atan2(toY - fromY, toX - fromX)
    
    // Draw line
    ctx.beginPath()
    ctx.moveTo(fromX, fromY)
    ctx.lineTo(toX, toY)
    ctx.stroke()
    
    // Draw arrow head
    ctx.beginPath()
    ctx.moveTo(toX, toY)
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    )
    ctx.moveTo(toX, toY)
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    )
    ctx.stroke()
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool === 'select') return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom
    const y = (e.clientY - rect.top) / zoom
    
    setIsDrawing(true)
    setStartPoint({ x, y })
    
    const newAnnotation: Annotation = {
      id: Date.now().toString(),
      type: selectedTool,
      x,
      y,
      color: selectedColor,
      strokeWidth: strokeWidth
    }
    
    if (selectedTool === 'text') {
      const text = prompt('Enter text:')
      if (text) {
        newAnnotation.text = text
        addAnnotation({ ...newAnnotation })
      }
      setIsDrawing(false)
    } else {
      setCurrentAnnotation(newAnnotation)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentAnnotation) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom
    const y = (e.clientY - rect.top) / zoom
    
    const width = x - startPoint.x
    const height = y - startPoint.y
    
    setCurrentAnnotation({
      ...currentAnnotation,
      width,
      height
    })
    
    if (image) {
      redrawCanvas(image, annotations)
    }
  }

  const handleMouseUp = () => {
    if (!isDrawing || !currentAnnotation) return
    
    if (currentAnnotation.type !== 'text') {
      addAnnotation(currentAnnotation)
    }
    
    setIsDrawing(false)
    setCurrentAnnotation(null)
  }

  const addAnnotation = (annotation: Annotation) => {
    const newAnnotations = [...annotations, annotation]
    setAnnotations(newAnnotations)
    
    // Update history
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newAnnotations)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
    
    if (image) {
      redrawCanvas(image, newAnnotations)
    }
  }

  const undo = () => {
    if (historyIndex > 0) {
      const prevAnnotations = history[historyIndex - 1]
      setAnnotations(prevAnnotations)
      setHistoryIndex(historyIndex - 1)
      if (image) {
        redrawCanvas(image, prevAnnotations)
      }
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextAnnotations = history[historyIndex + 1]
      setAnnotations(nextAnnotations)
      setHistoryIndex(historyIndex + 1)
      if (image) {
        redrawCanvas(image, nextAnnotations)
      }
    }
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const imageData = canvas.toDataURL('image/png')
    if (onSave) {
      onSave(imageData)
    }
  }

  const handleExport = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const link = document.createElement('a')
    link.download = `edited-${screenshot.filename}`
    link.href = canvas.toDataURL()
    link.click()
  }

  const handleCopy = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    try {
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png')
      })
      
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ])
      
      // Show success message
      alert('Image copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy image:', err)
    }
  }

  const tools = [
    { id: 'select', icon: Move, label: 'Select' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'highlight', icon: Highlighter, label: 'Highlight' },
    { id: 'draw', icon: Pen, label: 'Draw' },
    { id: 'blur', icon: Focus, label: 'Blur' },
    { id: 'pixelate', icon: Sparkles, label: 'Pixelate' },
    { id: 'crop', icon: Crop, label: 'Crop' }
  ]

  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#000000', '#FFFFFF']

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 backdrop-blur-xl z-50 flex flex-col">
      {/* Header */}
      <div className="h-16 bg-gray-900/50 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">Edit Screenshot</h2>
          <span className="text-sm text-gray-400">{screenshot.filename}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-lg disabled:opacity-50"
            title="Undo"
          >
            <Undo size={20} />
          </button>
          
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-lg disabled:opacity-50"
            title="Redo"
          >
            <Redo size={20} />
          </button>
          
          <div className="w-px h-6 bg-gray-700 mx-2" />
          
          <button
            onClick={handleCopy}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-lg"
            title="Copy to clipboard"
          >
            <Copy size={20} />
          </button>
          
          <button
            onClick={handleExport}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-lg"
            title="Export"
          >
            <Download size={20} />
          </button>
          
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
          >
            <Save size={16} />
            Save
          </button>
          
          <button
            onClick={onClose}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-lg ml-2"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex">
        {/* Toolbar */}
        <div className="w-16 bg-gray-900/50 backdrop-blur-xl border-r border-white/10 p-2">
          <div className="space-y-1">
            {tools.map(tool => (
              <button
                key={tool.id}
                onClick={() => setSelectedTool(tool.id as Tool)}
                className={`w-full p-3 rounded-lg flex items-center justify-center transition-colors ${
                  selectedTool === tool.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
                title={tool.label}
              >
                <tool.icon size={20} />
              </button>
            ))}
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-700">
            <div className="space-y-2">
              {colors.map(color => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-full h-8 rounded border-2 transition-all ${
                    selectedColor === color 
                      ? 'border-white scale-110' 
                      : 'border-transparent hover:border-gray-500'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-700">
            <label className="text-xs text-gray-400">Stroke</label>
            <input
              type="range"
              min="1"
              max="10"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
              className="w-full mt-2"
            />
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex items-center justify-center overflow-auto bg-gray-50 dark:bg-gray-900 p-4">
          <div 
            className="relative"
            style={{ 
              transform: `scale(${zoom})`, 
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease-out'
            }}
          >
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="border border-gray-300 dark:border-gray-600 shadow-lg rounded-lg bg-white"
              style={{
                cursor: selectedTool === 'select' ? 'default' : 'crosshair',
                maxWidth: 'calc(100vw - 600px)',
                maxHeight: 'calc(100vh - 200px)'
              }}
            />
          </div>
        </div>

        {/* Right Panel - Properties */}
        <div className="w-64 bg-gray-900/50 backdrop-blur-xl border-l border-white/10 p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Properties</h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400">Zoom</label>
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-sm text-gray-300 w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom(Math.min(2, zoom + 0.25))}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded"
                >
                  <ZoomIn size={16} />
                </button>
              </div>
            </div>
            
            <div>
              <label className="text-xs text-gray-400">Annotations</label>
              <p className="text-sm text-gray-300 mt-1">{annotations.length} items</p>
            </div>
            
            {screenshot.width && screenshot.height && (
              <div>
                <label className="text-xs text-gray-400">Dimensions</label>
                <p className="text-sm text-gray-300 mt-1">
                  {screenshot.width} × {screenshot.height}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScreenshotEditor