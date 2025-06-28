import { b } from '../../../baml_client/async_client.js'
import { Image } from '@boundaryml/baml'
import log from 'electron-log'
import { Screenshot } from '../database/DatabaseManager'

export interface AIAnalysisResult {
  ocr_text?: string
  ai_title?: string
  ai_description?: string
  ai_keywords?: string[]
  confidence_score?: number
  content_type?: string
  app_detected?: string
  url_detected?: string
  comprehensive_description?: string // For embeddings and advanced search
}


export class AIProcessor {
  private processingQueue: Map<string, Promise<AIAnalysisResult>> = new Map()

  async processScreenshot(screenshotId: string, imagePath: string): Promise<AIAnalysisResult> {
    // Check if already processing this screenshot
    if (this.processingQueue.has(screenshotId)) {
      return await this.processingQueue.get(screenshotId)!
    }

    const processingPromise = this.doProcessScreenshot(imagePath)
    this.processingQueue.set(screenshotId, processingPromise)

    try {
      const result = await processingPromise
      return result
    } finally {
      this.processingQueue.delete(screenshotId)
    }
  }

  private async doProcessScreenshot(imagePath: string): Promise<AIAnalysisResult> {
    try {
      log.info(`🚀 Starting AI processing pipeline for: ${imagePath}`)
      
      // Read image file as base64 for BAML
      const fs = require('fs')
      const imageBuffer = fs.readFileSync(imagePath)
      const base64Image = imageBuffer.toString('base64')
      
      log.info('📷 Image loaded, size:', imageBuffer.length, 'bytes, base64 length:', base64Image.length)
      
      // BAML expects image data as an object with base64 property
      const image = Image.fromBase64('image/png', base64Image)

      // Perform OCR
      const ocrResult = await this.extractText(image)
      
      // Analyze content if OCR was successful
      let analysisResult: AIAnalysisResult = {
        ocr_text: ocrResult.text,
        confidence_score: ocrResult.confidence
      }

      log.info('🔄 OCR completed, text length:', ocrResult.text?.length || 0, 'confidence:', ocrResult.confidence)

      if (ocrResult.text && ocrResult.text.trim().length > 0) {
        log.info('✅ OCR successful, proceeding with full AI analysis...')
        
        // Generate title and description
        const titleResult = await this.generateTitle(image, ocrResult.text)
        const descriptionResult = await this.generateDescription(image, ocrResult.text)
        const keywordsResult = await this.extractKeywords(ocrResult.text)
        
        log.info('🔍 Calling AnalyzeScreenshotContent...')
        const contentAnalysis = await b.AnalyzeScreenshotContent(image)
        log.info('📊 Content analysis result:', contentAnalysis)
        
        // Generate comprehensive description for advanced search
        const comprehensiveDescription = await this.generateComprehensiveDescription(image, ocrResult.text, titleResult, keywordsResult)

        analysisResult = {
          ...analysisResult,
          ai_title: titleResult,
          ai_description: descriptionResult,
          ai_keywords: keywordsResult,
          content_type: contentAnalysis.content_type,
          app_detected: contentAnalysis.app_detected || undefined,
          url_detected: contentAnalysis.url_detected || undefined,
          comprehensive_description: comprehensiveDescription
        }
        
        log.info('✅ Full AI analysis completed:')
        log.info('🏷️ Title:', analysisResult.ai_title)
        log.info('📝 Description length:', analysisResult.ai_description?.length || 0)
        log.info('🔑 Keywords count:', analysisResult.ai_keywords?.length || 0)
        log.info('📚 Comprehensive description length:', analysisResult.comprehensive_description?.length || 0)
        log.info('🏗️ Content type:', analysisResult.content_type)
      } else {
        log.warn('⚠️ No text extracted from OCR, skipping detailed analysis')
      }

      log.info(`🎉 AI processing completed successfully for: ${imagePath}`)
      return analysisResult

    } catch (error) {
      log.error('❌ AI processing pipeline failed:', error)
      throw error
    }
  }

  private async extractText(image: Image): Promise<{ text: string; confidence: number }> {
    try {
      log.info('🔍 Starting OCR extraction with BAML ExtractAllText...')
      
      // Use proper BAML OCR function for screenshots
      const result: any = await b.ExtractAllText(image)
      
      log.info('📝 OCR result received:', typeof result, result)
      
      // Handle OCRResult format
      if (result && typeof result === 'object' && 'text' in result) {
        log.info('✅ OCR successful - extracted text length:', result.text?.length || 0)
        return { 
          text: result.text || '', 
          confidence: result.confidence || 0.8 
        }
      }
      
      // Handle string response
      if (typeof result === 'string') {
        log.info('✅ OCR successful - string result length:', result.length)
        return { text: result, confidence: 0.8 }
      }
      
      log.warn('⚠️ OCR returned unexpected format:', result)
      return { text: '', confidence: 0 }
    } catch (error) {
      log.error('❌ OCR extraction failed:', error)
      return { text: '', confidence: 0 }
    }
  }

  private async generateTitle(image: Image, ocrText: string): Promise<string> {
    try {
      log.info('🏷️ Starting AI title generation with OCR text length:', ocrText.length)
      
      // Use BAML to generate a comprehensive title based on the full image
      const titleResult = await b.GenerateScreenshotTitle(image, ocrText)
      
      log.info('🏷️ AI title result:', titleResult)
      
      if (titleResult && typeof titleResult === 'string' && titleResult.length > 0) {
        const finalTitle = titleResult.substring(0, 50) // Limit length
        log.info('✅ AI title generated successfully:', finalTitle)
        return finalTitle
      }
      
      log.warn('⚠️ AI title generation failed, using heuristic fallback')
      return this.generateTitleHeuristic(ocrText)
    } catch (error) {
      log.error('❌ Title generation failed:', error)
      return this.generateTitleHeuristic(ocrText)
    }
  }

  private generateTitleHeuristic(ocrText: string): string {
    if (!ocrText || ocrText.trim().length === 0) {
      return `Screenshot ${new Date().toLocaleDateString()}`
    }

    // Clean and get first meaningful line
    const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    if (lines.length === 0) {
      return `Screenshot ${new Date().toLocaleDateString()}`
    }

    // Look for titles, headings, or main content
    for (const line of lines) {
      // Skip very short lines or lines with only symbols
      if (line.length < 3 || /^[^\w\s]*$/.test(line)) continue
      
      // Prefer lines that look like titles (all caps, or sentence case)
      if (line.length <= 50) {
        return this.cleanTitle(line)
      }
    }

    // Fallback to first substantial line, truncated
    const firstLine = lines[0]
    return this.cleanTitle(firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine)
  }

  private cleanTitle(title: string): string {
    return title
      .replace(/[^\w\s\-.,!?]/g, '') // Remove special chars except basic punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
  }

  private async generateDescription(image: Image, ocrText: string): Promise<string> {
    try {
      // Use BAML to generate a comprehensive description of the entire image
      const descriptionResult = await b.AnalyzeScreenshotContentDetailed(image, ocrText)
      
      if (descriptionResult && typeof descriptionResult === 'string' && descriptionResult.length > 0) {
        return descriptionResult
      }
      
      // Fallback to heuristic analysis
      const analysis = this.analyzeContentHeuristic(ocrText)
      
      let description = `${analysis.type} screenshot`
      
      if (analysis.app) {
        description += ` from ${analysis.app}`
      }
      
      if (analysis.domain) {
        description += ` (${analysis.domain})`
      }
      
      if (ocrText.length > 100) {
        description += ` containing ${ocrText.split(/\s+/).length} words`
      }
      
      return description
    } catch (error) {
      log.error('Description generation failed:', error)
      return 'Screenshot'
    }
  }

  private async extractKeywords(ocrText: string): Promise<string[]> {
    if (!ocrText || ocrText.trim().length === 0) {
      return []
    }

    try {
      // Simple keyword extraction using TF-IDF-like approach
      const words = ocrText
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3)
        .filter(word => !this.isStopWord(word))

      // Count frequency
      const wordCount = new Map<string, number>()
      words.forEach(word => {
        wordCount.set(word, (wordCount.get(word) || 0) + 1)
      })

      // Sort by frequency and return top keywords
      return Array.from(wordCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word]) => word)
    } catch (error) {
      log.error('Keyword extraction failed:', error)
      return []
    }
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'can', 'from', 'up', 'about', 'into', 'through', 'during'
    ])
    return stopWords.has(word)
  }


  private analyzeContentHeuristic(ocrText: string): {
    type: string
    isCode: boolean
    isText: boolean
    isUI: boolean
    isWebpage: boolean
    isDiagram: boolean
    isChart: boolean
    language?: string
    framework?: string
    domain?: string
    app?: string
  } {
    const text = ocrText.toLowerCase()
    
    // Code detection
    const codePatterns = [
      /function\s*\(/,
      /class\s+\w+/,
      /import\s+\{/,
      /export\s+/,
      /console\.log/,
      /return\s+/,
      /\{\s*\n/,
      /\}\s*;/,
      /\/\*[\s\S]*?\*\//,
      /\/\/.*$/m
    ]
    const isCode = codePatterns.some(pattern => pattern.test(text))
    
    // Web content detection
    const webPatterns = [
      /https?:\/\//,
      /@\w+\.(com|org|net)/,
      /www\./,
      /\.html?/,
      /\.css/,
      /\.js/
    ]
    const isWebpage = webPatterns.some(pattern => pattern.test(text))
    
    // UI detection
    const uiPatterns = [
      /button/,
      /click/,
      /menu/,
      /dialog/,
      /window/,
      /tab/,
      /toolbar/,
      /sidebar/
    ]
    const isUI = uiPatterns.some(pattern => pattern.test(text))
    
    // Chart/diagram detection
    const chartPatterns = [
      /chart/,
      /graph/,
      /diagram/,
      /axis/,
      /legend/,
      /plot/,
      /data/
    ]
    const isChart = chartPatterns.some(pattern => pattern.test(text))
    
    const isDiagram = /diagram|flowchart|workflow|process/.test(text)
    const isText = !isCode && !isChart && !isDiagram
    
    // Determine main type
    let type = 'content'
    if (isCode) type = 'code'
    else if (isWebpage) type = 'webpage'
    else if (isChart) type = 'chart'
    else if (isDiagram) type = 'diagram'
    else if (isUI) type = 'interface'
    else if (isText) type = 'document'
    
    // Detect language for code
    let language: string | undefined
    if (isCode) {
      if (/typescript|tsx/.test(text)) language = 'typescript'
      else if (/javascript|jsx/.test(text)) language = 'javascript'
      else if (/python|def |import /.test(text)) language = 'python'
      else if (/java|public class/.test(text)) language = 'java'
      else if (/swift|func |var |let /.test(text)) language = 'swift'
    }
    
    // Detect app context
    let app: string | undefined
    if (/vscode|visual studio code/.test(text)) app = 'VS Code'
    else if (/xcode/.test(text)) app = 'Xcode'
    else if (/terminal|bash|zsh/.test(text)) app = 'Terminal'
    else if (/chrome|safari|firefox/.test(text)) app = 'Browser'
    
    return {
      type,
      isCode,
      isText,
      isUI,
      isWebpage,
      isDiagram,
      isChart,
      language,
      app
    }
  }

  private async generateComprehensiveDescription(image: Image, ocrText: string, title?: string, keywords?: string[]): Promise<string> {
    try {
      log.info('🔍 Starting comprehensive description generation for semantic search...')
      log.info('📊 Input data - OCR length:', ocrText?.length || 0, 'Title:', title, 'Keywords count:', keywords?.length || 0)
      
      // Use BAML with OpenAI to generate comprehensive description for search
      const comprehensiveResult = await b.GenerateComprehensiveDescription(
        image,
        ocrText,
        title || null,
        keywords || null
      )
      
      log.info('📚 Comprehensive description result type:', typeof comprehensiveResult)
      log.info('📚 Comprehensive description length:', (comprehensiveResult as any)?.length || 0)
      log.info('📚 Raw result:', JSON.stringify(comprehensiveResult).substring(0, 500))
      
      if (comprehensiveResult && typeof comprehensiveResult === 'string' && comprehensiveResult.length > 0) {
        log.info('✅ Comprehensive description generated successfully! Length:', comprehensiveResult.length)
        log.info('📝 First 200 chars:', comprehensiveResult.substring(0, 200) + '...')
        return comprehensiveResult
      }
      
      log.error('❌ AI comprehensive description failed - result was empty or invalid')
      log.error('   Result type:', typeof comprehensiveResult)
      log.error('   Result value:', comprehensiveResult)
      
      // Fallback to combining existing analysis
      let fallback = title || 'Screenshot'
      if (ocrText) {
        fallback += `\n\nText content: ${ocrText}`
      }
      if (keywords && keywords.length > 0) {
        fallback += `\n\nKeywords: ${keywords.join(', ')}`
      }
      
      log.info('🔄 Using fallback comprehensive description:', fallback.length, 'chars')
      return fallback
    } catch (error) {
      log.error('❌ Failed to generate comprehensive description:', error)
      log.error('   Error details:', error instanceof Error ? error.message : String(error))
      log.error('   Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      
      // Basic fallback
      let fallback = title || 'Screenshot'
      if (ocrText) {
        fallback += `\n${ocrText}`
      }
      log.error('🔄 Using basic fallback description due to error:', fallback.length, 'chars')
      return fallback
    }
  }

  async batchProcess(screenshots: Screenshot[]): Promise<Map<string, AIAnalysisResult>> {
    const results = new Map<string, AIAnalysisResult>()
    const batchSize = 3 // Process 3 at a time to avoid overwhelming the system
    
    for (let i = 0; i < screenshots.length; i += batchSize) {
      const batch = screenshots.slice(i, i + batchSize)
      const promises = batch.map(async (screenshot) => {
        try {
          const result = await this.processScreenshot(screenshot.id, screenshot.filepath)
          results.set(screenshot.id, result)
        } catch (error) {
          log.error(`Failed to process screenshot ${screenshot.id}:`, error)
        }
      })
      
      await Promise.allSettled(promises)
      
      // Small delay between batches
      if (i + batchSize < screenshots.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    return results
  }
}

export const aiProcessor = new AIProcessor()