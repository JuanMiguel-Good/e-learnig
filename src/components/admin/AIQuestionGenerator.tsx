import React, { useState } from 'react'
import { FileText, Upload, Loader2, Sparkles, CheckCircle, AlertCircle, FileType, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { extractTextFromFile, formatFileSize, getFileTypeLabel } from '../../lib/documentExtractor'
import { generateQuestionsFromText, GeneratedQuestion, estimateTokenCount, estimateCost } from '../../lib/aiService'

type GenerationMode = 'text' | 'file'

interface AIQuestionGeneratorProps {
  userId: string
  onQuestionsGenerated: (questions: GeneratedQuestion[]) => void
  onCancel: () => void
  initialMode?: GenerationMode
}

export default function AIQuestionGenerator({ userId, onQuestionsGenerated, onCancel, initialMode = 'text' }: AIQuestionGeneratorProps) {
  const [mode, setMode] = useState<GenerationMode>(initialMode)
  const [textContent, setTextContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [extractedText, setExtractedText] = useState('')
  const [numberOfQuestions, setNumberOfQuestions] = useState(10)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      await handleFileSelect(droppedFile)
    }
  }

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setExtractedText('')

    setIsExtracting(true)
    try {
      const text = await extractTextFromFile(selectedFile)
      setExtractedText(text)
      toast.success('Texto extraído correctamente')
    } catch (error: any) {
      toast.error(error.message || 'Error al extraer texto del archivo')
      setFile(null)
    } finally {
      setIsExtracting(false)
    }
  }

  const handleGenerate = async () => {
    const content = mode === 'text' ? textContent : extractedText

    if (!content || content.trim().length === 0) {
      toast.error('Por favor, proporciona contenido para generar preguntas')
      return
    }

    setIsGenerating(true)
    try {
      const result = await generateQuestionsFromText(
        content,
        { numberOfQuestions, userId },
        mode === 'file' ? 'file_upload' : 'manual_text',
        file?.type
      )

      if (!result.success || result.questions.length === 0) {
        toast.error(result.error || 'No se pudieron generar preguntas')
        return
      }

      if (result.metadata.contentWasTruncated) {
        toast('El contenido fue truncado por ser muy largo', { icon: '⚠️' })
      }

      setGeneratedQuestions(result.questions)
      setShowPreview(true)
      toast.success(`${result.questions.length} preguntas generadas exitosamente`)
    } catch (error: any) {
      toast.error(error.message || 'Error al generar preguntas')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleUseQuestions = () => {
    onQuestionsGenerated(generatedQuestions)
    setShowPreview(false)
  }

  const handleRegenerate = () => {
    setShowPreview(false)
    setGeneratedQuestions([])
    handleGenerate()
  }

  const content = mode === 'text' ? textContent : extractedText
  const tokenEstimate = content ? estimateTokenCount(content) : 0
  const costEstimate = tokenEstimate > 0 ? estimateCost(tokenEstimate) : 0

  if (showPreview) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Preguntas Generadas ({generatedQuestions.length})
          </h3>
          <button
            onClick={() => setShowPreview(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
          {generatedQuestions.map((question, qIndex) => (
            <div key={qIndex} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  {qIndex + 1}
                </span>
                <div className="flex-1 space-y-3">
                  <p className="font-medium text-gray-900">{question.question_text}</p>
                  <div className="space-y-2">
                    {question.options.map((option, oIndex) => (
                      <div
                        key={oIndex}
                        className={`flex items-start gap-2 p-2 rounded ${
                          option.is_correct
                            ? 'bg-green-100 border border-green-300'
                            : 'bg-white border border-gray-200'
                        }`}
                      >
                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-sm font-medium text-gray-700">
                          {String.fromCharCode(65 + oIndex)}
                        </span>
                        <p className="flex-1 text-sm text-gray-700">{option.option_text}</p>
                        {option.is_correct && (
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={handleUseQuestions}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 font-medium"
          >
            Usar estas preguntas
          </button>
          <button
            onClick={handleRegenerate}
            className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 font-medium"
          >
            Regenerar
          </button>
          <button
            onClick={onCancel}
            className="px-6 bg-white text-gray-700 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <p className="text-sm text-blue-800">
          La IA generará preguntas basadas en el contenido proporcionado. Revisa las preguntas antes de usarlas.
        </p>
      </div>

      {mode === 'text' ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Contenido del Curso
          </label>
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Pega aquí el contenido del curso sobre el cual deseas generar preguntas. Entre más detallado y estructurado sea el contenido, mejores serán las preguntas generadas."
            className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{textContent.length} caracteres</span>
            {textContent.length > 0 && (
              <span>~{tokenEstimate.toLocaleString()} tokens</span>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            {file ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3">
                  <FileType className="w-8 h-8 text-blue-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {getFileTypeLabel(file.type)} - {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                {isExtracting ? (
                  <div className="flex items-center justify-center gap-2 text-blue-600">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Extrayendo texto...</span>
                  </div>
                ) : extractedText ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-green-600">
                      <CheckCircle className="w-5 h-5" />
                      <span>Texto extraído correctamente</span>
                    </div>
                    <button
                      onClick={() => {
                        setFile(null)
                        setExtractedText('')
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 underline"
                    >
                      Seleccionar otro archivo
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                <div>
                  <p className="text-gray-700 font-medium">
                    Arrastra un archivo o haz clic para seleccionar
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Solo archivos PDF o TXT (máx. 10MB)
                  </p>
                </div>
                <input
                  type="file"
                  accept=".pdf,.txt"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0]
                    if (selectedFile) handleFileSelect(selectedFile)
                  }}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                >
                  Seleccionar archivo
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Número de Preguntas: {numberOfQuestions}
        </label>
        <input
          type="range"
          min="5"
          max="50"
          value={numberOfQuestions}
          onChange={(e) => setNumberOfQuestions(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>5 preguntas</span>
          <span>50 preguntas</span>
        </div>
      </div>

      {tokenEstimate > 0 && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Estimación</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Tokens estimados</p>
              <p className="font-medium text-gray-900">{tokenEstimate.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-500">Costo estimado</p>
              <p className="font-medium text-gray-900">${costEstimate.toFixed(4)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Tiempo estimado: ~30-60 segundos
          </p>
        </div>
      )}

      {content.length > 32000 && (
        <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium">Contenido muy largo</p>
            <p>El contenido será truncado a 32,000 caracteres para el procesamiento.</p>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={handleGenerate}
          disabled={!content || content.trim().length === 0 || isGenerating}
          className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generando preguntas...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generar {numberOfQuestions} Preguntas
            </>
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={isGenerating}
          className="px-6 bg-white text-gray-700 py-3 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
