import * as fs from 'fs'
import * as path from 'path'
import log from 'electron-log'
import { b } from '../../../baml_client/async_client.js'
import { Image } from '@boundaryml/baml'

interface IndexedItem {
  id: string
  path: string
  type: 'image' | 'text'
  metadata?: any
  embedding?: number[]
  content?: string
}

interface SearchResult {
  id: string
  score: number
  item: IndexedItem
}

export class OpenAIEmbeddingService {
  private items: Map<string, IndexedItem> = new Map()
  private metadataPath: string
  private readonly apiKey: string

  constructor(private baseDir: string) {
    this.metadataPath = path.join(baseDir, 'embeddings', 'openai_metadata.json')
    this.apiKey = process.env.OPENAI_API_KEY || ''
    this.ensureDirectoryExists()
    this.loadExistingData()
  }

  private ensureDirectoryExists(): void {
    const embeddingsDir = path.join(this.baseDir, 'embeddings')
    if (!fs.existsSync(embeddingsDir)) {
      fs.mkdirSync(embeddingsDir, { recursive: true })
    }
  }

  private loadExistingData(): void {
    try {
      if (fs.existsSync(this.metadataPath)) {
        const data = JSON.parse(fs.readFileSync(this.metadataPath, 'utf-8'))
        this.items = new Map(Object.entries(data.items || {}))
        log.info(`Loaded ${this.items.size} embeddings from OpenAI index`)
      }
    } catch (error) {
      log.error('Failed to load existing embeddings:', error)
    }
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured')
    }
    log.info('OpenAI Embedding Service initialized')
  }

  async addImage(id: string, imagePath: string, metadata?: any): Promise<void> {
    try {
      // Check if already indexed
      if (this.items.has(id)) {
        log.info(`Image ${id} already indexed, skipping...`)
        return
      }

      log.info(`🔍 Creating embedding for image: ${id}`)
      log.info(`📝 Metadata provided:`, !!metadata)
      log.info(`📝 Comprehensive description in metadata:`, !!metadata?.comprehensive_description)

      // Generate comprehensive description using BAML first
      const comprehensiveContent = await this.generateComprehensiveDescription(imagePath, metadata)
      
      if (!comprehensiveContent || comprehensiveContent.trim().length === 0) {
        throw new Error(`No comprehensive content generated for image ${id}`)
      }
      
      log.info(`📝 Generated comprehensive content length: ${comprehensiveContent.length}`)
      log.info(`📝 First 200 chars: ${comprehensiveContent.substring(0, 200)}...`)
      
      // Create embedding using OpenAI's text-embedding-ada-002 model
      log.info(`🔗 Creating OpenAI embedding for image: ${id}`)
      const embedding = await this.createEmbedding(comprehensiveContent)
      
      if (!embedding || embedding.length === 0) {
        throw new Error(`Failed to create embedding for image ${id}`)
      }
      
      log.info(`✅ Embedding created successfully - dimensions: ${embedding.length}`)

      // Store the item
      const item: IndexedItem = {
        id,
        path: imagePath,
        type: 'image',
        metadata,
        embedding,
        content: comprehensiveContent
      }

      this.items.set(id, item)
      log.info(`📊 Total items in embedding index: ${this.items.size}`)
      
      // Save immediately to ensure embeddings persist
      log.info(`💾 Saving embedding index (${this.items.size} items)`)
      await this.save()

      log.info(`✅ Added image ${id} to OpenAI embedding index`)
    } catch (error) {
      log.error(`❌ Failed to add image ${id}:`, error)
      log.error(`   Error details:`, error instanceof Error ? error.message : String(error))
      log.error(`   Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
      throw error
    }
  }

  private async generateComprehensiveDescription(imagePath: string, metadata?: any): Promise<string> {
    // If we already have a comprehensive description from BAML/OpenAI, use it directly
    if (metadata?.comprehensive_description) {
      return metadata.comprehensive_description
    }
    
    try {
      // Fallback: read image and use BAML to generate description
      const imageBuffer = fs.readFileSync(imagePath)
      const base64Image = imageBuffer.toString('base64')
      const image = Image.fromBase64('image/png', base64Image)
      
      // Use BAML with OpenAI to get comprehensive description
      const description = await b.GenerateComprehensiveDescription(
        image,
        metadata?.ocr_text || '',
        metadata?.ai_title || null,
        metadata?.keywords || null
      )
      
      if (description && typeof description === 'string' && description.length > 0) {
        return description
      }
      
      // Fallback to combining existing metadata
      let fallbackContent = 'Screenshot'
      if (metadata?.ai_description) {
        fallbackContent = metadata.ai_description
      }
      if (metadata?.ocr_text) {
        fallbackContent += `\n\nText Content: ${metadata.ocr_text}`
      }
      if (metadata?.ai_title) {
        fallbackContent += `\n\nTitle: ${metadata.ai_title}`
      }
      if (metadata?.keywords) {
        fallbackContent += `\n\nKeywords: ${metadata.keywords.join(', ')}`
      }
      
      return fallbackContent
    } catch (error) {
      log.error('Failed to generate comprehensive description with BAML:', error)
      
      // Fallback to metadata if available
      let fallbackContent = 'Screenshot'
      if (metadata?.ocr_text) {
        fallbackContent += `\n${metadata.ocr_text}`
      }
      if (metadata?.ai_title) {
        fallbackContent += `\nTitle: ${metadata.ai_title}`
      }
      if (metadata?.ai_description) {
        fallbackContent += `\n${metadata.ai_description}`
      }
      
      return fallbackContent
    }
  }

  private async createEmbedding(text: string): Promise<number[]> {
    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key not configured')
      }
      
      if (!text || text.trim().length === 0) {
        throw new Error('Empty text provided for embedding')
      }
      
      const limitedText = text.substring(0, 8000) // Limit to token constraints
      log.info(`🔗 Creating embedding for text (${limitedText.length} chars)`)
      
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-ada-002', // Using ada for embeddings
          input: limitedText
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        log.error(`OpenAI API error: ${response.status} ${response.statusText}`)
        log.error(`Error response: ${errorText}`)
        throw new Error(`OpenAI Embedding API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        throw new Error('Invalid embedding response from OpenAI API')
      }
      
      const embedding = data.data[0].embedding
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error('Invalid embedding array from OpenAI API')
      }
      
      log.info(`✅ Embedding created successfully - dimensions: ${embedding.length}`)
      return embedding
    } catch (error) {
      log.error('❌ Failed to create embedding:', error)
      log.error('   Error details:', error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  async searchByText(query: string, k: number = 10): Promise<SearchResult[]> {
    if (this.items.size === 0) {
      return []
    }

    try {
      log.info(`Searching for text query: ${query}`)
      
      // Create embedding for the search query
      const queryEmbedding = await this.createEmbedding(query)
      
      // Calculate cosine similarity with all items
      const results: SearchResult[] = []
      
      for (const [id, item] of this.items) {
        if (!item.embedding) continue
        
        const similarity = this.cosineSimilarity(queryEmbedding, item.embedding)
        results.push({
          id,
          score: similarity,
          item
        })
      }
      
      // Sort by similarity and return top k
      results.sort((a, b) => b.score - a.score)
      return results.slice(0, k)
    } catch (error) {
      log.error('Failed to search by text:', error)
      return []
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length')
    }
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  async save(): Promise<void> {
    try {
      const metadata = {
        items: Object.fromEntries(this.items),
        lastUpdated: Date.now()
      }
      
      log.info(`💾 Saving ${this.items.size} embeddings to: ${this.metadataPath}`)
      
      // Ensure directory exists
      const dir = path.dirname(this.metadataPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
        log.info(`📁 Created embeddings directory: ${dir}`)
      }
      
      // Write with backup
      const tempPath = this.metadataPath + '.tmp'
      fs.writeFileSync(tempPath, JSON.stringify(metadata, null, 2))
      
      // Atomic rename
      fs.renameSync(tempPath, this.metadataPath)
      
      log.info(`✅ Saved ${this.items.size} OpenAI embeddings to disk`)
    } catch (error) {
      log.error('❌ Failed to save embeddings:', error)
      log.error('   Error details:', error instanceof Error ? error.message : String(error))
      throw error // Re-throw to make the error visible
    }
  }

  removeItem(id: string): void {
    this.items.delete(id)
  }

  async purgeStaleEmbeddings(): Promise<void> {
    try {
      log.info('🧹 Starting purge of stale embeddings...')
      const initialCount = this.items.size
      let removedCount = 0
      
      // Check each embedding to see if the file still exists
      for (const [id, item] of this.items.entries()) {
        try {
          if (item.path && !fs.existsSync(item.path)) {
            log.info(`🗑️ Removing stale embedding for deleted file: ${item.path}`)
            this.items.delete(id)
            removedCount++
          }
        } catch (error) {
          log.warn(`⚠️ Error checking file ${item.path}, removing embedding:`, error)
          this.items.delete(id)
          removedCount++
        }
      }
      
      if (removedCount > 0) {
        await this.save()
        log.info(`🧹 Purged ${removedCount} stale embeddings (${initialCount} → ${this.items.size})`)
      } else {
        log.info('🧹 No stale embeddings found')
      }
    } catch (error) {
      log.error('❌ Failed to purge stale embeddings:', error)
    }
  }

  async cleanup(): Promise<void> {
    await this.save()
    this.items.clear()
  }

  getItemCount(): number {
    return this.items.size
  }
}