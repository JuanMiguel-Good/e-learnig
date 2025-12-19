import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, CreditCard as Edit2, Trash2, BookOpen, Search, HelpCircle, CheckCircle, X, Eye, FileText, Upload, Sparkles, Edit, ChevronDown, ChevronRight, ExternalLink, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { useForm, useFieldArray } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import AIQuestionGenerator from './AIQuestionGenerator'
import { GeneratedQuestion } from '../../lib/aiService'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Course {
  id: string
  title: string
  requires_evaluation: boolean
}

interface QuestionOption {
  option_text: string
  is_correct: boolean
}

interface Question {
  question_text: string
  options: QuestionOption[]
  generated_by_ai?: boolean
}

interface EvaluationFormData {
  course_id: string
  title: string
  description: string
  passing_score: number
  max_attempts: number
  questions: Question[]
}

interface Evaluation {
  id: string
  course_id: string
  title: string
  description: string | null
  passing_score: number
  max_attempts: number
  is_active: boolean
  created_at: string
  course: {
    title: string
  }
  questions?: any[]
}

type CreationMode = 'manual' | 'ai-text' | 'ai-file'

export default function EvaluationsManagement() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEvaluation, setEditingEvaluation] = useState<Evaluation | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewingQuestions, setViewingQuestions] = useState<Evaluation | null>(null)
  const [creationMode, setCreationMode] = useState<CreationMode>('manual')
  const [showAIGenerator, setShowAIGenerator] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    control,
    watch
  } = useForm<EvaluationFormData>({
    defaultValues: {
      passing_score: 60,
      max_attempts: 3,
      questions: [
        {
          question_text: '',
          options: [
            { option_text: '', is_correct: true },
            { option_text: '', is_correct: false },
            { option_text: '', is_correct: false },
            { option_text: '', is_correct: false }
          ]
        }
      ]
    }
  })

  const { fields: questionFields, append: appendQuestion, remove: removeQuestion } = useFieldArray({
    control,
    name: 'questions'
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const createFor = params.get('createFor')
    const courseId = params.get('courseId')

    if (createFor) {
      setValue('course_id', createFor)
      setIsModalOpen(true)
      window.history.replaceState({}, '', window.location.pathname)
    } else if (courseId) {
      setSearchTerm(courseId)
    }
  }, [setValue])

  const loadData = async () => {
    try {
      // Load evaluations with course info
      const { data: evaluationsData, error: evaluationsError } = await supabase
        .from('evaluations')
        .select(`
          *,
          course:courses!inner(title)
        `)
        .order('created_at', { ascending: false })

      if (evaluationsError) throw evaluationsError

      // Load courses that require evaluation
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, title, requires_evaluation')
        .eq('requires_evaluation', true)
        .eq('is_active', true)
        .order('title')

      if (coursesError) throw coursesError

      setEvaluations(evaluationsData || [])
      setCourses(coursesData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateOrUpdate = async (data: EvaluationFormData) => {
    try {
      // Validation: Ensure at least 3 questions
      if (data.questions.length < 3) {
        toast.error('La evaluación debe tener al menos 3 preguntas')
        return
      }

      // Validation: Ensure all questions have at least one correct answer
      for (let i = 0; i < data.questions.length; i++) {
        const hasCorrectAnswer = data.questions[i].options.some(opt => opt.is_correct)
        if (!hasCorrectAnswer) {
          toast.error(`La pregunta ${i + 1} debe tener al menos una respuesta correcta`)
          return
        }
      }

      if (editingEvaluation) {
        // Update existing evaluation
        const { error: evalError } = await supabase
          .from('evaluations')
          .update({
            title: data.title,
            description: data.description,
            passing_score: data.passing_score,
            max_attempts: data.max_attempts,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingEvaluation.id)

        if (evalError) throw evalError

        // Delete existing questions and options
        const { error: deleteError } = await supabase
          .from('questions')
          .delete()
          .eq('evaluation_id', editingEvaluation.id)

        if (deleteError) throw deleteError

        // Create new questions and options
        await createQuestionsAndOptions(editingEvaluation.id, data.questions)

        toast.success('Evaluación actualizada correctamente')
      } else {
        // Create new evaluation
        const { data: newEvaluation, error: evalError } = await supabase
          .from('evaluations')
          .insert([
            {
              course_id: data.course_id,
              title: data.title,
              description: data.description,
              passing_score: data.passing_score,
              max_attempts: data.max_attempts
            }
          ])
          .select()
          .single()

        if (evalError) throw evalError

        // Create questions and options
        await createQuestionsAndOptions(newEvaluation.id, data.questions)

        toast.success('Evaluación creada correctamente')
      }

      await loadData()
      setIsModalOpen(false)
      setEditingEvaluation(null)
      reset()
    } catch (error: any) {
      console.error('Error saving evaluation:', error)
      toast.error(error.message || 'Error al guardar evaluación')
    }
  }

  const createQuestionsAndOptions = async (evaluationId: string, questions: Question[]) => {
    for (const [questionIndex, questionData] of questions.entries()) {
      // Create question
      const { data: newQuestion, error: questionError } = await supabase
        .from('questions')
        .insert([
          {
            evaluation_id: evaluationId,
            question_text: questionData.question_text,
            order_index: questionIndex,
            points: 1,
            generated_by_ai: questionData.generated_by_ai || false
          }
        ])
        .select()
        .single()

      if (questionError) throw questionError

      // Create options
      for (const [optionIndex, optionData] of questionData.options.entries()) {
        const { error: optionError } = await supabase
          .from('question_options')
          .insert([
            {
              question_id: newQuestion.id,
              option_text: optionData.option_text,
              is_correct: optionData.is_correct,
              order_index: optionIndex
            }
          ])

        if (optionError) throw optionError
      }
    }
  }

  const handleEdit = async (evaluation: Evaluation) => {
    setEditingEvaluation(evaluation)
    
    // Load questions and options
    const { data: questionsData, error } = await supabase
      .from('questions')
      .select(`
        *,
        options:question_options(*)
      `)
      .eq('evaluation_id', evaluation.id)
      .order('order_index')

    if (error) {
      console.error('Error loading questions:', error)
      toast.error('Error al cargar preguntas')
      return
    }

    // Transform data for form
    const formQuestions = (questionsData || []).map((question: any) => ({
      question_text: question.question_text,
      options: question.options
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((option: any) => ({
          option_text: option.option_text,
          is_correct: option.is_correct
        }))
    }))

    reset({
      course_id: evaluation.course_id,
      title: evaluation.title,
      description: evaluation.description || '',
      passing_score: evaluation.passing_score,
      max_attempts: evaluation.max_attempts,
      questions: formQuestions.length > 0 ? formQuestions : [
        {
          question_text: '',
          options: [
            { option_text: '', is_correct: true },
            { option_text: '', is_correct: false },
            { option_text: '', is_correct: false },
            { option_text: '', is_correct: false }
          ]
        }
      ]
    })

    setIsModalOpen(true)
  }

  const handleAIQuestionsGenerated = (generatedQuestions: GeneratedQuestion[]) => {
    const formattedQuestions = generatedQuestions.map(q => ({
      question_text: q.question_text,
      options: q.options,
      generated_by_ai: true
    }))

    setValue('questions', formattedQuestions)
    setShowAIGenerator(false)
    setCreationMode('manual')

    toast.success(`${generatedQuestions.length} preguntas cargadas. Puedes editarlas antes de guardar.`)
  }

  const handleModeChange = (mode: CreationMode) => {
    setCreationMode(mode)
    if (mode === 'ai-text' || mode === 'ai-file') {
      setShowAIGenerator(true)
    } else {
      setShowAIGenerator(false)
    }
  }

  const handleToggleActive = async (evaluation: Evaluation) => {
    try {
      const newActiveState = !evaluation.is_active

      if (newActiveState) {
        // First, deactivate all other evaluations for this course
        const { error: deactivateError } = await supabase
          .from('evaluations')
          .update({ is_active: false })
          .eq('course_id', evaluation.course_id)
          .neq('id', evaluation.id)

        if (deactivateError) throw deactivateError
      }

      // Then activate/deactivate this evaluation
      const { error: updateError } = await supabase
        .from('evaluations')
        .update({ is_active: newActiveState })
        .eq('id', evaluation.id)

      if (updateError) throw updateError

      toast.success(`Evaluación ${newActiveState ? 'activada' : 'desactivada'} correctamente`)
      await loadData()
    } catch (error: any) {
      console.error('Error toggling evaluation status:', error)
      toast.error(error.message || 'Error al cambiar estado de evaluación')
    }
  }

  const handleDelete = async (evaluation: Evaluation) => {
    if (!confirm(`¿Estás seguro de eliminar la evaluación "${evaluation.title}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('evaluations')
        .delete()
        .eq('id', evaluation.id)

      if (error) throw error
      
      toast.success('Evaluación eliminada correctamente')
      await loadData()
    } catch (error) {
      console.error('Error deleting evaluation:', error)
      toast.error('Error al eliminar evaluación')
    }
  }

  const handleViewQuestions = async (evaluation: Evaluation) => {
    const { data: questionsData, error } = await supabase
      .from('questions')
      .select(`
        *,
        options:question_options(*)
      `)
      .eq('evaluation_id', evaluation.id)
      .order('order_index')

    if (error) {
      console.error('Error loading questions:', error)
      toast.error('Error al cargar preguntas')
      return
    }

    // Sort options by order_index for each question
    const questionsWithSortedOptions = (questionsData || []).map((question: any) => ({
      ...question,
      options: (question.options || []).sort((a: any, b: any) => a.order_index - b.order_index)
    }))

    setViewingQuestions({
      ...evaluation,
      questions: questionsWithSortedOptions
    })
  }

  const filteredEvaluations = evaluations.filter(evaluation =>
    evaluation.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    evaluation.course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    evaluation.course_id === searchTerm
  )

  const groupedEvaluations = filteredEvaluations.reduce((acc, evaluation) => {
    const courseId = evaluation.course_id
    const courseName = evaluation.course.title

    if (!acc[courseId]) {
      acc[courseId] = {
        courseName,
        evaluations: []
      }
    }

    acc[courseId].evaluations.push(evaluation)
    return acc
  }, {} as { [key: string]: { courseName: string, evaluations: Evaluation[] } })

  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set())

  const toggleCourse = (courseId: string) => {
    setExpandedCourses(prev => {
      const newSet = new Set(prev)
      if (newSet.has(courseId)) {
        newSet.delete(courseId)
      } else {
        newSet.add(courseId)
      }
      return newSet
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Evaluaciones</h1>
          <p className="text-sm md:text-base text-slate-600">Gestiona las evaluaciones de los cursos</p>
        </div>
        <button
          onClick={() => {
            setEditingEvaluation(null)
            reset()
            setIsModalOpen(true)
          }}
          className="inline-flex items-center px-3 md:px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors text-sm md:text-base"
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5 mr-2" />
          Agregar Evaluación
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar evaluaciones por título o curso..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm md:text-base"
          />
        </div>
      </div>

      {/* Evaluations List Grouped by Course */}
      <div className="space-y-3">
        {Object.entries(groupedEvaluations).map(([courseId, { courseName, evaluations: courseEvaluations }]) => (
          <div key={courseId} className="bg-white rounded-lg shadow-sm border overflow-hidden">
            {/* Course Header */}
            <button
              onClick={() => toggleCourse(courseId)}
              className="w-full p-3 md:p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-slate-600" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm md:text-base font-bold text-slate-800">{courseName}</h3>
                  <p className="text-xs text-slate-600">
                    {courseEvaluations.length} evaluación{courseEvaluations.length !== 1 ? 'es' : ''}
                  </p>
                </div>
              </div>
              {expandedCourses.has(courseId) ? (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-slate-400" />
              )}
            </button>

            {/* Evaluations for this course */}
            {expandedCourses.has(courseId) && (
              <div className="border-t bg-slate-50">
                {courseEvaluations.map((evaluation) => (
                  <div key={evaluation.id} className="p-2.5 border-b last:border-b-0 bg-white">
                    <div className="flex items-center justify-between gap-3">
                      {/* Evaluation Info */}
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <HelpCircle className="w-4 h-4 text-blue-600" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-slate-800 mb-0.5 truncate">
                            {evaluation.title}
                          </h4>
                          <div className="flex flex-wrap gap-1.5 text-xs">
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-green-100 text-green-800 rounded-full whitespace-nowrap">
                              <CheckCircle className="w-3 h-3 mr-0.5" />
                              {evaluation.passing_score}%
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded-full whitespace-nowrap">
                              Máx. {evaluation.max_attempts}
                            </span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                              evaluation.is_active
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {evaluation.is_active ? 'Activa' : 'Inactiva'}
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full whitespace-nowrap">
                              <Calendar className="w-3 h-3 mr-0.5" />
                              {format(new Date(evaluation.created_at), 'dd/MM/yyyy', { locale: es })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => {
                            navigate('/admin/courses', { state: { scrollToCourseId: courseId } })
                          }}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors text-xs whitespace-nowrap"
                          title="Ver Curso"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="hidden xl:inline">Curso</span>
                        </button>
                        <button
                          onClick={() => handleViewQuestions(evaluation)}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors text-xs whitespace-nowrap"
                          title="Ver Preguntas"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden xl:inline">Preguntas</span>
                        </button>
                        <button
                          onClick={() => handleEdit(evaluation)}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors text-xs"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(evaluation)}
                          className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded transition-colors text-xs ${
                            evaluation.is_active
                              ? 'text-orange-600 hover:text-orange-900 hover:bg-orange-50'
                              : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                          }`}
                          title={evaluation.is_active ? 'Desactivar' : 'Activar'}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(evaluation)}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors text-xs"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredEvaluations.length === 0 && (
        <div className="text-center py-8 md:py-12">
          <HelpCircle className="mx-auto h-10 w-10 md:h-12 md:w-12 text-slate-400" />
          <h3 className="mt-2 text-sm md:text-base font-medium text-slate-900">
            {searchTerm ? 'No hay resultados' : 'No hay evaluaciones'}
          </h3>
          <p className="mt-1 text-xs md:text-sm text-slate-500">
            {searchTerm 
              ? 'Intenta con otros términos de búsqueda.' 
              : 'Comienza creando evaluaciones para tus cursos.'
            }
          </p>
        </div>
      )}

      {/* View Questions Modal */}
      {viewingQuestions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 md:p-4 z-50 overflow-y-auto no-scrollbar">
          <div className="bg-white md:rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto md:my-4 modal-content">
            <div className="p-4 md:p-6 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-slate-800 pr-8">
                    Preguntas: {viewingQuestions.title}
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Curso: {viewingQuestions.course.title}
                  </p>
                </div>
                <button
                  onClick={() => setViewingQuestions(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-4 md:p-6">
              <div className="space-y-6">
                {viewingQuestions.questions?.map((question: any, index: number) => (
                  <div key={question.id} className="border rounded-lg p-4">
                    <h3 className="font-semibold text-slate-800 mb-3">
                      {index + 1}. {question.question_text}
                    </h3>
                    <div className="space-y-2">
                      {question.options?.map((option: any, optIndex: number) => (
                        <div key={option.id} className={`p-2 rounded border ${
                          option.is_correct 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-slate-50 border-slate-200'
                        }`}>
                          <span className="text-sm">
                            {String.fromCharCode(65 + optIndex)}. {option.option_text}
                            {option.is_correct && (
                              <span className="ml-2 text-green-600 font-medium">✓ Correcta</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 md:p-4 z-50 overflow-y-auto no-scrollbar">
          <div className="bg-white md:rounded-xl shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto md:my-4 modal-content">
            <div className="p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-slate-800 mb-4 md:mb-6">
                {editingEvaluation ? 'Editar Evaluación' : 'Crear Evaluación'}
              </h2>

              {showAIGenerator && user ? (
                <AIQuestionGenerator
                  userId={user.id}
                  onQuestionsGenerated={handleAIQuestionsGenerated}
                  onCancel={() => {
                    setShowAIGenerator(false)
                    setCreationMode('manual')
                  }}
                  initialMode={creationMode === 'ai-file' ? 'file' : 'text'}
                />
              ) : (
                <form onSubmit={handleSubmit(handleCreateOrUpdate)} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Curso *
                    </label>
                    <select
                      {...register('course_id', { required: 'Selecciona un curso' })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                      disabled={editingEvaluation !== null}
                    >
                      <option value="">Seleccionar curso</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                    {errors.course_id && (
                      <p className="text-red-500 text-xs mt-1">{errors.course_id.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Título de la Evaluación *
                    </label>
                    <input
                      {...register('title', { required: 'El título es requerido' })}
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                      placeholder="Evaluación de conocimientos"
                    />
                    {errors.title && (
                      <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    {...register('description')}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                    placeholder="Descripción de la evaluación (opcional)"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Puntaje Mínimo (%) *
                    </label>
                    <input
                      {...register('passing_score', { 
                        required: 'El puntaje es requerido',
                        min: { value: 1, message: 'Mínimo 1%' },
                        max: { value: 100, message: 'Máximo 100%' }
                      })}
                      type="number"
                      min="1"
                      max="100"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                    />
                    {errors.passing_score && (
                      <p className="text-red-500 text-xs mt-1">{errors.passing_score.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Máximo Intentos *
                    </label>
                    <input
                      {...register('max_attempts', { 
                        required: 'Los intentos son requeridos',
                        min: { value: 1, message: 'Mínimo 1 intento' },
                        max: { value: 10, message: 'Máximo 10 intentos' }
                      })}
                      type="number"
                      min="1"
                      max="10"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                    />
                    {errors.max_attempts && (
                      <p className="text-red-500 text-xs mt-1">{errors.max_attempts.message}</p>
                    )}
                  </div>
                </div>

                {/* Creation Method Selection */}
                {!editingEvaluation && (
                  <div className="border-t pt-6">
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Método de Creación
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button
                        type="button"
                        onClick={() => handleModeChange('manual')}
                        className={`p-5 border-2 rounded-xl transition-all duration-300 ${
                          creationMode === 'manual'
                            ? 'border-slate-600 bg-slate-50 shadow-md'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Edit className={`w-7 h-7 ${creationMode === 'manual' ? 'text-slate-700' : 'text-gray-400'}`} />
                          <span className={`text-sm font-semibold ${creationMode === 'manual' ? 'text-slate-700' : 'text-gray-700'}`}>
                            Manual
                          </span>
                          <span className="text-xs text-gray-500 text-center">
                            Crear preguntas manualmente
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleModeChange('ai-text')}
                        className={`relative p-5 border-2 rounded-xl transition-all duration-300 overflow-hidden group ${
                          creationMode === 'ai-text'
                            ? 'border-transparent shadow-lg'
                            : 'border-gray-200 hover:border-transparent hover:shadow-md'
                        }`}
                        style={creationMode === 'ai-text' ? {
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        } : {}}
                      >
                        {creationMode !== 'ai-text' && (
                          <div className="absolute inset-0 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        )}
                        <div className="relative flex flex-col items-center gap-2">
                          <div className="relative">
                            <Sparkles className={`w-7 h-7 ${creationMode === 'ai-text' ? 'text-white' : 'text-gray-400 group-hover:text-white'} transition-colors`} />
                            {creationMode === 'ai-text' && (
                              <div className="absolute -top-1 -right-1">
                                <div className="w-2 h-2 bg-yellow-300 rounded-full animate-ping" />
                                <div className="absolute top-0 w-2 h-2 bg-yellow-400 rounded-full" />
                              </div>
                            )}
                          </div>
                          <span className={`text-sm font-semibold ${creationMode === 'ai-text' ? 'text-white' : 'text-gray-700 group-hover:text-white'} transition-colors`}>
                            IA desde Texto
                          </span>
                          <span className={`text-xs text-center ${creationMode === 'ai-text' ? 'text-white/90' : 'text-gray-500 group-hover:text-white/90'} transition-colors`}>
                            Generar desde contenido escrito
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleModeChange('ai-file')}
                        className={`relative p-5 border-2 rounded-xl transition-all duration-300 overflow-hidden group ${
                          creationMode === 'ai-file'
                            ? 'border-transparent shadow-lg'
                            : 'border-gray-200 hover:border-transparent hover:shadow-md'
                        }`}
                        style={creationMode === 'ai-file' ? {
                          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                        } : {}}
                      >
                        {creationMode !== 'ai-file' && (
                          <div className="absolute inset-0 bg-gradient-to-br from-pink-500 via-rose-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        )}
                        <div className="relative flex flex-col items-center gap-2">
                          <div className="relative">
                            <div className="relative">
                              <Sparkles className={`w-7 h-7 ${creationMode === 'ai-file' ? 'text-white' : 'text-gray-400 group-hover:text-white'} transition-colors absolute`} />
                              <Upload className={`w-7 h-7 ${creationMode === 'ai-file' ? 'text-white' : 'text-gray-400 group-hover:text-white'} transition-colors`} style={{ transform: 'scale(0.7)' }} />
                            </div>
                            {creationMode === 'ai-file' && (
                              <div className="absolute -top-1 -right-1">
                                <div className="w-2 h-2 bg-yellow-300 rounded-full animate-ping" />
                                <div className="absolute top-0 w-2 h-2 bg-yellow-400 rounded-full" />
                              </div>
                            )}
                          </div>
                          <span className={`text-sm font-semibold ${creationMode === 'ai-file' ? 'text-white' : 'text-gray-700 group-hover:text-white'} transition-colors`}>
                            IA desde Archivo
                          </span>
                          <span className={`text-xs text-center ${creationMode === 'ai-file' ? 'text-white/90' : 'text-gray-500 group-hover:text-white/90'} transition-colors`}>
                            Generar desde PDF o TXT
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Questions */}
                <div className="border-t pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-800">
                        Preguntas
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        questionFields.length >= 3
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {questionFields.length} {questionFields.length === 1 ? 'pregunta' : 'preguntas'}
                        {questionFields.length < 3 && ' (mínimo 3)'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => appendQuestion({
                        question_text: '',
                        options: [
                          { option_text: '', is_correct: true },
                          { option_text: '', is_correct: false },
                          { option_text: '', is_correct: false },
                          { option_text: '', is_correct: false }
                        ]
                      })}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm"
                    >
                      + Agregar Pregunta
                    </button>
                  </div>

                  {questionFields.map((question, questionIndex) => (
                    <QuestionForm
                      key={question.id}
                      questionIndex={questionIndex}
                      register={register}
                      control={control}
                      errors={errors}
                      onRemove={() => removeQuestion(questionIndex)}
                      canRemove={questionFields.length > 1}
                      setValue={setValue}
                      watch={watch}
                      isAIGenerated={watch(`questions.${questionIndex}.generated_by_ai`)}
                    />
                  ))}
                </div>

                {/* Buttons */}
                <div className="flex space-x-3 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false)
                      setEditingEvaluation(null)
                      reset()
                    }}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
                  >
                    {isSubmitting ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto"></div>
                    ) : (
                      editingEvaluation ? 'Actualizar' : 'Crear Evaluación'
                    )}
                  </button>
                </div>
              </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Question Form Component
interface QuestionFormProps {
  questionIndex: number
  register: any
  control: any
  errors: any
  onRemove: () => void
  canRemove: boolean
  setValue: any
  watch: any
  isAIGenerated?: boolean
}

function QuestionForm({ questionIndex, register, control, errors, onRemove, canRemove, setValue, watch, isAIGenerated }: QuestionFormProps) {
  const questionOptions = watch(`questions.${questionIndex}.options`) || []

  const handleCorrectAnswerChange = (optionIndex: number) => {
    // Set all options to false, then set the selected one to true
    questionOptions.forEach((_: any, index: number) => {
      setValue(`questions.${questionIndex}.options.${index}.is_correct`, index === optionIndex)
    })
  }

  return (
    <div className="border rounded-lg p-4 mb-4 bg-slate-50">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <h4 className="text-md font-medium text-slate-800">Pregunta {questionIndex + 1}</h4>
          {isAIGenerated && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
              <Sparkles className="w-3 h-3" />
              Generada con IA
            </span>
          )}
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-red-600 hover:text-red-900 text-sm"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      {/* Hidden input for generated_by_ai flag */}
      <input
        type="hidden"
        {...register(`questions.${questionIndex}.generated_by_ai`)}
      />

      <div className="space-y-4">
        {/* Question Text */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Pregunta *
          </label>
          <textarea
            {...register(`questions.${questionIndex}.question_text`, { 
              required: 'La pregunta es requerida' 
            })}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
            placeholder="Escribe tu pregunta aquí..."
          />
          {errors.questions?.[questionIndex]?.question_text && (
            <p className="text-red-500 text-xs mt-1">
              {errors.questions[questionIndex].question_text.message}
            </p>
          )}
        </div>

        {/* Options */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Opciones de Respuesta (marca la correcta)
          </label>
          <div className="space-y-3">
            {questionOptions.map((option: any, optionIndex: number) => (
              <div key={optionIndex} className="flex items-center space-x-3">
                <input
                  type="radio"
                  name={`question-${questionIndex}-correct`}
                  checked={option.is_correct === true}
                  onChange={() => handleCorrectAnswerChange(optionIndex)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                />
                <span className="text-sm font-medium text-slate-700 w-6">
                  {String.fromCharCode(65 + optionIndex)}.
                </span>
                <input
                  {...register(`questions.${questionIndex}.options.${optionIndex}.option_text`, {
                    required: 'La opción es requerida'
                  })}
                  type="text"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                  placeholder={`Opción ${String.fromCharCode(65 + optionIndex)}`}
                />
                {/* Hidden input for is_correct */}
                <input
                  {...register(`questions.${questionIndex}.options.${optionIndex}.is_correct`)}
                  type="hidden"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}