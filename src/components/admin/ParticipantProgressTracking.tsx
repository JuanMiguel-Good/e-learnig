import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, ChevronDown, AlertCircle, CheckCircle, Clock, FileText, Award, XCircle, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportProgressToExcel } from '../../lib/progressExporter'

interface ProgressRecord {
  id: string
  user_id: string
  course_id: string
  status: string
  started_at: string | null
  last_activity_at: string | null
  completed_at: string | null
  assigned_at: string
  user: {
    first_name: string
    last_name: string
    email: string
    dni: string | null
    area: string | null
    company?: {
      razon_social: string
    }
  }
  course: {
    title: string
    requires_evaluation: boolean
  }
  progress: number
  evaluation_status: string | null
  signature_status: boolean
  days_inactive: number | null
}

interface Filters {
  status: string
  course: string
  company: string
  search: string
  onlyInactive: boolean
}

interface DetailModalData {
  record: ProgressRecord
  timeline: TimelineEvent[]
  lessonDetails: LessonDetail[]
  evaluationAttempts: EvaluationAttempt[]
}

interface TimelineEvent {
  date: string
  type: string
  description: string
  icon: React.ReactNode
}

interface LessonDetail {
  module_title: string
  lesson_title: string
  completed: boolean
  completed_at: string | null
}

interface EvaluationAttempt {
  attempt_number: number
  score: number
  passed: boolean
  completed_at: string
}

export default function ParticipantProgressTracking() {
  const [records, setRecords] = useState<ProgressRecord[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>({
    status: '',
    course: '',
    company: '',
    search: '',
    onlyInactive: false
  })
  const [detailModal, setDetailModal] = useState<DetailModalData | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)

      const [assignmentsRes, coursesRes, companiesRes] = await Promise.all([
        supabase
          .from('course_assignments')
          .select(`
            *,
            user:users!inner(
              first_name,
              last_name,
              email,
              dni,
              area,
              company:companies(razon_social)
            ),
            course:courses!inner(title, requires_evaluation)
          `)
          .order('last_activity_at', { ascending: false, nullsFirst: false }),
        supabase.from('courses').select('id, title').order('title'),
        supabase.from('companies').select('id, razon_social').order('razon_social')
      ])

      if (assignmentsRes.error) throw assignmentsRes.error
      if (coursesRes.error) throw coursesRes.error
      if (companiesRes.error) throw companiesRes.error

      const enrichedRecords = await Promise.all(
        (assignmentsRes.data || []).map(async (assignment: any) => {
          const progress = await getProgressPercentage(assignment.user_id, assignment.course_id)
          const evaluationStatus = await getEvaluationStatus(assignment.user_id, assignment.course_id)
          const signatureStatus = await getSignatureStatus(assignment.user_id, assignment.course_id)
          const daysInactive = assignment.last_activity_at
            ? Math.floor((Date.now() - new Date(assignment.last_activity_at).getTime()) / (1000 * 60 * 60 * 24))
            : null

          return {
            ...assignment,
            progress,
            evaluation_status: evaluationStatus,
            signature_status: signatureStatus,
            days_inactive: daysInactive
          }
        })
      )

      setRecords(enrichedRecords)
      setCourses(coursesRes.data || [])
      setCompanies(companiesRes.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setIsLoading(false)
    }
  }

  const getProgressPercentage = async (userId: string, courseId: string): Promise<number> => {
    try {
      const { data: totalLessons } = await supabase
        .from('lessons')
        .select('id', { count: 'exact' })
        .in('module_id',
          supabase
            .from('modules')
            .select('id')
            .eq('course_id', courseId)
        )

      const { data: completedLessons } = await supabase
        .from('lesson_progress')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('completed', true)
        .in('lesson_id',
          supabase
            .from('lessons')
            .select('id')
            .in('module_id',
              supabase
                .from('modules')
                .select('id')
                .eq('course_id', courseId)
            )
        )

      const total = totalLessons?.length || 0
      const completed = completedLessons?.length || 0

      return total > 0 ? Math.round((completed / total) * 100) : 0
    } catch (error) {
      console.error('Error calculating progress:', error)
      return 0
    }
  }

  const getEvaluationStatus = async (userId: string, courseId: string): Promise<string | null> => {
    try {
      const { data: evaluation } = await supabase
        .from('evaluations')
        .select('id')
        .eq('course_id', courseId)
        .eq('is_active', true)
        .maybeSingle()

      if (!evaluation) return null

      const { data: attempts } = await supabase
        .from('evaluation_attempts')
        .select('passed')
        .eq('user_id', userId)
        .eq('evaluation_id', evaluation.id)

      if (!attempts || attempts.length === 0) return 'pending'
      if (attempts.some(a => a.passed)) return 'passed'
      return 'failed'
    } catch (error) {
      return null
    }
  }

  const getSignatureStatus = async (userId: string, courseId: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from('attendance_signatures')
        .select('id')
        .eq('user_id', userId)
        .in('evaluation_attempt_id',
          supabase
            .from('evaluation_attempts')
            .select('id')
            .eq('user_id', userId)
            .in('evaluation_id',
              supabase
                .from('evaluations')
                .select('id')
                .eq('course_id', courseId)
            )
        )
        .maybeSingle()

      return !!data
    } catch (error) {
      return false
    }
  }

  const openDetailModal = async (record: ProgressRecord) => {
    setIsLoadingDetail(true)
    try {
      const timeline = await buildTimeline(record)
      const lessonDetails = await getLessonDetails(record.user_id, record.course_id)
      const evaluationAttempts = await getEvaluationAttempts(record.user_id, record.course_id)

      setDetailModal({
        record,
        timeline,
        lessonDetails,
        evaluationAttempts
      })
    } catch (error) {
      console.error('Error loading detail:', error)
      toast.error('Error al cargar detalles')
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const buildTimeline = async (record: ProgressRecord): Promise<TimelineEvent[]> => {
    const events: TimelineEvent[] = []

    events.push({
      date: record.assigned_at,
      type: 'assigned',
      description: 'Curso asignado',
      icon: <FileText className="w-4 h-4" />
    })

    if (record.started_at) {
      events.push({
        date: record.started_at,
        type: 'started',
        description: 'Inició el curso',
        icon: <Clock className="w-4 h-4" />
      })
    }

    const { data: completedLessons } = await supabase
      .from('lesson_progress')
      .select('completed_at, lesson:lessons(title)')
      .eq('user_id', record.user_id)
      .eq('completed', true)
      .in('lesson_id',
        supabase
          .from('lessons')
          .select('id')
          .in('module_id',
            supabase
              .from('modules')
              .select('id')
              .eq('course_id', record.course_id)
          )
      )

    completedLessons?.forEach(lesson => {
      if (lesson.completed_at) {
        events.push({
          date: lesson.completed_at,
          type: 'lesson_completed',
          description: `Completó: ${(lesson.lesson as any).title}`,
          icon: <CheckCircle className="w-4 h-4" />
        })
      }
    })

    const { data: attempts } = await supabase
      .from('evaluation_attempts')
      .select('completed_at, passed, score')
      .eq('user_id', record.user_id)
      .in('evaluation_id',
        supabase
          .from('evaluations')
          .select('id')
          .eq('course_id', record.course_id)
      )

    attempts?.forEach(attempt => {
      if (attempt.completed_at) {
        events.push({
          date: attempt.completed_at,
          type: attempt.passed ? 'evaluation_passed' : 'evaluation_failed',
          description: attempt.passed
            ? `Aprobó evaluación (${attempt.score}%)`
            : `No aprobó evaluación (${attempt.score}%)`,
          icon: attempt.passed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />
        })
      }
    })

    const { data: signature } = await supabase
      .from('attendance_signatures')
      .select('signed_at')
      .eq('user_id', record.user_id)
      .in('evaluation_attempt_id',
        supabase
          .from('evaluation_attempts')
          .select('id')
          .eq('user_id', record.user_id)
          .in('evaluation_id',
            supabase
              .from('evaluations')
              .select('id')
              .eq('course_id', record.course_id)
          )
      )
      .maybeSingle()

    if (signature?.signed_at) {
      events.push({
        date: signature.signed_at,
        type: 'signature',
        description: 'Firmó lista de asistencia',
        icon: <FileText className="w-4 h-4" />
      })
    }

    if (record.completed_at) {
      events.push({
        date: record.completed_at,
        type: 'completed',
        description: 'Completó el curso',
        icon: <Award className="w-4 h-4" />
      })
    }

    const { data: certificate } = await supabase
      .from('certificates')
      .select('created_at')
      .eq('user_id', record.user_id)
      .eq('course_id', record.course_id)
      .maybeSingle()

    if (certificate?.created_at) {
      events.push({
        date: certificate.created_at,
        type: 'certificate',
        description: 'Certificado generado',
        icon: <Award className="w-4 h-4" />
      })
    }

    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  const getLessonDetails = async (userId: string, courseId: string): Promise<LessonDetail[]> => {
    const { data: modules } = await supabase
      .from('modules')
      .select(`
        title,
        lessons (
          id,
          title,
          order_index
        )
      `)
      .eq('course_id', courseId)
      .order('order_index')

    if (!modules) return []

    const details: LessonDetail[] = []

    for (const module of modules) {
      for (const lesson of (module as any).lessons) {
        const { data: progress } = await supabase
          .from('lesson_progress')
          .select('completed, completed_at')
          .eq('user_id', userId)
          .eq('lesson_id', lesson.id)
          .maybeSingle()

        details.push({
          module_title: module.title,
          lesson_title: lesson.title,
          completed: progress?.completed || false,
          completed_at: progress?.completed_at || null
        })
      }
    }

    return details
  }

  const getEvaluationAttempts = async (userId: string, courseId: string): Promise<EvaluationAttempt[]> => {
    const { data: evaluation } = await supabase
      .from('evaluations')
      .select('id')
      .eq('course_id', courseId)
      .eq('is_active', true)
      .maybeSingle()

    if (!evaluation) return []

    const { data: attempts } = await supabase
      .from('evaluation_attempts')
      .select('attempt_number, score, passed, completed_at')
      .eq('user_id', userId)
      .eq('evaluation_id', evaluation.id)
      .order('attempt_number')

    return attempts || []
  }

  const handleExport = async () => {
    try {
      await exportProgressToExcel(filteredRecords)
      toast.success('Reporte exportado correctamente')
    } catch (error) {
      console.error('Error exporting:', error)
      toast.error('Error al exportar reporte')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      not_started: {
        label: 'No Iniciado',
        color: 'bg-gray-100 text-gray-800',
        icon: <Clock className="w-3 h-3" />
      },
      in_progress: {
        label: 'En Progreso',
        color: 'bg-blue-100 text-blue-800',
        icon: <Clock className="w-3 h-3" />
      },
      lessons_completed: {
        label: 'Lecciones Completas',
        color: 'bg-green-100 text-green-800',
        icon: <CheckCircle className="w-3 h-3" />
      },
      evaluation_pending: {
        label: 'Evaluación Pendiente',
        color: 'bg-yellow-100 text-yellow-800',
        icon: <AlertCircle className="w-3 h-3" />
      },
      evaluation_passed: {
        label: 'Evaluación Aprobada',
        color: 'bg-green-100 text-green-800',
        icon: <CheckCircle className="w-3 h-3" />
      },
      signature_pending: {
        label: 'Firma Pendiente',
        color: 'bg-orange-100 text-orange-800',
        icon: <FileText className="w-3 h-3" />
      },
      completed: {
        label: 'Completado',
        color: 'bg-emerald-100 text-emerald-800',
        icon: <CheckCircle className="w-3 h-3" />
      },
      certificate_generated: {
        label: 'Certificado Generado',
        color: 'bg-purple-100 text-purple-800',
        icon: <Award className="w-3 h-3" />
      }
    }

    const config = statusConfig[status] || statusConfig.not_started

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon}
        <span className="ml-1">{config.label}</span>
      </span>
    )
  }

  const filteredRecords = records.filter(record => {
    if (filters.status && record.status !== filters.status) return false
    if (filters.course && record.course_id !== filters.course) return false
    if (filters.company && record.user.company?.razon_social !== filters.company) return false
    if (filters.onlyInactive && (!record.days_inactive || record.days_inactive < 15)) return false
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const fullName = `${record.user.first_name} ${record.user.last_name}`.toLowerCase()
      const email = record.user.email.toLowerCase()
      const course = record.course.title.toLowerCase()
      if (!fullName.includes(searchLower) && !email.includes(searchLower) && !course.includes(searchLower)) {
        return false
      }
    }
    return true
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Seguimiento de Participantes</h1>
          <p className="text-slate-600">Monitorea el progreso de cada participante en sus cursos asignados</p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          <Download className="w-5 h-5 mr-2" />
          Exportar a Excel
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            />
          </div>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
          >
            <option value="">Todos los estados</option>
            <option value="not_started">No Iniciado</option>
            <option value="in_progress">En Progreso</option>
            <option value="lessons_completed">Lecciones Completas</option>
            <option value="evaluation_pending">Evaluación Pendiente</option>
            <option value="signature_pending">Firma Pendiente</option>
            <option value="completed">Completado</option>
            <option value="certificate_generated">Certificado Generado</option>
          </select>

          <select
            value={filters.course}
            onChange={(e) => setFilters({ ...filters, course: e.target.value })}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
          >
            <option value="">Todos los cursos</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>

          <select
            value={filters.company}
            onChange={(e) => setFilters({ ...filters, company: e.target.value })}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
          >
            <option value="">Todas las empresas</option>
            {companies.map(company => (
              <option key={company.id} value={company.razon_social}>{company.razon_social}</option>
            ))}
          </select>

          <label className="flex items-center px-4 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={filters.onlyInactive}
              onChange={(e) => setFilters({ ...filters, onlyInactive: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm">Solo inactivos (+15 días)</span>
          </label>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Participante
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Curso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Empresa
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Progreso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Última Actividad
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredRecords.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {record.user.first_name} {record.user.last_name}
                      </div>
                      <div className="text-sm text-slate-500">{record.user.email}</div>
                      {record.user.dni && (
                        <div className="text-xs text-slate-400">DNI: {record.user.dni}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900">{record.course.title}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-600">
                      {record.user.company?.razon_social || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-24 bg-slate-200 rounded-full h-2 mr-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${record.progress}%` }}
                        />
                      </div>
                      <span className="text-sm text-slate-600">{record.progress}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(record.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {record.last_activity_at ? (
                      <div>
                        <div className="text-sm text-slate-600">
                          {new Date(record.last_activity_at).toLocaleDateString()}
                        </div>
                        {record.days_inactive && record.days_inactive >= 15 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {record.days_inactive} días inactivo
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">Sin actividad</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => openDetailModal(record)}
                      className="text-blue-600 hover:text-blue-900 font-medium text-sm"
                    >
                      Ver Detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRecords.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-2 text-sm font-medium text-slate-900">No hay registros</h3>
            <p className="mt-1 text-sm text-slate-500">
              {filters.search || filters.status || filters.course || filters.company
                ? 'No hay resultados para los filtros seleccionados.'
                : 'No hay asignaciones de cursos.'}
            </p>
          </div>
        )}
      </div>

      {detailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-slate-800">
                Detalle de Progreso
              </h2>
              <p className="text-slate-600 mt-1">
                {detailModal.record.user.first_name} {detailModal.record.user.last_name} - {detailModal.record.course.title}
              </p>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-2">Información del Participante</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Email:</span> {detailModal.record.user.email}</p>
                    {detailModal.record.user.dni && (
                      <p><span className="font-medium">DNI:</span> {detailModal.record.user.dni}</p>
                    )}
                    {detailModal.record.user.area && (
                      <p><span className="font-medium">Área:</span> {detailModal.record.user.area}</p>
                    )}
                    {detailModal.record.user.company && (
                      <p><span className="font-medium">Empresa:</span> {detailModal.record.user.company.razon_social}</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-2">Métricas del Curso</h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-slate-600">Progreso General</p>
                      <div className="flex items-center">
                        <div className="flex-1 bg-slate-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${detailModal.record.progress}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{detailModal.record.progress}%</span>
                      </div>
                    </div>
                    <p className="text-sm">
                      <span className="font-medium">Estado:</span> {getStatusBadge(detailModal.record.status)}
                    </p>
                    {detailModal.record.days_inactive && (
                      <p className="text-sm">
                        <span className="font-medium">Días sin actividad:</span>{' '}
                        <span className={detailModal.record.days_inactive >= 15 ? 'text-red-600 font-medium' : ''}>
                          {detailModal.record.days_inactive}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-3">Línea de Tiempo</h3>
                <div className="space-y-3">
                  {detailModal.timeline.map((event, idx) => (
                    <div key={idx} className="flex items-start">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        {event.icon}
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-slate-900">{event.description}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(event.date).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {detailModal.lessonDetails.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Detalle de Lecciones</h3>
                  <div className="max-h-64 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left">Módulo</th>
                          <th className="px-4 py-2 text-left">Lección</th>
                          <th className="px-4 py-2 text-center">Estado</th>
                          <th className="px-4 py-2 text-left">Completada</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {detailModal.lessonDetails.map((lesson, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2">{lesson.module_title}</td>
                            <td className="px-4 py-2">{lesson.lesson_title}</td>
                            <td className="px-4 py-2 text-center">
                              {lesson.completed ? (
                                <CheckCircle className="w-4 h-4 text-green-600 inline" />
                              ) : (
                                <XCircle className="w-4 h-4 text-slate-400 inline" />
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {lesson.completed_at
                                ? new Date(lesson.completed_at).toLocaleDateString()
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {detailModal.evaluationAttempts.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Intentos de Evaluación</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left">Intento</th>
                          <th className="px-4 py-2 text-center">Puntaje</th>
                          <th className="px-4 py-2 text-center">Resultado</th>
                          <th className="px-4 py-2 text-left">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {detailModal.evaluationAttempts.map((attempt) => (
                          <tr key={attempt.attempt_number}>
                            <td className="px-4 py-2">Intento {attempt.attempt_number}</td>
                            <td className="px-4 py-2 text-center font-medium">{attempt.score}%</td>
                            <td className="px-4 py-2 text-center">
                              {attempt.passed ? (
                                <span className="text-green-600 font-medium">Aprobado</span>
                              ) : (
                                <span className="text-red-600 font-medium">Reprobado</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {new Date(attempt.completed_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t bg-slate-50 flex justify-end">
              <button
                onClick={() => setDetailModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
