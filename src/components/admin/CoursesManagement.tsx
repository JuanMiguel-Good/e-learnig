import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { StorageService } from '../../lib/storage'
import { Plus, CreditCard as Edit2, Trash2, Upload, BookOpen, User, Video, FileText, CheckCircle, AlertCircle, ExternalLink, Check, HelpCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useForm, useFieldArray } from 'react-hook-form'

interface Course {
  id: string
  title: string
  description: string | null
  image_url: string | null
  instructor_id: string | null
  is_active: boolean
  created_at: string
  requires_evaluation: boolean
  hours: number
  activity_type: 'full_course' | 'topic' | 'attendance_only'
  instructor?: {
    name: string
  }
}

interface EvaluationStatus {
  hasEvaluation: boolean
  evaluationId?: string
  questionCount?: number
  passingScore?: number
  title?: string
}

interface Instructor {
  id: string
  name: string
}

interface Module {
  title: string
  description: string
  lessons: Lesson[]
}

interface Lesson {
  title: string
  content: string
  video: FileList | null
  duration_minutes: number
}

interface CourseFormData {
  title: string
  description: string
  instructor_id: string
  is_active: boolean
  requires_evaluation: boolean
  hours: number
  activity_type: 'full_course' | 'topic' | 'attendance_only'
  image: FileList
  modules: Module[]
}

export default function CoursesManagement() {
  const [courses, setCourses] = useState<Course[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})
  const [loadingCourseData, setLoadingCourseData] = useState(false)
  const [activityFilter, setActivityFilter] = useState<'all' | 'full_course' | 'topic' | 'attendance_only'>('all')
  const [evaluationStatuses, setEvaluationStatuses] = useState<{ [courseId: string]: EvaluationStatus }>({})
  const [showQuickEvaluationModal, setShowQuickEvaluationModal] = useState(false)
  const [selectedCourseForEvaluation, setSelectedCourseForEvaluation] = useState<Course | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    control,
    watch
  } = useForm<CourseFormData>({
    defaultValues: {
      activity_type: 'full_course',
      modules: [{
        title: '',
        description: '',
        lessons: [{ title: '', content: '', video: null, duration_minutes: 0 }]
      }]
    }
  })

  const watchActivityType = watch('activity_type')

  const { fields: moduleFields, append: appendModule, remove: removeModule } = useFieldArray({
    control,
    name: 'modules'
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Load courses with instructor info
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select(`
          *,
          instructor:instructors(name)
        `)
        .order('created_at', { ascending: false })

      if (coursesError) throw coursesError

      // Load instructors
      const { data: instructorsData, error: instructorsError } = await supabase
        .from('instructors')
        .select('id, name')
        .order('name')

      if (instructorsError) throw instructorsError

      setCourses(coursesData || [])
      setInstructors(instructorsData || [])

      // Load evaluation statuses for courses that require evaluation
      if (coursesData && coursesData.length > 0) {
        await loadEvaluationStatuses(coursesData)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setIsLoading(false)
    }
  }

  const loadEvaluationStatuses = async (courses: Course[]) => {
    try {
      const coursesRequiringEval = courses.filter(c => c.requires_evaluation)
      const statuses: { [courseId: string]: EvaluationStatus } = {}

      for (const course of coursesRequiringEval) {
        const { data: evaluation, error } = await supabase
          .from('evaluations')
          .select('id, title, passing_score')
          .eq('course_id', course.id)
          .maybeSingle()

        if (error) {
          console.error(`Error loading evaluation for course ${course.id}:`, error)
          continue
        }

        if (evaluation) {
          // Load question count
          const { count, error: countError } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('evaluation_id', evaluation.id)

          if (countError) {
            console.error(`Error counting questions for evaluation ${evaluation.id}:`, countError)
          }

          statuses[course.id] = {
            hasEvaluation: true,
            evaluationId: evaluation.id,
            questionCount: count || 0,
            passingScore: evaluation.passing_score,
            title: evaluation.title
          }
        } else {
          statuses[course.id] = {
            hasEvaluation: false
          }
        }
      }

      setEvaluationStatuses(statuses)
    } catch (error) {
      console.error('Error loading evaluation statuses:', error)
    }
  }

  const handleCreateOrUpdate = async (data: CourseFormData) => {
    try {
      // Validation: Check if course requires evaluation and is being activated
      if (data.is_active && data.requires_evaluation && editingCourse) {
        const evalStatus = evaluationStatuses[editingCourse.id]
        if (!evalStatus?.hasEvaluation) {
          const confirmActivate = window.confirm(
            'Este curso no tiene una evaluación configurada. Se recomienda crear la evaluación antes de activarlo.\n\n¿Deseas continuar de todas formas?'
          )
          if (!confirmActivate) return
        } else if (evalStatus.questionCount < 3) {
          const confirmActivate = window.confirm(
            `La evaluación solo tiene ${evalStatus.questionCount} pregunta(s). Se recomienda tener al menos 3 preguntas.\n\n¿Deseas continuar de todas formas?`
          )
          if (!confirmActivate) return
        }
      }

      setUploading(true)
      setUploadProgress({})
      let imageUrl = editingCourse?.image_url || null

      // Upload image if provided
      if (data.image && data.image.length > 0) {
        setUploadProgress(prev => ({ ...prev, courseImage: 0 }))
        const file = data.image[0]
        const sanitizedName = StorageService.sanitizeFileName(file.name)
        const fileName = `course_${Date.now()}_${sanitizedName}`

        setUploadProgress(prev => ({ ...prev, courseImage: 50 }))
        const { url, error } = await StorageService.uploadFile(
          'course-images',
          fileName,
          file
        )

        if (error) throw error
        setUploadProgress(prev => ({ ...prev, courseImage: 100 }))
        imageUrl = url
      }

      if (editingCourse) {
        // Update existing course
        // Auto-set requires_evaluation based on activity_type
        let requiresEvaluation = data.requires_evaluation
        if (data.activity_type === 'topic') {
          requiresEvaluation = true // Topics always require evaluation
        } else if (data.activity_type === 'attendance_only') {
          requiresEvaluation = false // Attendance only never requires evaluation
        }

        const { error: courseError } = await supabase
          .from('courses')
          .update({
            title: data.title,
            description: data.description,
            instructor_id: data.instructor_id,
            is_active: data.is_active,
            requires_evaluation: requiresEvaluation,
            hours: data.hours,
            activity_type: data.activity_type,
            image_url: imageUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCourse.id)

        if (courseError) throw courseError

        // Update modules and lessons only if full_course type
        if (data.activity_type === 'full_course') {
          await updateModulesAndLessons(editingCourse.id, data.modules)
        }

        toast.success('Curso actualizado correctamente')
      } else {
        // Create new course
        // Auto-set requires_evaluation based on activity_type
        let requiresEvaluation = data.requires_evaluation
        if (data.activity_type === 'topic') {
          requiresEvaluation = true // Topics always require evaluation
        } else if (data.activity_type === 'attendance_only') {
          requiresEvaluation = false // Attendance only never requires evaluation
        }

        const { data: newCourse, error: courseError } = await supabase
          .from('courses')
          .insert([
            {
              title: data.title,
              description: data.description,
              instructor_id: data.instructor_id,
              is_active: data.is_active,
              requires_evaluation: requiresEvaluation,
              hours: data.hours,
              activity_type: data.activity_type,
              image_url: imageUrl
            }
          ])
          .select()
          .single()

        if (courseError) throw courseError

        // Create modules and lessons only if full_course type
        if (data.activity_type === 'full_course') {
          for (const [moduleIndex, moduleData] of data.modules.entries()) {
          const { data: newModule, error: moduleError } = await supabase
            .from('modules')
            .insert([
              {
                title: moduleData.title,
                description: moduleData.description,
                course_id: newCourse.id,
                order_index: moduleIndex
              }
            ])
            .select()
            .single()

          if (moduleError) throw moduleError

          // Create lessons for this module
          for (const [lessonIndex, lessonData] of moduleData.lessons.entries()) {
            let videoUrl = ''
            
            // Upload video if provided
            if (lessonData.video && lessonData.video.length > 0) {
              const progressKey = `video-${moduleIndex}-${lessonIndex}`
              setUploadProgress(prev => ({ ...prev, [progressKey]: 0 }))

              const file = lessonData.video[0]
              const sanitizedName = StorageService.sanitizeFileName(file.name)
              const fileName = `lesson_${Date.now()}_${sanitizedName}`

              setUploadProgress(prev => ({ ...prev, [progressKey]: 50 }))
              const { url, error } = await StorageService.uploadFile(
                'lesson-videos',
                fileName,
                file
              )

              if (error) throw error
              setUploadProgress(prev => ({ ...prev, [progressKey]: 100 }))
              videoUrl = url || ''
            }

            const { error: lessonError } = await supabase
              .from('lessons')
              .insert([
                {
                  title: lessonData.title,
                  content: lessonData.content,
                  video_url: videoUrl,
                  module_id: newModule.id,
                  order_index: lessonIndex,
                  duration_minutes: lessonData.duration_minutes
                }
              ])

            if (lessonError) throw lessonError
          }
        }
        }

        toast.success('Curso creado correctamente')
      }

      await loadData()
      setIsModalOpen(false)
      setEditingCourse(null)
      setUploadProgress({})
      reset()
    } catch (error: any) {
      console.error('Error saving course:', error)
      toast.error(error.message || 'Error al guardar curso')
    } finally {
      setUploading(false)
      setUploadProgress({})
    }
  }

  const updateModulesAndLessons = async (courseId: string, modules: Module[]) => {
    try {
      // Get existing modules to compare
      const { data: existingModules } = await supabase
        .from('modules')
        .select('id, lessons(id)')
        .eq('course_id', courseId)

      const existingModuleIds = new Set((existingModules || []).map(m => m.id))
      const currentModuleIds = new Set()

      // Process each module
      for (const [moduleIndex, moduleData] of modules.entries()) {
        let moduleId = (moduleData as any).id

        if (moduleId && existingModuleIds.has(moduleId)) {
          // Update existing module
          const { error: moduleError } = await supabase
            .from('modules')
            .update({
              title: moduleData.title,
              description: moduleData.description,
              order_index: moduleIndex
            })
            .eq('id', moduleId)

          if (moduleError) throw moduleError
          currentModuleIds.add(moduleId)
        } else {
          // Create new module
          const { data: newModule, error: moduleError } = await supabase
            .from('modules')
            .insert([
              {
                title: moduleData.title,
                description: moduleData.description,
                course_id: courseId,
                order_index: moduleIndex
              }
            ])
            .select()
            .single()

          if (moduleError) throw moduleError
          moduleId = newModule.id
          currentModuleIds.add(moduleId)
        }

        // Get existing lessons for this module
        const existingModule = existingModules?.find(m => m.id === moduleId)
        const existingLessonIds = new Set((existingModule?.lessons || []).map((l: any) => l.id))
        const currentLessonIds = new Set()

        // Process lessons for this module
        for (const [lessonIndex, lessonData] of moduleData.lessons.entries()) {
          let lessonId = (lessonData as any).id
          let videoUrl = (lessonData as any).video_url || ''

          // Upload new video if provided
          if (lessonData.video && lessonData.video.length > 0) {
            const file = lessonData.video[0]
            const sanitizedName = StorageService.sanitizeFileName(file.name)
            const fileName = `lesson_${Date.now()}_${sanitizedName}`

            const { url, error } = await StorageService.uploadFile(
              'lesson-videos',
              fileName,
              file
            )

            if (error) throw error
            videoUrl = url || ''
          }

          if (lessonId && existingLessonIds.has(lessonId)) {
            // Update existing lesson
            const updateData: any = {
              title: lessonData.title,
              content: lessonData.content,
              order_index: lessonIndex,
              duration_minutes: lessonData.duration_minutes
            }

            // Only update video_url if new video was uploaded
            if (lessonData.video && lessonData.video.length > 0) {
              updateData.video_url = videoUrl
            }

            const { error: lessonError } = await supabase
              .from('lessons')
              .update(updateData)
              .eq('id', lessonId)

            if (lessonError) throw lessonError
            currentLessonIds.add(lessonId)
          } else {
            // Create new lesson
            const { data: newLesson, error: lessonError } = await supabase
              .from('lessons')
              .insert([
                {
                  title: lessonData.title,
                  content: lessonData.content,
                  video_url: videoUrl,
                  module_id: moduleId,
                  order_index: lessonIndex,
                  duration_minutes: lessonData.duration_minutes
                }
              ])
              .select()
              .single()

            if (lessonError) throw lessonError
            currentLessonIds.add(newLesson.id)
          }
        }

        // Delete removed lessons
        const lessonsToDelete = [...existingLessonIds].filter(id => !currentLessonIds.has(id))
        if (lessonsToDelete.length > 0) {
          const { error: deleteLessonsError } = await supabase
            .from('lessons')
            .delete()
            .in('id', lessonsToDelete)

          if (deleteLessonsError) throw deleteLessonsError
        }
      }

      // Delete removed modules
      const modulesToDelete = [...existingModuleIds].filter(id => !currentModuleIds.has(id))
      if (modulesToDelete.length > 0) {
        const { error: deleteModulesError } = await supabase
          .from('modules')
          .delete()
          .in('id', modulesToDelete)

        if (deleteModulesError) throw deleteModulesError
      }
    } catch (error) {
      console.error('Error updating modules and lessons:', error)
      throw error
    }
  }

  const handleEdit = (course: Course) => {
    setEditingCourse(course)
    loadCourseModulesAndLessons(course.id)
    setIsModalOpen(true)
  }

  const loadCourseModulesAndLessons = async (courseId: string) => {
    try {
      setLoadingCourseData(true)
      
      // Get course data first
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single()

      if (courseError) throw courseError

      const { data: modulesData, error } = await supabase
        .from('modules')
        .select(`
          *,
          lessons (*)
        `)
        .eq('course_id', courseId)
        .order('order_index')

      if (error) throw error

      // Transform data to match form structure
      const formModules = (modulesData || []).map((module: any) => ({
        id: module.id, // Keep ID for updates
        title: module.title,
        description: module.description || '',
        lessons: module.lessons
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((lesson: any) => ({
            id: lesson.id, // Keep ID for updates
            title: lesson.title,
            content: lesson.content,
            video: null, // File input will be empty
            video_url: lesson.video_url, // Keep existing URL
            duration_minutes: lesson.duration_minutes
          }))
      }))

      // Reset form with complete course data
      reset({
        title: courseData.title,
        description: courseData.description || '',
        instructor_id: courseData.instructor_id || '',
        is_active: courseData.is_active,
        requires_evaluation: courseData.requires_evaluation || false,
        hours: courseData.hours || 1,
        activity_type: courseData.activity_type || 'full_course',
        image: undefined as any,
        modules: formModules.length > 0 ? formModules : [{
          title: '',
          description: '',
          lessons: [{ title: '', content: '', video: null, duration_minutes: 0 }]
        }]
      })
    } catch (error) {
      console.error('Error loading course modules:', error)
      toast.error('Error al cargar módulos del curso')
    } finally {
      setLoadingCourseData(false)
    }
  }

  const handleDelete = async (course: Course) => {
    if (!confirm(`¿Estás seguro de eliminar el curso "${course.title}"?`)) {
      return
    }

    try {
      // Delete course image if exists
      if (course.image_url) {
        const fileName = course.image_url.split('/').pop()
        if (fileName) {
          await StorageService.deleteFile('course-images', fileName)
        }
      }

      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', course.id)

      if (error) throw error
      
      toast.success('Curso eliminado correctamente')
      await loadData()
    } catch (error) {
      console.error('Error deleting course:', error)
      toast.error('Error al eliminar curso')
    }
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cursos</h1>
          <p className="text-slate-600">Gestiona los cursos de la plataforma</p>
        </div>
        <button
          onClick={() => {
            setEditingCourse(null)
            reset()
            setShowTypeSelector(true)
          }}
          className="inline-flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Agregar Curso
        </button>
      </div>

      {/* Activity Type Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActivityFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            activityFilter === 'all'
              ? 'bg-slate-800 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setActivityFilter('full_course')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center ${
            activityFilter === 'full_course'
              ? 'bg-blue-600 text-white'
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
          }`}
        >
          <BookOpen className="w-4 h-4 mr-1.5" />
          Cursos
        </button>
        <button
          onClick={() => setActivityFilter('topic')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center ${
            activityFilter === 'topic'
              ? 'bg-green-600 text-white'
              : 'bg-green-50 text-green-700 hover:bg-green-100'
          }`}
        >
          <FileText className="w-4 h-4 mr-1.5" />
          Evaluaciones
        </button>
        <button
          onClick={() => setActivityFilter('attendance_only')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center ${
            activityFilter === 'attendance_only'
              ? 'bg-orange-600 text-white'
              : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
          }`}
        >
          <CheckCircle className="w-4 h-4 mr-1.5" />
          Listas de Asistencia
        </button>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.filter(course => activityFilter === 'all' || course.activity_type === activityFilter).map((course) => (
          <div key={course.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {course.image_url && (
              <img 
                src={course.image_url} 
                alt={course.title}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-slate-800 truncate">
                  {course.title}
                </h3>
                <div className="flex gap-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    course.activity_type === 'full_course'
                      ? 'bg-blue-100 text-blue-800'
                      : course.activity_type === 'topic'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {course.activity_type === 'full_course'
                      ? 'Curso'
                      : course.activity_type === 'topic'
                      ? 'Evaluación'
                      : 'Lista'}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    course.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {course.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
              
              {course.description && (
                <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                  {course.description}
                </p>
              )}

              <div className="space-y-2 mb-4">
                {course.instructor && (
                  <p className="text-slate-500 text-sm flex items-center">
                    <User className="w-4 h-4 mr-1" />
                    {course.instructor.name}
                  </p>
                )}
                <p className="text-slate-500 text-sm">
                  <span className="font-medium">Duración:</span> {course.hours} horas
                </p>
              </div>

              {/* Evaluation Status Section */}
              {course.requires_evaluation && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  {evaluationStatuses[course.id]?.hasEvaluation ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-green-600 text-sm font-medium">
                          <Check className="w-4 h-4 mr-1.5" />
                          Evaluación Configurada
                        </div>
                      </div>
                      <div className="text-xs text-slate-600 space-y-1">
                        <p className="flex items-center">
                          <HelpCircle className="w-3 h-3 mr-1" />
                          {evaluationStatuses[course.id].questionCount || 0} preguntas
                        </p>
                        <p>Puntaje de aprobación: {evaluationStatuses[course.id].passingScore}%</p>
                      </div>
                      <button
                        onClick={() => window.location.href = `/admin/evaluaciones?courseId=${course.id}`}
                        className="w-full flex items-center justify-center px-3 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 mr-1.5" />
                        Ver/Editar Evaluación
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center text-amber-600 text-sm font-medium">
                        <AlertCircle className="w-4 h-4 mr-1.5" />
                        Sin Evaluación
                      </div>
                      <p className="text-xs text-slate-600">
                        Este curso requiere una evaluación para ser completado
                      </p>
                      <button
                        onClick={() => {
                          setSelectedCourseForEvaluation(course)
                          setShowQuickEvaluationModal(true)
                        }}
                        className="w-full flex items-center justify-center px-3 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Plus className="w-4 h-4 mr-1.5" />
                        Crear Evaluación
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => handleEdit(course)}
                  className="text-slate-600 hover:text-slate-900"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(course)}
                  className="text-red-600 hover:text-red-900"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {courses.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">No hay cursos</h3>
          <p className="mt-1 text-sm text-slate-500">Comienza creando tu primer curso.</p>
        </div>
      )}

      {courses.length > 0 && courses.filter(course => activityFilter === 'all' || course.activity_type === activityFilter).length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">
            No hay {activityFilter === 'full_course' ? 'cursos' : activityFilter === 'topic' ? 'evaluaciones' : activityFilter === 'attendance_only' ? 'listas de asistencia' : 'actividades'} disponibles
          </h3>
          <p className="mt-1 text-sm text-slate-500">Intenta con otro filtro.</p>
        </div>
      )}

      {/* Modal for Activity Type Selection */}
      {showTypeSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                Selecciona el Tipo de Actividad
              </h2>
              <p className="text-slate-600">
                Elige el tipo de actividad que deseas crear
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Full Course Button */}
              <button
                onClick={() => {
                  setValue('activity_type', 'full_course')
                  setShowTypeSelector(false)
                  setIsModalOpen(true)
                }}
                className="group relative bg-white border-2 border-slate-300 hover:border-blue-500 rounded-xl p-6 text-center transition-all hover:shadow-lg"
              >
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-20 h-20 bg-blue-100 group-hover:bg-blue-500 rounded-full flex items-center justify-center transition-colors">
                    <BookOpen className="w-10 h-10 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">
                      Curso Completo
                    </h3>
                    <p className="text-sm text-slate-600">
                      Con módulos, lecciones y contenido multimedia
                    </p>
                  </div>
                </div>
              </button>

              {/* Topic Button */}
              <button
                onClick={() => {
                  setValue('activity_type', 'topic')
                  setShowTypeSelector(false)
                  setIsModalOpen(true)
                }}
                className="group relative bg-white border-2 border-slate-300 hover:border-green-500 rounded-xl p-6 text-center transition-all hover:shadow-lg"
              >
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-20 h-20 bg-green-100 group-hover:bg-green-500 rounded-full flex items-center justify-center transition-colors">
                    <FileText className="w-10 h-10 text-green-600 group-hover:text-white transition-colors" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">
                      Evaluación
                    </h3>
                    <p className="text-sm text-slate-600">
                      Solo evaluación, sin módulos ni lecciones
                    </p>
                  </div>
                </div>
              </button>

              {/* Attendance Only Button */}
              <button
                onClick={() => {
                  setValue('activity_type', 'attendance_only')
                  setShowTypeSelector(false)
                  setIsModalOpen(true)
                }}
                className="group relative bg-white border-2 border-slate-300 hover:border-orange-500 rounded-xl p-6 text-center transition-all hover:shadow-lg"
              >
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-20 h-20 bg-orange-100 group-hover:bg-orange-500 rounded-full flex items-center justify-center transition-colors">
                    <CheckCircle className="w-10 h-10 text-orange-600 group-hover:text-white transition-colors" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">
                      Lista de Asistencia
                    </h3>
                    <p className="text-sm text-slate-600">
                      Solo firma de asistencia, sin evaluación
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="flex justify-center mt-8">
              <button
                onClick={() => setShowTypeSelector(false)}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Evaluation Creation Modal */}
      {showQuickEvaluationModal && selectedCourseForEvaluation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-8 my-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              Crear Evaluación para {selectedCourseForEvaluation.title}
            </h2>
            <p className="text-slate-600 mb-6">
              Puedes crear una evaluación básica ahora o configurarla completamente después
            </p>

            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Opciones de Creación</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      window.location.href = `/admin/evaluaciones?createFor=${selectedCourseForEvaluation.id}`
                    }}
                    className="w-full flex items-start p-4 bg-white border-2 border-blue-300 hover:border-blue-500 rounded-lg text-left transition-all hover:shadow-md"
                  >
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-800 mb-1">
                        Configuración Completa (Recomendado)
                      </h4>
                      <p className="text-sm text-slate-600">
                        Ir a la sección de Evaluaciones para crear la evaluación con todas las preguntas
                      </p>
                    </div>
                    <ExternalLink className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" />
                  </button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-slate-500">o</span>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        const { data: newEval, error } = await supabase
                          .from('evaluations')
                          .insert([{
                            course_id: selectedCourseForEvaluation.id,
                            title: `Evaluación - ${selectedCourseForEvaluation.title}`,
                            description: 'Evaluación pendiente de configurar',
                            passing_score: 60,
                            max_attempts: 3,
                            is_active: false
                          }])
                          .select()
                          .single()

                        if (error) throw error

                        toast.success('Evaluación creada. Configúrala en la sección de Evaluaciones')
                        setShowQuickEvaluationModal(false)
                        setSelectedCourseForEvaluation(null)
                        await loadData()
                      } catch (error: any) {
                        console.error('Error creating evaluation:', error)
                        toast.error('Error al crear la evaluación')
                      }
                    }}
                    className="w-full flex items-start p-4 bg-white border-2 border-slate-300 hover:border-slate-500 rounded-lg text-left transition-all hover:shadow-md"
                  >
                    <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mr-4">
                      <Plus className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-800 mb-1">
                        Creación Rápida
                      </h4>
                      <p className="text-sm text-slate-600">
                        Crear evaluación básica ahora y agregar preguntas después
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">Nota Importante</p>
                    <p>
                      La evaluación debe tener al menos 3 preguntas para poder ser activada.
                      Recuerda configurarla completamente antes de asignar el curso a participantes.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowQuickEvaluationModal(false)
                  setSelectedCourseForEvaluation(null)
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Course Creation/Editing */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 my-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800">
                {editingCourse ? 'Editar Curso' : 'Crear Curso'}
              </h2>
              {loadingCourseData && (
                <div className="flex items-center text-slate-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600 mr-2"></div>
                  Cargando datos...
                </div>
              )}
            </div>

            {loadingCourseData ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(handleCreateOrUpdate)} className="space-y-6">
                {/* Hidden field for activity_type */}
                <input type="hidden" {...register('activity_type')} />

                {/* Show selected activity type */}
                {!editingCourse && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {watchActivityType === 'full_course' && (
                        <>
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">Curso Completo</p>
                            <p className="text-xs text-slate-600">Con módulos y lecciones</p>
                          </div>
                        </>
                      )}
                      {watchActivityType === 'topic' && (
                        <>
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <FileText className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">Evaluación</p>
                            <p className="text-xs text-slate-600">Solo evaluación</p>
                          </div>
                        </>
                      )}
                      {watchActivityType === 'attendance_only' && (
                        <>
                          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">Lista de Asistencia</p>
                            <p className="text-xs text-slate-600">Solo firma</p>
                          </div>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false)
                        setShowTypeSelector(true)
                      }}
                      className="text-sm text-slate-600 hover:text-slate-800 underline"
                    >
                      Cambiar tipo
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Título {watchActivityType === 'full_course' ? 'del Curso' : watchActivityType === 'topic' ? 'del Tema' : 'de la Lista'}
                    </label>
                    <input
                      {...register('title', { required: 'El título es requerido' })}
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                      placeholder="Título"
                    />
                    {errors.title && (
                      <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nº de Horas
                    </label>
                    <input
                      {...register('hours', {
                        required: 'Las horas son requeridas',
                        min: { value: 1, message: 'Debe ser mayor a 0' }
                      })}
                      type="number"
                      min="1"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                      placeholder="8"
                    />
                    {errors.hours && (
                      <p className="text-red-500 text-xs mt-1">{errors.hours.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Instructor
                  </label>
                  <select
                    {...register('instructor_id', { required: 'El instructor es requerido' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  >
                    <option value="">Seleccionar instructor</option>
                    {instructors.map((instructor) => (
                      <option key={instructor.id} value={instructor.id}>
                        {instructor.name}
                      </option>
                    ))}
                  </select>
                  {errors.instructor_id && (
                    <p className="text-red-500 text-xs mt-1">{errors.instructor_id.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    {...register('description')}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    placeholder="Descripción del curso"
                  />
                </div>

                {/* Course Image */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Imagen del Curso {editingCourse ? '(opcional - subir nueva para cambiar)' : ''}
                  </label>
                  
                  {/* Show current image if editing */}
                  {editingCourse?.image_url && (
                    <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800 mb-2">📷 Imagen actual:</p>
                      <img 
                        src={editingCourse.image_url} 
                        alt="Imagen actual del curso"
                        className="h-20 w-auto border rounded"
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {uploadProgress.courseImage !== undefined ? (
                          <div className="flex flex-col items-center">
                            <div className="w-16 h-16 border-4 border-slate-200 rounded-full flex items-center justify-center mb-2">
                              <div className="text-slate-600 font-medium">
                                {uploadProgress.courseImage}%
                              </div>
                            </div>
                            <div className="w-32 bg-slate-200 rounded-full h-2 mb-2">
                              <div 
                                className="bg-slate-600 h-2 rounded-full transition-all duration-300" 
                                style={{ width: `${uploadProgress.courseImage}%` }}
                              />
                            </div>
                            <p className="text-sm text-slate-600">
                              {uploadProgress.courseImage === 100 ? '✅ Imagen subida' : 'Subiendo imagen...'}
                            </p>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 mb-2 text-slate-400" />
                            <p className="mb-2 text-sm text-slate-500">
                              <span className="font-semibold">Haz clic para subir</span> {editingCourse ? 'nueva ' : ''}imagen
                            </p>
                            <p className="text-xs text-slate-500">PNG, JPG (recomendado: 1200x600)</p>
                          </>
                        )}
                      </div>
                      <input
                        {...register('image', { 
                          required: editingCourse ? false : 'La imagen es requerida'
                        })}
                        type="file"
                        className="hidden"
                        accept="image/*"
                      />
                    </label>
                  </div>
                  {errors.image && (
                    <p className="text-red-500 text-xs mt-1">{errors.image.message}</p>
                  )}
                </div>

                {/* Status and Evaluation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <input
                      {...register('is_active')}
                      type="checkbox"
                      className="h-4 w-4 text-slate-600 focus:ring-slate-500 border-slate-300 rounded"
                      defaultChecked={true}
                    />
                    <label className="ml-2 block text-sm text-slate-900">
                      Activo
                    </label>
                  </div>

                  {watchActivityType !== 'attendance_only' && (
                    <div className="flex items-center">
                      <input
                        {...register('requires_evaluation')}
                        type="checkbox"
                        className="h-4 w-4 text-slate-600 focus:ring-slate-500 border-slate-300 rounded"
                        defaultChecked={watchActivityType === 'topic'}
                        disabled={watchActivityType === 'topic'}
                      />
                      <label className="ml-2 block text-sm text-slate-900">
                        Requiere evaluación {watchActivityType === 'topic' && '(obligatorio para temas)'}
                      </label>
                    </div>
                  )}
                </div>

                {/* Info box for selected type */}
                {watchActivityType === 'topic' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800">
                      <strong>Tema:</strong> Los participantes tendrán acceso directo a un botón "Tomar Evaluación". No se requieren módulos ni lecciones.
                    </p>
                  </div>
                )}

                {watchActivityType === 'attendance_only' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <p className="text-sm text-orange-800">
                      <strong>Lista de Asistencia:</strong> Los participantes solo firmarán asistencia. No se genera certificado ni constancia.
                    </p>
                  </div>
                )}

                {/* Modules and Lessons - Only for full_course */}
                {watchActivityType === 'full_course' && (
                  <div className="border-t pt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-slate-800">
                        {editingCourse ? 'Editar Módulos y Lecciones' : 'Módulos y Lecciones'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => appendModule({
                          title: '',
                          description: '',
                          lessons: [{ title: '', content: '', video: null, duration_minutes: 0 }]
                        })}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm"
                      >
                        + Agregar Módulo
                      </button>
                    </div>

                    {moduleFields.map((module, moduleIndex) => (
                      <ModuleForm
                        key={module.id}
                        moduleIndex={moduleIndex}
                        register={register}
                        control={control}
                        errors={errors}
                        editingCourse={editingCourse}
                        uploadProgress={uploadProgress}
                        onRemove={() => removeModule(moduleIndex)}
                        canRemove={moduleFields.length > 1}
                      />
                    ))}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex space-x-3 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false)
                      setEditingCourse(null)
                      reset()
                    }}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || uploading}
                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {isSubmitting || uploading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto"></div>
                    ) : (
                      editingCourse ? 'Actualizar' : 'Crear Curso'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Subcomponent for Module Form
interface ModuleFormProps {
  moduleIndex: number
  register: any
  control: any
  errors: any
  editingCourse: Course | null
  uploadProgress: { [key: string]: number }
  onRemove: () => void
  canRemove: boolean
}

function ModuleForm({ moduleIndex, register, control, errors, editingCourse, uploadProgress, onRemove, canRemove }: ModuleFormProps) {
  const { fields: lessonFields, append: appendLesson, remove: removeLesson } = useFieldArray({
    control,
    name: `modules.${moduleIndex}.lessons`
  })

  const watchModule = control._formValues?.modules?.[moduleIndex]
  const isEditingLesson = (lessonIndex: number) => {
    return watchModule?.lessons?.[lessonIndex]?.video_url ? true : false
  }

  return (
    <div className="border rounded-lg p-4 mb-4 bg-slate-50">
      <div className="flex justify-between items-start mb-4">
        <h4 className="text-md font-medium text-slate-800">Módulo {moduleIndex + 1}</h4>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Título del Módulo
          </label>
          <input
            {...register(`modules.${moduleIndex}.title`, { required: 'El título es requerido' })}
            type="text"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            placeholder="Título del módulo"
          />
          {errors.modules?.[moduleIndex]?.title && (
            <p className="text-red-500 text-xs mt-1">
              {errors.modules[moduleIndex].title.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Descripción del Módulo
          </label>
          <input
            {...register(`modules.${moduleIndex}.description`)}
            type="text"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            placeholder="Descripción del módulo"
          />
        </div>
      </div>

      {/* Lessons */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h5 className="text-sm font-medium text-slate-700">Lecciones</h5>
          <button
            type="button"
            onClick={() => appendLesson({ title: '', content: '', video: null, duration_minutes: 0 })}
            className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded text-xs"
          >
            + Lección
          </button>
        </div>

        {lessonFields.map((lesson, lessonIndex) => (
          <div key={lesson.id} className="border rounded p-3 bg-white">
            <div className="flex justify-between items-start mb-3">
              <h6 className="text-sm font-medium text-slate-700">
                Lección {lessonIndex + 1}
              </h6>
              {lessonFields.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLesson(lessonIndex)}
                  className="text-red-600 hover:text-red-900 text-xs"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Título de la Lección
                </label>
                <input
                  {...register(`modules.${moduleIndex}.lessons.${lessonIndex}.title`, { 
                    required: 'El título es requerido' 
                  })}
                  type="text"
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                  placeholder="Título de la lección"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Contenido de la Lección (opcional)
                </label>
                <textarea
                  {...register(`modules.${moduleIndex}.lessons.${lessonIndex}.content`)}
                  rows={3}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                  placeholder="Contenido de la lección"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Video de la Lección (opcional) {isEditingLesson(lessonIndex) ? '- subir nuevo para cambiar' : ''}
                  </label>
                  
                  {/* Show current video info if editing */}
                  {isEditingLesson(lessonIndex) && watchModule?.lessons?.[lessonIndex]?.video_url && (
                    <div className="mb-2 p-2 bg-blue-50 rounded text-xs text-blue-800">
                      📹 Video actual disponible - sube un nuevo archivo solo si quieres reemplazarlo
                    </div>
                  )}
                  
                  {/* Upload progress or file input */}
                  {(() => {
                    const progressKey = editingCourse 
                      ? `video-edit-${moduleIndex}-${lessonIndex}`
                      : `video-${moduleIndex}-${lessonIndex}`
                    const progress = uploadProgress[progressKey]
                    
                    return progress !== undefined ? (
                      <div className="border border-slate-300 rounded p-3 bg-slate-50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-600">Subiendo video...</span>
                          <span className="text-xs font-medium text-slate-800">{progress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div 
                            className="bg-slate-600 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        {progress === 100 && (
                          <div className="text-xs text-green-600 mt-1">
                            ✅ Video subido correctamente
                          </div>
                        )}
                      </div>
                    ) : (
                      <input
                        {...register(`modules.${moduleIndex}.lessons.${lessonIndex}.video`)}
                        type="file"
                        accept="video/*"
                        className="w-full text-xs border border-slate-300 rounded p-1"
                      />
                    )
                  })()}
                  
                  {errors.modules?.[moduleIndex]?.lessons?.[lessonIndex]?.video && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.modules[moduleIndex].lessons[lessonIndex].video.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Duración (minutos)
                  </label>
                  <input
                    {...register(`modules.${moduleIndex}.lessons.${lessonIndex}.duration_minutes`, {
                      required: 'La duración es requerida',
                      min: { value: 1, message: 'Mínimo 1 minuto' }
                    })}
                    type="number"
                    min="1"
                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}