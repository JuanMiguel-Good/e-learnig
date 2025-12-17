import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { BookOpen, Play, FileText, CheckCircle, Clock, X, Award, ChevronDown, ChevronRight, PlayCircle, Star } from 'lucide-react'
import { CertificateGenerator } from '../../lib/certificateGenerator'
import TakeEvaluation from './TakeEvaluation'
import SignAttendance from './SignAttendance'
import toast from 'react-hot-toast'

interface Course {
  id: string
  title: string
  description: string | null
  image_url: string | null
  progress: number
  activity_type: 'full_course' | 'topic' | 'attendance_only'
  requires_evaluation: boolean
  modules: Module[]
}

interface Module {
  id: string
  title: string
  description: string | null
  order_index: number
  lessons: Lesson[]
}

interface Lesson {
  id: string
  title: string
  content: string
  video_url: string
  order_index: number
  duration_minutes: number
  completed: boolean
  can_access: boolean
}

export default function MyCourses() {
  const { user } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [generatingCertificate, setGeneratingCertificate] = useState<string | null>(null)
  const [showEvaluation, setShowEvaluation] = useState<string | null>(null)
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | null>(null)
  const [courseEvaluations, setCourseEvaluations] = useState<{ [key: string]: any[] }>({})
  const [showSignature, setShowSignature] = useState<string | null>(null)
  const [evaluationAttemptId, setEvaluationAttemptId] = useState<string | null>(null)
  const [evaluationStatuses, setEvaluationStatuses] = useState<{ [key: string]: { canTake: boolean, hasPassed: boolean, required: boolean } }>({})
  const [signatureStatuses, setSignatureStatuses] = useState<{ [key: string]: boolean }>({})
  const [activityFilter, setActivityFilter] = useState<'all' | 'full_course' | 'topic' | 'attendance_only'>('all')

  useEffect(() => {
    if (user) {
      loadCourses()
    }
  }, [user])

  const loadCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('course_assignments')
        .select(`
          course_id,
          courses!inner (
            id,
            title,
            description,
            image_url,
            activity_type,
            requires_evaluation,
            modules (
              id,
              title,
              description,
              order_index,
              lessons (
                id,
                title,
                content,
                video_url,
                order_index,
                duration_minutes
              )
            )
          )
        `)
        .eq('user_id', user?.id)

      if (error) throw error

      // Process courses with progress calculation
      const processedCourses = await Promise.all(
        (data || []).map(async (assignment: any) => {
          const course = assignment.courses
          
          // Get lesson progress for this user
          const { data: progressData } = await supabase
            .from('lesson_progress')
            .select('lesson_id, completed')
            .eq('user_id', user?.id)

          const completedLessons = new Set(
            (progressData || [])
              .filter(p => p.completed)
              .map(p => p.lesson_id)
          )

          // Calculate progress and determine accessibility
          let totalLessons = 0
          let completedCount = 0
          let previousLessonCompleted = true

          // Sort modules and lessons
          const sortedModules = course.modules
            .sort((a: any, b: any) => a.order_index - b.order_index)
            .map((module: any) => {
              const sortedLessons = module.lessons
                .sort((a: any, b: any) => a.order_index - b.order_index)
                .map((lesson: any) => {
                  totalLessons++
                  const isCompleted = completedLessons.has(lesson.id)
                  if (isCompleted) completedCount++

                  const canAccess = previousLessonCompleted
                  if (!isCompleted) previousLessonCompleted = false

                  return {
                    ...lesson,
                    completed: isCompleted,
                    can_access: canAccess
                  }
                })

              return {
                ...module,
                lessons: sortedLessons
              }
            })

          const progress = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

          return {
            ...course,
            progress,
            modules: sortedModules
          }
        })
      )

      setCourses(processedCourses)

      // Load evaluation statuses for all courses
      const statuses: { [key: string]: { canTake: boolean, hasPassed: boolean, required: boolean } } = {}
      const evaluationsMap: { [key: string]: any[] } = {}

      for (const course of processedCourses) {
        const evalStatus = await checkEvaluationStatus(course.id)
        statuses[course.id] = {
          canTake: evalStatus.canTakeEvaluation,
          hasPassed: evalStatus.hasPassedEvaluation,
          required: evalStatus.requiresEvaluation
        }

        // Load all active evaluations for this course
        if (course.requires_evaluation) {
          const evals = await loadCourseEvaluations(course.id)
          evaluationsMap[course.id] = evals
        }
      }
      setEvaluationStatuses(statuses)
      setCourseEvaluations(evaluationsMap)

      // Load signature statuses for attendance_only courses
      const sigStatuses: { [key: string]: boolean } = {}
      for (const course of processedCourses) {
        if (course.activity_type === 'attendance_only') {
          const hasSigned = await checkAttendanceSignatureStatus(course.id)
          sigStatuses[course.id] = hasSigned
        }
      }
      setSignatureStatuses(sigStatuses)
    } catch (error) {
      console.error('Error loading courses:', error)
      toast.error('Error al cargar cursos')
    } finally {
      setIsLoading(false)
    }
  }

  const markLessonComplete = async (lessonId: string, courseId: string) => {
    try {
      // Mark lesson as completed
      const { error } = await supabase
        .from('lesson_progress')
        .upsert([
          {
            user_id: user?.id,
            lesson_id: lessonId,
            completed: true,
            completed_at: new Date().toISOString()
          }
        ], {
          onConflict: 'user_id,lesson_id'
        })

      if (error) {
        throw error
      }

      toast.success('¡Lección completada!')
      // Update selectedLesson if it's the current one
      if (selectedLesson && selectedLesson.id === lessonId) {
        setSelectedLesson({
          ...selectedLesson,
          completed: true
        })
      }
      
      // Update courses state immediately
      setCourses(prevCourses => {
        return prevCourses.map(course => {
          if (course.id !== courseId) return course
          
          let totalLessons = 0
          let completedCount = 0
          let previousLessonCompleted = true
          
          const updatedModules = course.modules.map(module => {
            const updatedLessons = module.lessons.map(lesson => {
              totalLessons++
              const isCompleted = lesson.id === lessonId ? true : lesson.completed
              if (isCompleted) completedCount++
              
              const canAccess = previousLessonCompleted
              if (!isCompleted) previousLessonCompleted = false
              
              return {
                ...lesson,
                completed: isCompleted,
                can_access: canAccess
              }
            })
            
            return {
              ...module,
              lessons: updatedLessons
            }
          })
          
          const progress = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0
          
          return {
            ...course,
            progress,
            modules: updatedModules
          }
        })
      })
      
      // Update selectedCourse if it's the current one
      if (selectedCourse && selectedCourse.id === courseId) {
        const updatedCourse = courses.find(c => c.id === courseId)
        if (updatedCourse) {
          // Calculate new progress for the selected course
          let totalLessons = 0
          let completedCount = 0
          let previousLessonCompleted = true
          
          const updatedModules = selectedCourse.modules.map(module => {
            const updatedLessons = module.lessons.map(lesson => {
              totalLessons++
              const isCompleted = lesson.id === lessonId ? true : lesson.completed
              if (isCompleted) completedCount++
              
              const canAccess = previousLessonCompleted
              if (!isCompleted) previousLessonCompleted = false
              
              return {
                ...lesson,
                completed: isCompleted,
                can_access: canAccess
              }
            })
            
            return {
              ...module,
              lessons: updatedLessons
            }
          })
          
          const progress = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0
          
          setSelectedCourse({
            ...selectedCourse,
            progress,
            modules: updatedModules
          })
        }
      }
      
    } catch (error) {
      console.error('Error completing lesson:', error)
      toast.error('Error al completar lección')
    }
  }

  const loadCourseEvaluations = async (courseId: string) => {
    if (!user) return []

    try {
      // Get the single active evaluation for this course
      const { data: evaluation, error } = await supabase
        .from('evaluations')
        .select('id, title, description, passing_score, max_attempts, is_active')
        .eq('course_id', courseId)
        .eq('is_active', true)
        .maybeSingle()

      if (error) throw error
      if (!evaluation) return []

      // Get user attempts for this evaluation
      const { data: attemptsData } = await supabase
        .from('evaluation_attempts')
        .select('passed, attempt_number, score')
        .eq('user_id', user.id)
        .eq('evaluation_id', evaluation.id)
        .order('attempt_number', { ascending: false })

      const hasPassedEvaluation = attemptsData?.some(attempt => attempt.passed) || false
      const canTakeEvaluation = !hasPassedEvaluation &&
        (attemptsData?.length || 0) < evaluation.max_attempts
      const attemptCount = attemptsData?.length || 0

      return [{
        ...evaluation,
        hasPassedEvaluation,
        canTakeEvaluation,
        attemptCount,
        lastScore: attemptsData?.[0]?.score || null
      }]
    } catch (error) {
      console.error('Error loading course evaluations:', error)
      return []
    }
  }

  const checkEvaluationStatus = async (courseId: string) => {
    if (!user) return { canTakeEvaluation: false, hasPassedEvaluation: false, requiresEvaluation: false }

    try {
      // Check if course requires evaluation
      const { data: courseData } = await supabase
        .from('courses')
        .select('requires_evaluation')
        .eq('id', courseId)
        .maybeSingle()

      if (!courseData?.requires_evaluation) {
        return { canTakeEvaluation: false, hasPassedEvaluation: false, requiresEvaluation: false }
      }

      // Get the single active evaluation for this course
      const { data: evaluation } = await supabase
        .from('evaluations')
        .select('id, max_attempts')
        .eq('course_id', courseId)
        .eq('is_active', true)
        .maybeSingle()

      if (!evaluation) {
        return { canTakeEvaluation: false, hasPassedEvaluation: false, requiresEvaluation: true }
      }

      // Check user's attempts for this evaluation
      const { data: attemptsData } = await supabase
        .from('evaluation_attempts')
        .select('passed, attempt_number')
        .eq('user_id', user.id)
        .eq('evaluation_id', evaluation.id)

      const hasPassed = attemptsData?.some(attempt => attempt.passed) || false
      const canTake = !hasPassed && (attemptsData?.length || 0) < evaluation.max_attempts

      return {
        canTakeEvaluation: canTake,
        hasPassedEvaluation: hasPassed,
        requiresEvaluation: true
      }
    } catch (error) {
      console.error('Error checking evaluation status:', error)
      return { canTakeEvaluation: false, hasPassedEvaluation: false, requiresEvaluation: false }
    }
  }

  const generateCertificate = async (course: Course) => {
    if (!user) return;

    // Block certificate generation for attendance_only activities
    if (course.activity_type === 'attendance_only') {
      toast.error('No se generan certificados para listas de asistencia');
      return;
    }

    try {
      setGeneratingCertificate(course.id);

      // Check evaluation status first
      const evaluationStatus = await checkEvaluationStatus(course.id);

      if (evaluationStatus.requiresEvaluation && !evaluationStatus.hasPassedEvaluation) {
        if (evaluationStatus.canTakeEvaluation) {
          toast.error('Debes aprobar la evaluación antes de generar el certificado');
          setShowEvaluation(course.id);
          return;
        } else {
          toast.error('No puedes generar el certificado sin aprobar la evaluación');
          return;
        }
      }

      // Check if signature is required
      const signatureStatus = await checkSignatureStatus(course.id);
      if (signatureStatus.needsSignature) {
        toast.error('Debes firmar la lista de asistencia antes de generar el certificado');
        setEvaluationAttemptId(signatureStatus.attemptId);
        setShowSignature(course.id);
        return;
      }

      // Get course with instructor info
      const { data: courseData, error } = await supabase
        .from('courses')
        .select(`
          *,
          instructor:instructors(name, signature_url)
        `)
        .eq('id', course.id)
        .single();

      if (error) throw error;

      const certificateData = {
        userName: `${user.first_name} ${user.last_name}`,
        courseName: courseData.title,
        instructorName: courseData.instructor?.name || 'Instructor',
        instructorSignature: courseData.instructor?.signature_url,
        completionDate: new Date().toISOString()
      };

      // Generate certificate
      const certificateBase64 = await CertificateGenerator.generateCertificate(certificateData)

      // Save certificate
      const certificateUrl = await CertificateGenerator.saveCertificate(
        user.id,
        course.id,
        certificateBase64
      )

      if (certificateUrl) {
        toast.success('¡Certificado generado exitosamente!')

        // Download the certificate
        window.open(certificateUrl, '_blank')
      };
    } catch (error) {
      console.error('Error generating certificate:', error)
      toast.error('Error al generar certificado')
    } finally {
      setGeneratingCertificate(null)
    }
  }

  const checkSignatureStatus = async (courseId: string): Promise<{ needsSignature: boolean, attemptId: string | null }> => {
    if (!user) return { needsSignature: false, attemptId: null };

    try {
      // Check if course requires evaluation
      const { data: courseData } = await supabase
        .from('courses')
        .select('requires_evaluation')
        .eq('id', courseId)
        .single()

      // If course doesn't require evaluation, no signature needed
      if (!courseData?.requires_evaluation) return { needsSignature: false, attemptId: null };

      // Get the evaluation for this course
      const { data: evaluationData } = await supabase
        .from('evaluations')
        .select('id')
        .eq('course_id', courseId)
        .eq('is_active', true)
        .maybeSingle()

      if (!evaluationData) return { needsSignature: false, attemptId: null };

      // Check if user has a passed evaluation attempt
      const { data: passedAttempt } = await supabase
        .from('evaluation_attempts')
        .select('id')
        .eq('user_id', user.id)
        .eq('evaluation_id', evaluationData.id)
        .eq('passed', true)
        .maybeSingle()

      if (!passedAttempt) return { needsSignature: false, attemptId: null };

      // Check if user has already signed for this evaluation attempt
      const { data: existingSignature } = await supabase
        .from('attendance_signatures')
        .select('id')
        .eq('evaluation_attempt_id', passedAttempt.id)
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle()

      return {
        needsSignature: !existingSignature,
        attemptId: passedAttempt.id
      };
    } catch (error) {
      console.error('Error checking signature status:', error)
      return { needsSignature: false, attemptId: null };
    }
  }

  const checkAttendanceSignatureStatus = async (courseId: string) => {
    if (!user) return false;

    try {
      // Check if user has signed for this specific course
      const { data: existingSignature } = await supabase
        .from('attendance_signatures')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .is('evaluation_attempt_id', null)
        .maybeSingle()

      return !!existingSignature;
    } catch (error) {
      console.error('Error checking attendance signature status:', error)
      return false;
    }
  }

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev)
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId)
      } else {
        newSet.add(moduleId)
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

  // Show evaluation if requested
  if (showEvaluation && selectedEvaluationId) {
    return (
      <TakeEvaluation
        evaluationId={selectedEvaluationId}
        onComplete={(attemptId) => {
          if (attemptId) {
            // Si aprobó, redirigir a firma
            setEvaluationAttemptId(attemptId)
            setShowSignature(showEvaluation)
            setShowEvaluation(null)
            setSelectedEvaluationId(null)
          } else {
            setShowEvaluation(null)
            setSelectedEvaluationId(null)
            loadCourses() // Reload to update progress
          }
        }}
        onBack={() => {
          setShowEvaluation(null)
          setSelectedEvaluationId(null)
        }}
      />
    )
  }

  // Show signature if requested
  if (showSignature) {
    return (
      <SignAttendance
        courseId={showSignature}
        evaluationAttemptId={evaluationAttemptId || undefined}
        onComplete={async () => {
          const courseId = showSignature
          setShowSignature(null)
          setEvaluationAttemptId(null)
          toast.success('Firma completada correctamente')

          // Update signature status for this course
          const hasSigned = await checkAttendanceSignatureStatus(courseId)
          setSignatureStatuses(prev => ({
            ...prev,
            [courseId]: hasSigned
          }))

          loadCourses()
        }}
        onCancel={() => {
          setShowSignature(null)
          setEvaluationAttemptId(null)
        }}
      />
    )
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-800">Mis Cursos</h1>
        <p className="text-sm md:text-base text-slate-600">Continúa con tu aprendizaje</p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 cards-grid">
        {courses.filter(course => activityFilter === 'all' || course.activity_type === activityFilter).map((course) => {
          const activityTypeConfig = {
            full_course: { label: 'Curso', color: 'blue', icon: BookOpen },
            topic: { label: 'Evaluación', color: 'green', icon: FileText },
            attendance_only: { label: 'Lista', color: 'orange', icon: CheckCircle }
          }
          const config = activityTypeConfig[course.activity_type]
          const Icon = config.icon

          return (
            <div key={course.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-all ${
              course.activity_type === 'full_course' ? 'cursor-pointer' : ''
            } ${
              course.progress === 100
                ? 'ring-2 ring-green-200 border-green-300'
                : course.progress > 0
                ? 'ring-2 ring-blue-200 border-blue-300'
                : 'hover:border-slate-400'
            }`}>
              <div onClick={() => course.activity_type === 'full_course' && setSelectedCourse(course)}>
                {course.image_url && (
                  <img
                    src={course.image_url}
                    alt={course.title}
                    className="w-full h-32 md:h-48 object-cover relative"
                  />
                )}
                <div className="p-4 md:p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-base md:text-lg font-semibold text-slate-800 flex-1">
                      {course.title}
                    </h3>
                    <span className={`ml-2 px-2 py-1 text-xs rounded-full bg-${config.color}-100 text-${config.color}-800 flex-shrink-0`}>
                      {config.label}
                    </span>
                  </div>

                  {course.description && (
                    <p className="text-slate-600 text-xs md:text-sm mb-4 line-clamp-2">
                      {course.description}
                    </p>
                  )}

                  {/* Full Course: Progress Bar */}
                  {course.activity_type === 'full_course' && (
                    <>
                      <div className="mb-4">
                        <div className="flex justify-between text-xs md:text-sm text-slate-600 mb-1">
                          <span>Progreso</span>
                          <span>{course.progress}%</span>
                        </div>
                        <div className={`w-full rounded-full h-2 ${
                          course.progress === 100
                            ? 'bg-green-100'
                            : course.progress > 0
                            ? 'bg-blue-100'
                            : 'bg-slate-200'
                        }`}>
                          <div
                            className={`h-2 rounded-full transition-all ${
                              course.progress === 100
                                ? 'bg-green-500'
                                : course.progress > 0
                                ? 'bg-blue-500'
                                : 'bg-slate-400'
                            }`}
                            style={{ width: `${course.progress}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center text-xs md:text-sm text-slate-500">
                        <BookOpen className="w-4 h-4 mr-1" />
                        {course.modules.length} módulo{course.modules.length !== 1 ? 's' : ''}
                        {course.progress === 100 && (
                          <div className="ml-auto flex items-center text-green-600 text-xs">
                            <Star className="w-4 h-4 mr-1 fill-current" />
                            <span className="font-medium">Finalizado</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Topic: Evaluation Selector Button */}
                  {course.activity_type === 'topic' && (
                    <>
                      {evaluationStatuses[course.id]?.hasPassed ? (
                        <div className="space-y-2 mt-2">
                          <div className="w-full px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium flex items-center justify-center text-sm">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Evaluación Aprobada
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              generateCertificate(course)
                            }}
                            disabled={generatingCertificate === course.id}
                            className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {generatingCertificate === course.id ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Generando...
                              </>
                            ) : (
                              <>
                                <Award className="w-4 h-4 mr-2" />
                                Generar Certificado
                              </>
                            )}
                          </button>
                        </div>
                      ) : evaluationStatuses[course.id]?.canTake ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const activeEvaluation = courseEvaluations[course.id]?.[0]
                            if (activeEvaluation) {
                              setSelectedEvaluationId(activeEvaluation.id)
                              setShowEvaluation(course.id)
                            }
                          }}
                          className="w-full mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center text-sm"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Tomar Evaluación
                        </button>
                      ) : (
                        <div className="w-full mt-2 px-4 py-2 bg-red-100 text-red-800 rounded-lg font-medium flex items-center justify-center text-sm">
                          <X className="w-4 h-4 mr-2" />
                          Sin intentos disponibles
                        </div>
                      )}
                    </>
                  )}

                  {/* Attendance Only: Direct Sign Button */}
                  {course.activity_type === 'attendance_only' && (
                    signatureStatuses[course.id] ? (
                      <div className="w-full mt-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium flex items-center justify-center text-sm">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Firmado
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowSignature(course.id)
                        }}
                        className="w-full mt-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center text-sm"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Firmar Asistencia
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {courses.length === 0 && (
        <div className="text-center py-8 md:py-12">
          <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm md:text-base font-medium text-slate-900">No tienes cursos asignados</h3>
          <p className="mt-1 text-xs md:text-sm text-slate-500">Contacta al administrador para que te asigne cursos.</p>
        </div>
      )}

      {courses.length > 0 && courses.filter(course => activityFilter === 'all' || course.activity_type === activityFilter).length === 0 && (
        <div className="text-center py-8 md:py-12">
          <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm md:text-base font-medium text-slate-900">
            No hay {activityFilter === 'full_course' ? 'cursos' : activityFilter === 'topic' ? 'evaluaciones' : activityFilter === 'attendance_only' ? 'listas de asistencia' : 'actividades'} disponibles
          </h3>
          <p className="mt-1 text-xs md:text-sm text-slate-500">Intenta con otro filtro.</p>
        </div>
      )}

      {/* Course Detail Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 md:p-4 z-50 overflow-y-auto no-scrollbar">
          <div className="bg-white md:rounded-xl shadow-xl w-full md:max-w-6xl max-h-screen overflow-y-auto md:my-8 modal-content">
            <div className="p-4 md:p-6 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-slate-800 pr-8">{selectedCourse.title}</h2>
                  <div className="flex flex-col md:flex-row md:items-center mt-2 space-y-2 md:space-y-0 md:space-x-4">
                    <div className="flex items-center">
                      <div className="w-24 md:w-32 bg-slate-200 rounded-full h-2 mr-3">
                        <div 
                          className="bg-slate-800 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${selectedCourse.progress}%` }}
                        />
                      </div>
                      <span className="text-slate-600 text-xs md:text-sm font-medium">{selectedCourse.progress}%</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCourse(null)}
                  className="text-slate-400 hover:text-slate-600 absolute top-4 right-4 md:static"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>

            {/* Certificate Generation Banner - Only for full_course and topic */}
            {selectedCourse.progress === 100 &&
             selectedCourse.activity_type !== 'attendance_only' &&
             (!evaluationStatuses[selectedCourse.id]?.required || evaluationStatuses[selectedCourse.id]?.hasPassed) && (
              <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-b border-yellow-200 p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0">
                  <div className="flex items-center">
                    <Award className="w-6 h-6 md:w-8 md:h-8 text-yellow-600 mr-3 flex-shrink-0" />
                    <div>
                      <h3 className="text-base md:text-lg font-bold text-yellow-800">
                        ¡Felicitaciones!
                      </h3>
                      <p className="text-sm md:text-base text-yellow-700">
                        Has completado el curso "{selectedCourse.title}"
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => generateCertificate(selectedCourse)}
                    disabled={generatingCertificate === selectedCourse.id}
                    className="px-4 md:px-6 py-2 md:py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm md:text-base"
                  >
                    {generatingCertificate === selectedCourse.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 md:h-5 md:w-5 border-b-2 border-white mr-2"></div>
                        Generando...
                      </>
                    ) : (
                      <>
                        <Award className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
                        <span className="hidden sm:inline">Generar </span>Certificado
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
            
            {/* Evaluation Button for courses requiring evaluation */}
            {selectedCourse.progress === 100 &&
             evaluationStatuses[selectedCourse.id]?.required &&
             !evaluationStatuses[selectedCourse.id]?.hasPassed && (
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0">
                  <div>
                    <h3 className="text-base md:text-lg font-bold text-blue-800">
                      Evaluación Requerida
                    </h3>
                    <p className="text-sm md:text-base text-blue-700">
                      Este curso requiere aprobar una evaluación antes de obtener el certificado
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      const evaluationStatus = await checkEvaluationStatus(selectedCourse.id);
                      if (evaluationStatus.requiresEvaluation) {
                        if (evaluationStatus.hasPassedEvaluation) {
                          toast.success('Ya aprobaste una evaluación de este curso');
                        } else if (evaluationStatus.canTakeEvaluation) {
                          setShowEvaluationSelector(selectedCourse.id);
                        } else {
                          toast.error('No tienes más intentos disponibles');
                        }
                      }
                    }}
                    className="px-4 md:px-6 py-2 md:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center text-sm md:text-base"
                  >
                    Ver Evaluaciones
                  </button>
                </div>
              </div>
            )}
            
            {/* Course Content */}
            <div className="flex flex-col md:flex-row">
              {/* Modules Sidebar */}
              <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r bg-slate-50 p-4 md:p-6 mobile-no-overflow md:max-h-96 md:overflow-y-auto no-scrollbar">
                <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-3 md:mb-4">Contenido del Curso</h3>
                <div className="space-y-1 md:space-y-2">
                  {selectedCourse.modules.map((module, moduleIndex) => (
                    <div key={module.id} className="border-b border-slate-200 pb-1 md:pb-2">
                      <button
                        onClick={() => toggleModule(module.id)}
                        className="w-full text-left p-1 md:p-2 hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center">
                          {expandedModules.has(module.id) ? (
                            <ChevronDown className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 text-slate-600 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 text-slate-600 flex-shrink-0" />
                          )}
                          <span className="text-sm md:text-base font-medium text-slate-800 line-clamp-2">
                            Módulo {moduleIndex + 1}: {module.title}
                          </span>
                        </div>
                      </button>
                      
                      {expandedModules.has(module.id) && (
                        <div className="ml-4 md:ml-6 space-y-1 mt-1 md:mt-2">
                          {module.lessons.map((lesson, lessonIndex) => (
                            <button
                              key={lesson.id}
                              onClick={() => lesson.can_access && setSelectedLesson(lesson)}
                              disabled={!lesson.can_access}
                              className={`w-full text-left p-1 md:p-2 rounded text-sm transition-colors flex items-start ${
                                lesson.can_access
                                  ? selectedLesson?.id === lesson.id
                                    ? 'bg-slate-200 text-slate-900'
                                    : 'hover:bg-slate-100 text-slate-700'
                                  : 'text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center mr-1 md:mr-2 flex-shrink-0 mt-0.5 ${
                                lesson.completed 
                                  ? 'bg-green-100 text-green-600'
                                  : lesson.can_access
                                  ? 'bg-blue-100 text-blue-600'
                                  : 'bg-slate-100 text-slate-400'
                              }`}>
                                {lesson.completed ? (
                                  <CheckCircle className="w-2 h-2 md:w-3 md:h-3" />
                                ) : lesson.can_access ? (
                                  <Play className="w-2 h-2 md:w-3 md:h-3" />
                                ) : (
                                  <Clock className="w-2 h-2 md:w-3 md:h-3" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium line-clamp-2">
                                  Lección {lessonIndex + 1}: {lesson.title}
                                </div>
                                <div className="text-slate-500 text-xs md:text-sm">
                                  {lesson.duration_minutes} min
                                  {!lesson.can_access && ' (Bloqueada)'}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Lesson Content */}
              <div className="flex-1 p-4 md:p-6">
                {selectedLesson ? (
                  <div className="space-y-4 md:space-y-6">
                    <div>
                      <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-2 line-clamp-2">{selectedLesson.title}</h3>
                      <p className="text-sm md:text-base text-slate-600">Duración: {selectedLesson.duration_minutes} minutos</p>
                    </div>

                    {/* Video */}
                    {selectedLesson.video_url && (
                      <div className="video-responsive">
                        <video 
                          controls 
                          className="w-full h-full rounded-lg video-responsive"
                          key={selectedLesson.video_url}
                        >
                          <source src={selectedLesson.video_url} type="video/mp4" />
                          <source src={selectedLesson.video_url} type="video/webm" />
                          <source src={selectedLesson.video_url} type="video/ogg" />
                          Tu navegador no soporta video HTML5.
                        </video>
                      </div>
                    )}

                    {/* Content */}
                    <div className="bg-slate-50 rounded-lg p-3 md:p-4">
                      <div className="flex items-center mb-3">
                        <FileText className="w-4 h-4 md:w-5 md:h-5 text-slate-600 mr-2" />
                        <h4 className="text-sm md:text-base font-medium text-slate-800">Contenido de la Lección</h4>
                      </div>
                      <div className="prose prose-slate max-w-none text-sm md:text-base">
                        <p className="whitespace-pre-wrap leading-relaxed">{selectedLesson.content}</p>
                      </div>
                    </div>

                    {/* Complete Lesson Button */}
                    <div className="flex justify-center pt-4 md:pt-6">
                      {!selectedLesson.completed ? (
                        <button
                          onClick={() => markLessonComplete(selectedLesson.id, selectedCourse.id)}
                          className="btn-sticky-mobile px-4 md:px-6 py-2 md:py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors text-sm md:text-base"
                        >
                          Marcar como Completada
                        </button>
                      ) : (
                        <div className="btn-sticky-mobile px-4 md:px-6 py-2 md:py-3 bg-green-100 text-green-800 rounded-lg font-medium flex items-center justify-center text-sm md:text-base">
                          <CheckCircle className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                          Lección Completada
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <BookOpen className="w-10 h-10 md:w-12 md:h-12 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-base md:text-lg font-medium text-slate-800 mb-2">
                        Selecciona una lección
                      </h3>
                      <p className="text-sm md:text-base text-slate-600">
                        Elige una lección del menú lateral para comenzar a estudiar
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}