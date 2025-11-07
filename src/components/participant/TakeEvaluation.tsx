import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Clock, CheckCircle, X, AlertCircle, BookOpen } from 'lucide-react'
import toast from 'react-hot-toast'

interface Question {
  id: string
  question_text: string
  options: {
    id: string
    option_text: string
    is_correct: boolean
    order_index: number
  }[]
}

interface Evaluation {
  id: string
  title: string
  description: string | null
  passing_score: number
  max_attempts: number
  questions: Question[]
}

interface EvaluationAttempt {
  id: string
  attempt_number: number
  score: number
  passed: boolean
  completed_at: string | null
  answers: any[]
}

interface TakeEvaluationProps {
  courseId: string
  onComplete: () => void
  onBack: () => void
}

export default function TakeEvaluation({ courseId, onComplete, onBack }: TakeEvaluationProps) {
  const { user } = useAuth()
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [attempts, setAttempts] = useState<EvaluationAttempt[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentAnswers, setCurrentAnswers] = useState<{ [key: string]: string }>({})
  const [showResults, setShowResults] = useState(false)
  const [lastAttempt, setLastAttempt] = useState<EvaluationAttempt | null>(null)
  const [hasPassedEvaluation, setHasPassedEvaluation] = useState(false)

  useEffect(() => {
    if (user && courseId) {
      loadEvaluationData()
    }
  }, [user, courseId])

  const loadEvaluationData = async () => {
    try {
      // Get evaluation for this course
      const { data: evaluationData, error: evaluationError } = await supabase
        .from('evaluations')
        .select(`
          *,
          questions (
            *,
            options:question_options (*)
          )
        `)
        .eq('course_id', courseId)
        .eq('is_active', true)
        .single()

      if (evaluationError) {
        if (evaluationError.code === 'PGRST116') {
          // No evaluation found
          toast.error('No hay evaluación disponible para este curso')
          onBack()
          return
        }
        throw evaluationError
      }

      // Sort questions and options
      const sortedQuestions = evaluationData.questions
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((question: any) => ({
          ...question,
          options: question.options.sort((a: any, b: any) => a.order_index - b.order_index)
        }))

      setEvaluation({
        ...evaluationData,
        questions: sortedQuestions
      })

      // Get user attempts
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('evaluation_attempts')
        .select('*')
        .eq('user_id', user?.id)
        .eq('evaluation_id', evaluationData.id)
        .order('attempt_number', { ascending: false })

      if (attemptsError) throw attemptsError

      setAttempts(attemptsData || [])

      // Check if user has already passed
      const passedAttempt = attemptsData?.find(attempt => attempt.passed)
      if (passedAttempt) {
        setHasPassedEvaluation(true)
        setLastAttempt(passedAttempt)
        setShowResults(true)
      } else if (attemptsData && attemptsData.length > 0) {
        // Show last attempt results if not passed
        setLastAttempt(attemptsData[0])
        if (attemptsData[0].completed_at) {
          setShowResults(true)
        }
      }

    } catch (error) {
      console.error('Error loading evaluation:', error)
      toast.error('Error al cargar la evaluación')
      onBack()
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnswerChange = (questionId: string, optionId: string) => {
    setCurrentAnswers(prev => ({
      ...prev,
      [questionId]: optionId
    }))
  }

  const handleSubmitEvaluation = async () => {
    if (!evaluation || !user) return

    // Check if all questions are answered
    const unansweredQuestions = evaluation.questions.filter(
      question => !currentAnswers[question.id]
    )

    if (unansweredQuestions.length > 0) {
      toast.error(`Por favor responde todas las preguntas. Faltan ${unansweredQuestions.length} preguntas.`)
      return
    }

    setIsSubmitting(true)

    try {
      // Calculate score
      let correctAnswers = 0
      const answers = evaluation.questions.map(question => {
        const selectedOptionId = currentAnswers[question.id]
        const selectedOption = question.options.find(opt => opt.id === selectedOptionId)
        const isCorrect = selectedOption?.is_correct || false
        
        if (isCorrect) correctAnswers++

        return {
          question_id: question.id,
          selected_option_id: selectedOptionId,
          is_correct: isCorrect
        }
      })

      const score = Math.round((correctAnswers / evaluation.questions.length) * 100)
      const passed = score >= evaluation.passing_score
      const attemptNumber = attempts.length + 1

      // Save attempt
      const { data: newAttempt, error: attemptError } = await supabase
        .from('evaluation_attempts')
        .insert([
          {
            user_id: user.id,
            evaluation_id: evaluation.id,
            attempt_number: attemptNumber,
            score,
            total_questions: evaluation.questions.length,
            correct_answers: correctAnswers,
            passed,
            completed_at: new Date().toISOString(),
            answers
          }
        ])
        .select()
        .single()

      if (attemptError) throw attemptError

      setLastAttempt(newAttempt)
      setShowResults(true)
      
      if (passed) {
        setHasPassedEvaluation(true)
        toast.success('¡Felicitaciones! Has aprobado la evaluación')
        setTimeout(() => {
          onComplete()
        }, 2000)
      } else {
        const remainingAttempts = evaluation.max_attempts - attemptNumber
        if (remainingAttempts > 0) {
          toast.error(`No aprobaste esta vez. Tienes ${remainingAttempts} intento${remainingAttempts !== 1 ? 's' : ''} más.`)
        } else {
          toast.error('Has agotado todos los intentos. Contacta al administrador.')
        }
      }

      // Reload attempts
      await loadEvaluationData()

    } catch (error) {
      console.error('Error submitting evaluation:', error)
      toast.error('Error al enviar la evaluación')
    } finally {
      setIsSubmitting(false)
    }
  }

  const startNewAttempt = () => {
    setCurrentAnswers({})
    setShowResults(false)
    setLastAttempt(null)
  }

  const canTakeEvaluation = () => {
    if (hasPassedEvaluation) return false
    if (!evaluation) return false
    return attempts.length < evaluation.max_attempts
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    )
  }

  if (!evaluation) {
    return (
      <div className="text-center py-12">
        <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
        <h3 className="mt-2 text-lg font-medium text-slate-900">Evaluación no encontrada</h3>
        <p className="mt-1 text-sm text-slate-500">No se pudo cargar la evaluación para este curso.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg"
        >
          Regresar
        </button>
      </div>
    )
  }

  // Show results screen
  if (showResults && lastAttempt) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className={`text-center mb-6 p-4 rounded-lg ${
            hasPassedEvaluation 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            {hasPassedEvaluation ? (
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            ) : (
              <X className="w-16 h-16 text-red-600 mx-auto mb-4" />
            )}
            <h2 className={`text-2xl font-bold mb-2 ${
              hasPassedEvaluation ? 'text-green-800' : 'text-red-800'
            }`}>
              {hasPassedEvaluation ? '¡Felicitaciones!' : 'No aprobaste'}
            </h2>
            <p className={`text-lg mb-4 ${
              hasPassedEvaluation ? 'text-green-700' : 'text-red-700'
            }`}>
              Obtuviste {lastAttempt.score}% (necesitas {evaluation.passing_score}% para aprobar)
            </p>
            <div className="text-sm text-slate-600">
              <p>Respuestas correctas: {lastAttempt.correct_answers} de {lastAttempt.total_questions}</p>
              <p>Intento: {lastAttempt.attempt_number} de {evaluation.max_attempts}</p>
            </div>
          </div>

          {/* Show question results */}
          <div className="space-y-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-800">Resultados por pregunta:</h3>
            {evaluation.questions.map((question, index) => {
              const userAnswer = lastAttempt.answers?.find((answer: any) => answer.question_id === question.id)
              const selectedOption = question.options.find(opt => opt.id === userAnswer?.selected_option_id)
              const correctOption = question.options.find(opt => opt.is_correct)
              
              return (
                <div key={question.id} className="border rounded-lg p-4">
                  <h4 className="font-semibold text-slate-800 mb-3">
                    {index + 1}. {question.question_text}
                  </h4>
                  
                  <div className="space-y-2">
                    {question.options.map((option, optIndex) => {
                      let className = "p-3 rounded-lg border "
                      let icon = null
                      
                      if (hasPassedEvaluation) {
                        // Show all answers with correct ones highlighted
                        if (option.is_correct) {
                          className += "bg-green-50 border-green-200"
                          icon = <CheckCircle className="w-4 h-4 text-green-600" />
                        } else if (option.id === selectedOption?.id) {
                          className += "bg-blue-50 border-blue-200"
                        } else {
                          className += "bg-slate-50 border-slate-200"
                        }
                      } else {
                        // Only show if answer was correct or the one selected
                        if (option.id === selectedOption?.id) {
                          if (userAnswer?.is_correct) {
                            className += "bg-green-50 border-green-200"
                            icon = <CheckCircle className="w-4 h-4 text-green-600" />
                          } else {
                            className += "bg-red-50 border-red-200"
                            icon = <X className="w-4 h-4 text-red-600" />
                          }
                        } else {
                          className += "bg-slate-50 border-slate-200"
                        }
                      }
                      
                      return (
                        <div key={option.id} className={className}>
                          <div className="flex items-center">
                            <span className="text-sm font-medium mr-3">
                              {String.fromCharCode(65 + optIndex)}.
                            </span>
                            <span className="flex-1 text-sm">{option.option_text}</span>
                            {icon && <span className="ml-2">{icon}</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {hasPassedEvaluation ? (
              <button
                onClick={onComplete}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
              >
                Continuar al Certificado
              </button>
            ) : canTakeEvaluation() ? (
              <button
                onClick={startNewAttempt}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Intentar Nuevamente ({evaluation.max_attempts - attempts.length} restantes)
              </button>
            ) : null}
            
            <button
              onClick={onBack}
              className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
            >
              Volver al Curso
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show evaluation form
  if (!canTakeEvaluation()) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">
          {hasPassedEvaluation ? 'Ya aprobaste esta evaluación' : 'Sin intentos disponibles'}
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          {hasPassedEvaluation 
            ? 'Has completado exitosamente esta evaluación.' 
            : `Has usado todos los ${evaluation.max_attempts} intentos disponibles.`
          }
        </p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg"
        >
          Volver al Curso
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">{evaluation.title}</h1>
        {evaluation.description && (
          <p className="text-slate-600 mb-4">{evaluation.description}</p>
        )}
        
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center text-slate-600">
            <CheckCircle className="w-4 h-4 mr-1" />
            {evaluation.passing_score}% para aprobar
          </div>
          <div className="flex items-center text-slate-600">
            <Clock className="w-4 h-4 mr-1" />
            Sin límite de tiempo
          </div>
          <div className="flex items-center text-slate-600">
            Intento {attempts.length + 1} de {evaluation.max_attempts}
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {evaluation.questions.map((question, index) => (
          <div key={question.id} className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              {index + 1}. {question.question_text}
            </h3>
            
            <div className="space-y-3">
              {question.options.map((option, optIndex) => (
                <label 
                  key={option.id}
                  className="flex items-center p-3 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={option.id}
                    checked={currentAnswers[question.id] === option.id}
                    onChange={() => handleAnswerChange(question.id, option.id)}
                    className="h-4 w-4 text-slate-600 focus:ring-slate-500 border-gray-300"
                  />
                  <span className="ml-3 flex-1">
                    <span className="font-medium mr-2">
                      {String.fromCharCode(65 + optIndex)}.
                    </span>
                    {option.option_text}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Submit Section */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mt-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="text-sm text-slate-600">
            Preguntas respondidas: {Object.keys(currentAnswers).length} de {evaluation.questions.length}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmitEvaluation}
              disabled={isSubmitting || Object.keys(currentAnswers).length !== evaluation.questions.length}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Enviando...
                </div>
              ) : (
                'Enviar Evaluación'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}