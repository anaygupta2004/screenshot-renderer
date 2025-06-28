import './assets/base.css'
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

console.log('main.tsx loaded')

const rootElement = document.getElementById('root')
console.log('Root element:', rootElement)

if (rootElement) {
  const root = createRoot(rootElement)
  console.log('Creating React root')
  
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  )
  
  console.log('React render called')
} else {
  console.error('Root element not found!')
}
