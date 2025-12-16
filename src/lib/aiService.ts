import { supabase } from './supabase'

export interface QuestionOption {
  option_text: string
  is_correct: boolean
}

export interface GeneratedQuestion {
  question_text: string
  options: QuestionOption[]
}

export interface GenerationConfig {
  numberOfQuestions: number
  userId: string
}

export interface GenerationMetadata {
  questionsGenerated: number
  questionsRequested: number
  tokensUsed: number
  generationTimeMs: number
  contentWasTruncated?: boolean
}

export interface GenerateQuestionsResponse {
  success: boolean
  questions: GeneratedQuestion[]
  metadata: GenerationMetadata
  error?: string
  details?: string
}

export interface AIGenerationLog {
  user_id: string
  evaluation_id?: string | null
  content_source: 'manual_text' | 'file_upload'
  file_type?: string | null
  content_length: number
  questions_requested: number
  questions_generated: number
  tokens_used?: number | null
  generation_time_ms: number
  success: boolean
  error_message?: string | null
}

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

export async function generateQuestionsFromText(
  content: string,
  config: GenerationConfig,
  source: 'manual_text' | 'file_upload' = 'manual_text',
  fileType?: string
): Promise<GenerateQuestionsResponse> {
  if (!content || content.trim().length === 0) {
    return {
      success: false,
      questions: [],
      metadata: {
        questionsGenerated: 0,
        questionsRequested: config.numberOfQuestions,
        tokensUsed: 0,
        generationTimeMs: 0,
      },
      error: 'El contenido no puede estar vacío',
    }
  }

  if (config.numberOfQuestions < 5 || config.numberOfQuestions > 50) {
    return {
      success: false,
      questions: [],
      metadata: {
        questionsGenerated: 0,
        questionsRequested: config.numberOfQuestions,
        tokensUsed: 0,
        generationTimeMs: 0,
      },
      error: 'El número de preguntas debe estar entre 5 y 50',
    }
  }

  let lastError: any = null
  let attempt = 0

  while (attempt <= MAX_RETRIES) {
    try {
      const startTime = Date.now()

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-questions`

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.trim(),
          numberOfQuestions: config.numberOfQuestions,
          userId: config.userId,
        }),
      })

      const totalTime = Date.now() - startTime

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data: GenerateQuestionsResponse = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error desconocido al generar preguntas')
      }

      if (!validateGeneratedQuestions(data.questions)) {
        throw new Error('Las preguntas generadas no cumplen con el formato requerido')
      }

      await logAIGeneration({
        user_id: config.userId,
        content_source: source,
        file_type: fileType || null,
        content_length: content.length,
        questions_requested: config.numberOfQuestions,
        questions_generated: data.questions.length,
        tokens_used: data.metadata.tokensUsed,
        generation_time_ms: data.metadata.generationTimeMs || totalTime,
        success: true,
      })

      return {
        ...data,
        metadata: {
          ...data.metadata,
          generationTimeMs: data.metadata.generationTimeMs || totalTime,
        },
      }
    } catch (error: any) {
      lastError = error
      attempt++

      if (attempt <= MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt))
      }
    }
  }

  await logAIGeneration({
    user_id: config.userId,
    content_source: source,
    file_type: fileType || null,
    content_length: content.length,
    questions_requested: config.numberOfQuestions,
    questions_generated: 0,
    generation_time_ms: 0,
    success: false,
    error_message: lastError?.message || 'Error desconocido',
  })

  return {
    success: false,
    questions: [],
    metadata: {
      questionsGenerated: 0,
      questionsRequested: config.numberOfQuestions,
      tokensUsed: 0,
      generationTimeMs: 0,
    },
    error: 'Error al generar preguntas',
    details: lastError?.message || 'Error desconocido',
  }
}

export function validateGeneratedQuestions(questions: any[]): boolean {
  if (!Array.isArray(questions) || questions.length === 0) {
    return false
  }

  return questions.every(question => {
    if (!question.question_text || typeof question.question_text !== 'string') {
      return false
    }

    if (!Array.isArray(question.options) || question.options.length !== 4) {
      return false
    }

    const correctOptions = question.options.filter((opt: any) => opt.is_correct === true)
    if (correctOptions.length !== 1) {
      return false
    }

    return question.options.every((opt: any) => {
      return (
        typeof opt.option_text === 'string' &&
        opt.option_text.trim().length > 0 &&
        typeof opt.is_correct === 'boolean'
      )
    })
  })
}

async function logAIGeneration(log: AIGenerationLog): Promise<void> {
  try {
    const { error } = await supabase.from('ai_generation_logs').insert(log)

    if (error) {
      console.error('Error logging AI generation:', error)
    }
  } catch (error) {
    console.error('Error logging AI generation:', error)
  }
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}

export function estimateCost(tokenCount: number, model: string = 'gpt-4o-mini'): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o-mini': { input: 0.00015 / 1000, output: 0.0006 / 1000 },
  }

  const modelPricing = pricing[model] || pricing['gpt-4o-mini']
  const estimatedOutputTokens = tokenCount * 0.5

  return (tokenCount * modelPricing.input) + (estimatedOutputTokens * modelPricing.output)
}
