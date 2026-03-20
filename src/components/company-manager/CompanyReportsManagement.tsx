import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  ClipboardCheck,
  User,
  Search,
  Download,
  Award,
  BookOpen,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { exportReportsToExcel } from '../../lib/reportsExporter'

interface ParticipantCourseProgress {
  participant_id: string
  first_name: string
  last_name: string
  email: string
  dni: string | null
  area: string | null
  company_name: string
  company_id: string
  course_id: string
  course_title: string
  course_image: string | null
  assigned_date: string
  started_date: string | null
  completed_date: string | null
  progress: number
  total_modules: number
  completed_modules: number
  total_lessons: number
  completed_lessons: number
  requires_evaluation: boolean
  evaluation_status: 'not_started' | 'passed' | 'failed' | 'pending'
  evaluation_score: number | null
  evaluation_attempts: number
  max_attempts: number
  signature_status: 'signed' | 'pending' | 'not_required'
  certificate_status: 'generated' | 'pending'
  certificate_url: string | null
  certificate_date: string | null
  last_activity: string | null
}

export default function CompanyReportsManagement() {
  const { user } = useAuth()
  const [participantCourses, setParticipantCourses] = useState<ParticipantCourseProgress[]>([])
  const [filteredParticipantCourses, setFilteredParticipantCourses] = useState<ParticipantCourseProgress[]>([])
  const [companyName, setCompanyName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in_progress' | 'not_started'>('all')
  const [courseFilter, setCourseFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [courses, setCourses] = useState<any[]>([])

  useEffect(() => {
    if (user?.company_id) {
      loadData()
    }
  }, [user?.company_id])

  useEffect(() => {
    applyFilters()
  }, [participantCourses, searchTerm, statusFilter, courseFilter])

  const loadData = async () => {
    if (!user?.company_id) {
      toast.error('No tienes una empresa asignada')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)

      const { data: companyData } = await supabase
        .from('companies')
        .select('razon_social')
        .eq('id', user.company_id)
        .single()

      setCompanyName(companyData?.razon_social || '')

      const { data: participants } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, dni, area')
        .eq('role', 'participant')
        .eq('company_id', user.company_id)

      if (!participants || participants.length === 0) {
        setParticipantCourses([])
        return
      }

      const participantIds = participants.map(p => p.id)

      const [
        { data: allAssignments },
        { data: allLessons },
        { data: allLessonProgress },
        { data: allEvaluations },
        { data: allAttempts },
        { data: allCertificates }
      ] = await Promise.all([
        supabase
          .from('course_assignments')
          .select('user_id, course_id, assigned_at, courses!inner(id, title, requires_evaluation)')
          .in('user_id', participantIds),
        supabase
          .from('lessons')
          .select('id, module_id, modules!inner(course_id)'),
        supabase
          .from('lesson_progress')
          .select('user_id, lesson_id, completed')
          .in('user_id', participantIds)
          .eq('completed', true),
        supabase
          .from('evaluations')
          .select('id, course_id, max_attempts')
          .eq('is_active', true),
        supabase
          .from('evaluation_attempts')
          .select('user_id, evaluation_id, passed, score')
          .in('user_id', participantIds)
          .order('completed_at', { ascending: false }),
        supabase
          .from('certificates')
          .select('user_id, course_id, certificate_url')
          .in('user_id', participantIds)
      ])

      const lessonsByCourse = new Map<string, any[]>()
      allLessons?.forEach(lesson => {
        const courseId = lesson.modules.course_id
        if (!lessonsByCourse.has(courseId)) {
          lessonsByCourse.set(courseId, [])
        }
        lessonsByCourse.get(courseId)!.push(lesson)
      })

      const progressMap = new Map()
      allLessonProgress?.forEach(p => {
        progressMap.set(`${p.user_id}-${p.lesson_id}`, true)
      })

      const evaluationsByCourse = new Map()
      allEvaluations?.forEach(e => {
        evaluationsByCourse.set(e.course_id, e)
      })

      const attemptsByUserAndEval = new Map()
      allAttempts?.forEach(a => {
        const key = `${a.user_id}-${a.evaluation_id}`
        if (!attemptsByUserAndEval.has(key)) {
          attemptsByUserAndEval.set(key, [])
        }
        attemptsByUserAndEval.get(key)!.push(a)
      })

      const certificatesMap = new Map()
      allCertificates?.forEach(c => {
        certificatesMap.set(`${c.user_id}-${c.course_id}`, c)
      })

      const uniqueCoursesMap = new Map<string, any>()
      allAssignments?.forEach((assignment: any) => {
        const course = assignment.courses
        if (!uniqueCoursesMap.has(course.id)) {
          uniqueCoursesMap.set(course.id, {
            id: course.id,
            title: course.title,
            requires_evaluation: course.requires_evaluation
          })
        }
      })

      const coursesWithAssignments = Array.from(uniqueCoursesMap.values()).sort((a, b) =>
        a.title.localeCompare(b.title)
      )
      setCourses(coursesWithAssignments)

      const progressData: ParticipantCourseProgress[] = []

      allAssignments?.forEach((assignment: any) => {
        const participant = participants.find(p => p.id === assignment.user_id)
        if (!participant) return

        const course = assignment.courses
        const courseLessons = lessonsByCourse.get(course.id) || []
        const totalLessons = courseLessons.length

        let completedLessons = 0
        courseLessons.forEach((lesson: any) => {
          if (progressMap.has(`${assignment.user_id}-${lesson.id}`)) {
            completedLessons++
          }
        })

        const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

        let evaluationStatus: 'not_started' | 'passed' | 'failed' | 'pending' = 'not_started'
        let evaluationScore: number | null = null

        if (course.requires_evaluation) {
          const evaluation = evaluationsByCourse.get(course.id)
          if (evaluation) {
            const attempts = attemptsByUserAndEval.get(`${assignment.user_id}-${evaluation.id}`) || []
            if (attempts.length > 0) {
              const bestAttempt = attempts.find((a: any) => a.passed)
              if (bestAttempt) {
                evaluationStatus = 'passed'
                evaluationScore = bestAttempt.score
              } else {
                evaluationStatus = 'failed'
                evaluationScore = attempts[0]?.score || null
              }
            } else {
              evaluationStatus = 'pending'
            }
          }
        }

        const certificate = certificatesMap.get(`${assignment.user_id}-${course.id}`)
        const certificateStatus = certificate ? 'generated' : 'pending'

        const evaluation = evaluationsByCourse.get(course.id)
        const attempts = evaluation ? attemptsByUserAndEval.get(`${assignment.user_id}-${evaluation.id}`) || [] : []

        progressData.push({
          participant_id: participant.id,
          first_name: participant.first_name,
          last_name: participant.last_name,
          email: participant.email,
          dni: participant.dni,
          area: participant.area,
          company_name: companyName,
          company_id: user.company_id!,
          course_id: course.id,
          course_title: course.title,
          course_image: null,
          assigned_date: assignment.assigned_at,
          started_date: null,
          completed_date: null,
          progress,
          total_modules: 0,
          completed_modules: 0,
          total_lessons: totalLessons,
          completed_lessons: completedLessons,
          requires_evaluation: course.requires_evaluation,
          evaluation_status: evaluationStatus,
          evaluation_score: evaluationScore,
          evaluation_attempts: attempts.length,
          max_attempts: evaluation?.max_attempts || 0,
          signature_status: 'not_required',
          certificate_status: certificateStatus,
          certificate_url: certificate?.certificate_url || null,
          certificate_date: null,
          last_activity: null
        })
      })

      setParticipantCourses(progressData)
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setIsLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = participantCourses

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(p =>
        p.first_name.toLowerCase().includes(term) ||
        p.last_name.toLowerCase().includes(term) ||
        p.email.toLowerCase().includes(term) ||
        p.dni?.toLowerCase().includes(term) ||
        p.course_title.toLowerCase().includes(term)
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => {
        if (statusFilter === 'completed') return p.progress === 100
        if (statusFilter === 'in_progress') return p.progress > 0 && p.progress < 100
        if (statusFilter === 'not_started') return p.progress === 0
        return true
      })
    }

    if (courseFilter !== 'all') {
      filtered = filtered.filter(p => p.course_id === courseFilter)
    }

    setFilteredParticipantCourses(filtered)
  }

  const handleExport = async () => {
    if (filteredParticipantCourses.length === 0) {
      toast.error('No hay datos para exportar')
      return
    }

    setIsExporting(true)
    try {
      // Crear datos de la empresa para el reporte
      const companies = [{
        company_id: user!.company_id!,
        company_name: companyName,
        total_participants: new Set(participantCourses.map(p => p.participant_id)).size,
        avg_progress: participantCourses.length > 0
          ? Math.round(participantCourses.reduce((sum, p) => sum + p.progress, 0) / participantCourses.length)
          : 0,
        total_certificates: participantCourses.filter(p => p.certificate_status === 'generated').length,
        total_courses_assigned: participantCourses.length
      }]

      await exportReportsToExcel(filteredParticipantCourses, companies)
      toast.success('Reporte exportado exitosamente')
    } catch (error) {
      console.error('Error exporting:', error)
      toast.error('Error al exportar reporte')
    } finally {
      setIsExporting(false)
    }
  }

  const getStatusBadge = (progress: number, requiresEval: boolean, evalStatus: string) => {
    if (progress === 100 && (!requiresEval || evalStatus === 'passed')) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Completado
        </span>
      )
    }
    if (progress > 0) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Clock className="w-3 h-3 mr-1" />
          En Progreso
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
        <XCircle className="w-3 h-3 mr-1" />
        No Iniciado
      </span>
    )
  }

  const stats = {
    totalAssignments: participantCourses.length,
    completed: participantCourses.filter(p => p.progress === 100 && (!p.requires_evaluation || p.evaluation_status === 'passed')).length,
    inProgress: participantCourses.filter(p => p.progress > 0 && p.progress < 100).length,
    notStarted: participantCourses.filter(p => p.progress === 0).length,
    avgProgress: participantCourses.length > 0
      ? Math.round(participantCourses.reduce((sum, p) => sum + p.progress, 0) / participantCourses.length)
      : 0,
    certificatesGenerated: participantCourses.filter(p => p.certificate_status === 'generated').length
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    )
  }

  if (!user?.company_id) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">No tienes una empresa asignada. Contacta al administrador.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reportes</h1>
          <p className="text-slate-600">Estadísticas y progreso de {companyName}</p>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting || filteredParticipantCourses.length === 0}
          className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <Download className="w-5 h-5 mr-2" />
          {isExporting ? 'Exportando...' : 'Exportar Excel'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Asignaciones</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{stats.totalAssignments}</p>
            </div>
            <BookOpen className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Completados</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.completed}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Progreso Promedio</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{stats.avgProgress}%</p>
            </div>
            <ClipboardCheck className="w-10 h-10 text-slate-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Certificados</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.certificatesGenerated}</p>
            </div>
            <Award className="w-10 h-10 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar participante o curso..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
          >
            <option value="all">Todos los estados</option>
            <option value="completed">Completados</option>
            <option value="in_progress">En progreso</option>
            <option value="not_started">No iniciados</option>
          </select>

          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
          >
            <option value="all">Todos los cursos</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full" style={{minWidth: '900px'}}>
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Participante
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Curso
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Progreso
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Lecciones
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Evaluación
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Certificado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredParticipantCourses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No se encontraron resultados
                  </td>
                </tr>
              ) : (
                filteredParticipantCourses.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-slate-600" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-slate-900">
                            {item.first_name} {item.last_name}
                          </div>
                          <div className="text-xs text-slate-500">{item.dni || 'Sin DNI'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-slate-900">{item.course_title}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="w-24 bg-slate-200 rounded-full h-2 mr-2">
                          <div
                            className={`h-2 rounded-full ${
                              item.progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-700">{item.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-slate-600">
                        {item.completed_lessons}/{item.total_lessons}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {item.requires_evaluation ? (
                        <div>
                          {item.evaluation_status === 'passed' && (
                            <span className="text-xs text-green-600 font-medium">
                              Aprobado ({item.evaluation_score}%)
                            </span>
                          )}
                          {item.evaluation_status === 'failed' && (
                            <span className="text-xs text-red-600 font-medium">
                              No aprobado
                            </span>
                          )}
                          {item.evaluation_status === 'pending' && (
                            <span className="text-xs text-slate-600">Pendiente</span>
                          )}
                          {item.evaluation_status === 'not_started' && (
                            <span className="text-xs text-slate-400">No iniciado</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No requerida</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {item.certificate_status === 'generated' ? (
                        <span className="inline-flex items-center text-xs text-green-600 font-medium">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Generado
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Pendiente</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
