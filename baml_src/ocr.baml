generator typescript {
  output_type "typescript"
  output_dir "../"
  version "0.89.0"
}

class Quote {
  quote string
  author string
}

class OCRResult {
  text string
  confidence float
  language string?
}

class ContentAnalysis {
  title string
  description string
  keywords string[]
  content_type string // "code", "document", "interface", "webpage", "chart", "diagram"
  app_detected string?
  url_detected string?
  language string? // programming language if code
  main_topic string?
}

class ScreenshotInsight {
  ocr_text string
  ai_title string
  ai_description string
  keywords string[]
  content_category string
  app_context string?
  confidence_score float
}

client<llm> OpenRouter {
  provider openai-generic
  options {
    base_url "https://openrouter.ai/api/v1"
    model "qwen/qwen2.5-vl-3b-instruct:free"
    api_key env.OPENROUTER_API_KEY
  }
}

client<llm> OpenAI4o {
  provider openai
  options {
    model "gpt-4o"
    api_key env.OPENAI_API_KEY
  }
}

function ExtractTextFromImage(imageData: image) -> Quote {
  prompt #"
  Extract visible quote from attached image
  {{imageData}}

  Dont use quotes in your response
  {{ ctx.output_format }}
  "#
  client OpenAI4o
}

function ExtractAllText(imageData: image) -> OCRResult {
  prompt #"
  Extract ALL visible text from this screenshot image. Be thorough and capture:
  - All text content, including UI elements, menus, buttons, labels
  - Code snippets if present
  - URLs, file names, error messages
  - Any other readable text

  {{imageData}}

  Also estimate your confidence level (0.0 to 1.0) and detect the primary language if possible.
  {{ ctx.output_format }}
  "#
  client OpenAI4o
}

function AnalyzeScreenshotContent(imageData: image) -> ContentAnalysis {
  prompt #"
  Analyze this screenshot and determine:
  1. A concise, descriptive title (max 50 characters)
  2. A brief description of what this screenshot shows
  3. 5-10 relevant keywords
  4. Content type: code, document, interface, webpage, chart, or diagram
  5. If it's an app interface, try to identify the application
  6. If there are URLs visible, extract the main domain
  7. If it's code, identify the programming language
  8. The main topic or subject matter

  {{imageData}}

  Focus on being accurate and helpful for organizing and searching screenshots.
  {{ ctx.output_format }}
  "#
  client OpenAI4o
}

function GenerateScreenshotInsight(imageData: image) -> ScreenshotInsight {
  prompt #"
  Analyze this screenshot comprehensively and provide:
  1. Extract all visible text (OCR)
  2. Generate a smart, descriptive title for organization
  3. Write a helpful description
  4. Extract 5-10 searchable keywords
  5. Categorize the content type
  6. Identify the app/context if possible
  7. Rate your confidence in the analysis

  {{imageData}}

  This will be used for organizing and searching through many screenshots, so be thorough and accurate.
  {{ ctx.output_format }}
  "#
  client OpenAI4o
}

function SmartRenameScreenshot(imageData: image, currentName: string) -> string {
  prompt #"
  Based on this screenshot content, suggest a better filename than "{{currentName}}".
  
  {{imageData}}
  
  Requirements:
  - Keep it under 50 characters
  - Use descriptive words about the content
  - Make it searchable and organized
  - No special characters except hyphens and underscores
  - Be specific about what the screenshot shows
  
  Just return the suggested filename without extension.
  "#
  client OpenAI4o
}

function GenerateScreenshotTitle(imageData: image, ocrText: string) -> string {
  prompt #"
  Based on this screenshot and the extracted text, generate a concise, descriptive title (max 50 characters).
  
  Screenshot: {{imageData}}
  Extracted Text: {{ocrText}}
  
  Focus on the main subject, action, or purpose. Make it useful for organizing screenshots.
  Examples: "VS Code Python Project", "Gmail Inbox View", "System Preferences Network", "Chrome Dev Tools"
  
  Return only the title, no quotes or extra text.
  "#
  client OpenAI4o
}

function AnalyzeScreenshotContentDetailed(imageData: image, ocrText: string) -> string {
  prompt #"
  Analyze this screenshot comprehensively and provide a detailed description of EVERYTHING visible.
  
  Screenshot: {{imageData}}
  Extracted Text: {{ocrText}}
  
  Describe in detail:
  - All UI elements, menus, buttons, controls
  - Visual design, layout, colors, typography
  - Application or website being shown
  - Any code, data, charts, or technical content
  - Text content and context
  - Purpose and functionality visible
  - Any other relevant visual information
  
  Make this description comprehensive and searchable - someone should be able to find this screenshot based on any aspect you describe.
  
  Return a detailed paragraph description.
  "#
  client OpenAI4o 
}

function GenerateComprehensiveDescription(imageData: image, ocrText: string, aiTitle: string?, keywords: string[]?) -> string {
  prompt #"
  Analyze this screenshot comprehensively for semantic search purposes. Provide a detailed description that captures EVERYTHING visible and contextual.
  
  Screenshot: {{imageData}}
  OCR Text: {{ocrText}}
  {% if aiTitle %}AI Title: {{aiTitle}}{% endif %}
  {% if keywords %}Keywords: {% for keyword in keywords %}{{keyword}}{% if not loop.last %}, {% endif %}{% endfor %}{% endif %}
  
  Provide a comprehensive description including:
  - All visible UI elements, controls, menus, buttons, text fields
  - Visual design: colors, layout, typography, icons, images
  - Application context: what software/website this is from
  - Content analysis: code, documents, charts, diagrams, data
  - Text content: all readable text with context
  - Functional context: what the user is doing or can do
  - Technical details: programming languages, frameworks, tools visible
  - Any other searchable details that would help find this screenshot
  
  Make this description extremely detailed and searchable. Someone should be able to find this screenshot by searching for any visual element, text content, or context you describe.
  
  Return a comprehensive paragraph (200-500 words) that will be used for semantic search embeddings.
  "#
  client OpenAI4o
}

test TestExtractTextFromImage {
  functions [ExtractTextFromImage]
  args {
    imageData {
      file "./sun-tzu.jpg"
    }
  }
}
