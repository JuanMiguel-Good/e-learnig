import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  ClipboardCheck,
  Building2,
  User,
  Search,
  Download,
  TrendingUp,
  Award,
  BookOpen,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Mail,
  Filter,
  X,
  HelpCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { exportReportsToExcel } from '../../lib/reportsExporter'

interface ParticipantProgress {
  id: string
  first_name: string
  last_name: string
  email: string
  dni: string | null
  area: string | null
  company_name: string
  company_id: string
  total_courses: number
  completed_courses: number
  in_progress_courses: number
  not_started_courses: number
  total_evaluations: number
  passed_evaluations: number
  failed_evaluations: number
  pending_evaluations: number
  certificates_generated: number
  overall_progress: number
  last_activity: string | null
}

interface CompanyStats {
  company_id: string
  company_name: string
  total_participants: number
  avg_progress: number
  total_certificates: number
  total_courses_assigned: number
}

interface CourseDetail {
  course_id: string
  course_title: string
  course_image: string | null
  progress: number
  total_modules: number
  completed_modules: number
  total_lessons: number
  completed_lessons: number
  evaluation_status: 'not_started' | 'passed' | 'failed' | 'pending'
  evaluation_score: number | null
  evaluation_attempts: number
  max_attempts: number
  signature_status: 'signed' | 'pending' | 'not_required'
  certificate_status: 'generated' | 'pending'
  certificate_url: string | null
  certificate_date: string | null
  assigned_date: string
  started_date: string | null
  completed_date: string | null
}

export default function ReportsManagement() {
  const [participants, setParticipants] = useState<ParticipantProgress[]>([])
  const [filteredParticipants, setFilteredParticipants] = useState<ParticipantProgress[]>([])
  const [companies, setCompanies] = useState<CompanyStats[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantProgress | null>(null)
  const [courseDetails, setCourseDetails] = useState<CourseDetail[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in_progress' | 'not_started'>('all')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [courseFilter, setCourseFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [participants, searchTerm, statusFilter, companyFilter, courseFilter])

  const loadData = async () => {
    try {
      setIsLoading(true)
      await Promise.all([
        loadParticipantsProgress(),
        loadCompanyStats(),
        loadCourses()
      ])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setIsLoading(false)
    }
  }

  const loadCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, requires_evaluation')
        .order('title')

      if (error) throw error
      setCourses(data || [])
    } catch (error) {
      console.error('Error loading courses:', error)
      throw error
    }
  }

  const loadParticipantsProgress = async () => {
    try {
      const { data: participantsData, error: participantsError } = await supabase
        .from('users')
        .select(`
          id,
          first_name,
          last_name,
          email,
          dni,
          area,
          company:companies(id, razon_social)
        `)
        .eq('role', 'participant')
        .order('first_name')

      if (participantsError) throw participantsError

      const progressPromises = (participantsData || []).map(async (participant: any) => {
        const { data: assignments } = await supabase
          .from('course_assignments')
          .select(`
            course_id,
            assigned_at,
            courses!inner(
              id,
              title,
              requires_evaluation
            )
          `)
          .eq('user_id', participant.id)

        const totalCourses = assignments?.length || 0
        let completedCourses = 0
        let inProgressCourses = 0
        let notStartedCourses = 0
        let totalProgress = 0
        let lastActivity: string | null = null

        let totalEvaluations = 0
        let passedEvaluations = 0
        let failedEvaluations = 0
        let pendingEvaluations = 0

        for (const assignment of assignments || []) {
          const { data: modules } = await supabase
            .from('modules')
            .select('id')
            .eq('course_id', assignment.course_id)

          const { data: lessons } = await supabase
            .from('lessons')
            .select('id, module_id')
            .in('module_id', modules?.map(m => m.id) || [])

          const totalLessons = lessons?.length || 0

          const { data: progress } = await supabase
            .from('lesson_progress')
            .select('lesson_id, completed, completed_at')
            .eq('user_id', participant.id)
            .in('lesson_id', lessons?.map(l => l.id) || [])

          const completedLessons = progress?.filter(p => p.completed).length || 0
          const courseProgress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0
          totalProgress += courseProgress

          const latestActivity = progress
            ?.filter(p => p.completed_at)
            .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0]

          if (latestActivity && (!lastActivity || new Date(latestActivity.completed_at) > new Date(lastActivity))) {
            lastActivity = latestActivity.completed_at
          }

          let isCourseCompleted = false

          if (assignment.courses.requires_evaluation) {
            const { data: evaluation } = await supabase
              .from('evaluations')
              .select('id')
              .eq('course_id', assignment.course_id)
              .eq('is_active', true)
              .maybeSingle()

            if (evaluation) {
              const { data: attempts } = await supabase
                .from('evaluation_attempts')
                .select('passed')
                .eq('user_id', participant.id)
                .eq('evaluation_id', evaluation.id)

              isCourseCompleted = attempts?.some(a => a.passed) || false
            }
          } else {
            isCourseCompleted = courseProgress === 100
          }

          if (isCourseCompleted) {
            completedCourses++
          } else if (courseProgress > 0) {
            inProgressCourses++
          } else {
            notStartedCourses++
          }

          if (assignment.courses.requires_evaluation) {
            totalEvaluations++

            const { data: evaluation } = await supabase
              .from('evaluations')
              .select('id')
              .eq('course_id', assignment.course_id)
              .eq('is_active', true)
              .maybeSingle()

            if (evaluation) {
              const { data: attempts } = await supabase
                .from('evaluation_attempts')
                .select('passed')
                .eq('user_id', participant.id)
                .eq('evaluation_id', evaluation.id)

              const hasPassed = attempts?.some(a => a.passed)
              const hasFailed = attempts && attempts.length > 0 && !hasPassed

              if (hasPassed) {
                passedEvaluations++
              } else if (hasFailed) {
                failedEvaluations++
              } else {
                pendingEvaluations++
              }
            }
          }
        }

        const { count: certificatesCount } = await supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', participant.id)

        const overallProgress = totalCourses > 0 ? Math.round(totalProgress / totalCourses) : 0

        return {
          id: participant.id,
          first_name: participant.first_name,
          last_name: participant.last_name,
          email: participant.email,
          dni: participant.dni,
          area: participant.area,
          company_name: participant.company?.razon_social || 'Sin empresa',
          company_id: participant.company?.id || '',
          total_courses: totalCourses,
          completed_courses: completedCourses,
          in_progress_courses: inProgressCourses,
          not_started_courses: notStartedCourses,
          total_evaluations: totalEvaluations,
          passed_evaluations: passedEvaluations,
          failed_evaluations: failedEvaluations,
          pending_evaluations: pendingEvaluations,
          certificates_generated: certificatesCount || 0,
          overall_progress: overallProgress,
          last_activity: lastActivity
        }
      })

      const progress = await Promise.all(progressPromises)
      setParticipants(progress)
    } catch (error) {
      console.error('Error loading participants progress:', error)
      throw error
    }
  }

  const loadCompanyStats = async () => {
    try {
      const { data: companiesData, error } = await supabase
        .from('companies')
        .select('id, razon_social')
        .order('razon_social')

      if (error) throw error

      const statsPromises = (companiesData || []).map(async (company) => {
        const { data: companyParticipants } = await supabase
          .from('users')
          .select('id')
          .eq('company_id', company.id)
          .eq('role', 'participant')

        const participantIds = companyParticipants?.map(p => p.id) || []

        const { data: assignments } = await supabase
          .from('course_assignments')
          .select('course_id, user_id')
          .in('user_id', participantIds)

        const { count: certificatesCount } = await supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true })
          .in('user_id', participantIds)

        return {
          company_id: company.id,
          company_name: company.razon_social,
          total_participants: participantIds.length,
          avg_progress: 0,
          total_certificates: certificatesCount || 0,
          total_courses_assigned: assignments?.length || 0
        }
      })

      const stats = await Promise.all(statsPromises)
      setCompanies(stats)
    } catch (error) {
      console.error('Error loading company stats:', error)
      throw error
    }
  }

  const loadParticipantDetails = async (participant: ParticipantProgress) => {
    try {
      setIsLoadingDetails(true)
      setSelectedParticipant(participant)

      const { data: assignments } = await supabase
        .from('course_assignments')
        .select(`
          course_id,
          assigned_at,
          courses!inner(
            id,
            title,
            image_url,
            requires_evaluation
          )
        `)
        .eq('user_id', participant.id)

      const detailsPromises = (assignments || []).map(async (assignment: any) => {
        const { data: modules } = await supabase
          .from('modules')
          .select('id')
          .eq('course_id', assignment.course_id)

        const moduleIds = modules?.map(m => m.id) || []

        const { data: lessons } = await supabase
          .from('lessons')
          .select('id, module_id')
          .in('module_id', moduleIds)

        const totalLessons = lessons?.length || 0
        const totalModules = modules?.length || 0

        const { data: progress } = await supabase
          .from('lesson_progress')
          .select('lesson_id, completed, completed_at')
          .eq('user_id', participant.id)
          .in('lesson_id', lessons?.map(l => l.id) || [])

        const completedLessons = progress?.filter(p => p.completed).length || 0
        const completedModuleIds = new Set(
          progress?.filter(p => p.completed).map(p => {
            const lesson = lessons?.find(l => l.id === p.lesson_id)
            return lesson?.module_id
          }) || []
        )
        const completedModules = completedModuleIds.size

        const courseProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

        const startedDate = progress && progress.length > 0
          ? progress.sort((a, b) => new Date(a.completed_at || 0).getTime() - new Date(b.completed_at || 0).getTime())[0]?.completed_at
          : null

        const completedDate = courseProgress === 100 && progress
          ? progress.sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime())[0]?.completed_at
          : null

        let evaluationStatus: 'not_started' | 'passed' | 'failed' | 'pending' = 'not_started'
        let evaluationScore: number | null = null
        let evaluationAttempts = 0
        let maxAttempts = 0
        let signatureStatus: 'signed' | 'pending' | 'not_required' = 'not_required'

        if (assignment.courses.requires_evaluation) {
          const { data: evaluation } = await supabase
            .from('evaluations')
            .select('id, max_attempts')
            .eq('course_id', assignment.course_id)
            .eq('is_active', true)
            .maybeSingle()

          if (evaluation) {
            maxAttempts = evaluation.max_attempts

            const { data: attempts } = await supabase
              .from('evaluation_attempts')
              .select('passed, score, id')
              .eq('user_id', participant.id)
              .eq('evaluation_id', evaluation.id)
              .order('attempt_number', { ascending: false })

            evaluationAttempts = attempts?.length || 0

            if (attempts && attempts.length > 0) {
              const passedAttempt = attempts.find(a => a.passed)
              if (passedAttempt) {
                evaluationStatus = 'passed'
                evaluationScore = passedAttempt.score

                const { data: signature } = await supabase
                  .from('attendance_signatures')
                  .select('id')
                  .eq('evaluation_attempt_id', passedAttempt.id)
                  .eq('user_id', participant.id)
                  .maybeSingle()

                signatureStatus = signature ? 'signed' : 'pending'
              } else {
                evaluationStatus = evaluationAttempts >= maxAttempts ? 'failed' : 'pending'
                evaluationScore = attempts[0].score
              }
            } else {
              evaluationStatus = 'not_started'
            }
          }
        }

        const { data: certificate } = await supabase
          .from('certificates')
          .select('certificate_url, completion_date')
          .eq('user_id', participant.id)
          .eq('course_id', assignment.course_id)
          .maybeSingle()

        return {
          course_id: assignment.course_id,
          course_title: assignment.courses.title,
          course_image: assignment.courses.image_url,
          progress: courseProgress,
          total_modules: totalModules,
          completed_modules: completedModules,
          total_lessons: totalLessons,
          completed_lessons: completedLessons,
          evaluation_status: evaluationStatus,
          evaluation_score: evaluationScore,
          evaluation_attempts: evaluationAttempts,
          max_attempts: maxAttempts,
          signature_status: signatureStatus,
          certificate_status: certificate ? 'generated' : 'pending',
          certificate_url: certificate?.certificate_url || null,
          certificate_date: certificate?.completion_date || null,
          assigned_date: assignment.assigned_at,
          started_date: startedDate,
          completed_date: completedDate
        }
      })

      const details = await Promise.all(detailsPromises)
      setCourseDetails(details)
      setShowDetailModal(true)
    } catch (error) {
      console.error('Error loading participant details:', error)
      toast.error('Error al cargar detalles del participante')
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const applyFilters = async () => {
    let filtered = [...participants]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(p =>
        p.first_name.toLowerCase().includes(term) ||
        p.last_name.toLowerCase().includes(term) ||
        p.email.toLowerCase().includes(term) ||
        p.dni?.toLowerCase().includes(term) ||
        p.company_name.toLowerCase().includes(term)
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => {
        if (statusFilter === 'completed') return p.completed_courses === p.total_courses && p.total_courses > 0
        if (statusFilter === 'in_progress') return p.in_progress_courses > 0
        if (statusFilter === 'not_started') return p.not_started_courses === p.total_courses
        return true
      })
    }

    if (companyFilter !== 'all') {
      filtered = filtered.filter(p => p.company_id === companyFilter)
    }

    if (courseFilter !== 'all') {
      const participantIdsWithCourse = new Set<string>()

      const { data: assignments } = await supabase
        .from('course_assignments')
        .select('user_id')
        .eq('course_id', courseFilter)

      assignments?.forEach(a => participantIdsWithCourse.add(a.user_id))

      filtered = filtered.filter(p => participantIdsWithCourse.has(p.id))
    }

    setFilteredParticipants(filtered)
  }

  const handleExport = async () => {
    try {
      setIsExporting(true)
      await exportReportsToExcel(filteredParticipants, companies)
      toast.success('Reporte exportado correctamente')
    } catch (error) {
      console.error('Error exporting report:', error)
      toast.error('Error al exportar reporte')
    } finally {
      setIsExporting(false)
    }
  }

  const getProgressColor = (progress: number) => {
    if (progress === 100) return 'text-green-600 bg-green-100'
    if (progress > 0) return 'text-blue-600 bg-blue-100'
    return 'text-slate-600 bg-slate-100'
  }

  const getEvaluationStatusBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center">
          <CheckCircle className="w-3 h-3 mr-1" /> Aprobada
        </span>
      case 'failed':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 flex items-center">
          <XCircle className="w-3 h-3 mr-1" /> Reprobada
        </span>
      case 'pending':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 flex items-center">
          <Clock className="w-3 h-3 mr-1" /> Pendiente
        </span>
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
          No iniciada
        </span>
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reportes y Seguimiento</h1>
          <p className="text-slate-600">Monitorea el progreso de todos los participantes</p>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {isExporting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Exportando...
            </>
          ) : (
            <>
              <Download className="w-5 h-5 mr-2" />
              Exportar a Excel
            </>
          )}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6">
          <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Total Participantes</p>
                      <p className="text-2xl font-bold text-blue-900">{participants.length}</p>
                    </div>
                    <User className="w-8 h-8 text-blue-600" />
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-medium">Cursos Completados</p>
                      <p className="text-2xl font-bold text-green-900">
                        {participants.reduce((sum, p) => sum + p.completed_courses, 0)}
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                </div>

                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-yellow-600 font-medium">Certificados Generados</p>
                      <p className="text-2xl font-bold text-yellow-900">
                        {participants.reduce((sum, p) => sum + p.certificates_generated, 0)}
                      </p>
                    </div>
                    <Award className="w-8 h-8 text-yellow-600" />
                  </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600 font-medium">Progreso Promedio</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {participants.length > 0
                          ? Math.round(participants.reduce((sum, p) => sum + p.overall_progress, 0) / participants.length)
                          : 0}%
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-purple-600" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, email, DNI o empresa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                >
                  <option value="all">Todos los estados</option>
                  <option value="completed">Completados</option>
                  <option value="in_progress">En progreso</option>
                  <option value="not_started">No iniciados</option>
                </select>

                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                >
                  <option value="all">Todas las empresas</option>
                  {companies.map((company) => (
                    <option key={company.company_id} value={company.company_id}>
                      {company.company_name}
                    </option>
                  ))}
                </select>

                <select
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                >
                  <option value="all">Todos los cursos</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Participante
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Empresa
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Cursos
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Evaluaciones
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Certificados
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Progreso
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {filteredParticipants.map((participant) => (
                      <tr key={participant.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {participant.first_name} {participant.last_name}
                            </div>
                            <div className="text-sm text-slate-500">{participant.email}</div>
                            {participant.dni && (
                              <div className="text-xs text-slate-400">DNI: {participant.dni}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-900">{participant.company_name}</div>
                          {participant.area && (
                            <div className="text-xs text-slate-500">{participant.area}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col items-center space-y-1">
                            <div className="text-sm font-medium text-slate-900">
                              {participant.total_courses}
                            </div>
                            <div className="flex space-x-1 text-xs">
                              <span className="text-green-600">{participant.completed_courses}✓</span>
                              <span className="text-blue-600">{participant.in_progress_courses}⟳</span>
                              <span className="text-slate-400">{participant.not_started_courses}○</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col items-center space-y-1">
                            <div className="text-sm font-medium text-slate-900">
                              {participant.total_evaluations}
                            </div>
                            <div className="flex space-x-1 text-xs">
                              <span className="text-green-600">{participant.passed_evaluations}✓</span>
                              <span className="text-red-600">{participant.failed_evaluations}✗</span>
                              <span className="text-yellow-600">{participant.pending_evaluations}⧗</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center">
                            <Award className="w-4 h-4 text-yellow-600 mr-1" />
                            <span className="text-sm font-medium text-slate-900">
                              {participant.certificates_generated}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col items-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getProgressColor(participant.overall_progress)}`}>
                              {participant.overall_progress}%
                            </span>
                            <div className="w-20 bg-slate-200 rounded-full h-1.5 mt-2">
                              <div
                                className={`h-1.5 rounded-full ${
                                  participant.overall_progress === 100
                                    ? 'bg-green-500'
                                    : participant.overall_progress > 0
                                    ? 'bg-blue-500'
                                    : 'bg-slate-400'
                                }`}
                                style={{ width: `${participant.overall_progress}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => loadParticipantDetails(participant)}
                            className="text-slate-600 hover:text-slate-900"
                          >
                            <FileText className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredParticipants.length === 0 && (
                <div className="text-center py-12">
                  <User className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="mt-2 text-sm font-medium text-slate-900">No hay participantes</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {searchTerm || statusFilter !== 'all' || companyFilter !== 'all' || courseFilter !== 'all'
                      ? 'No hay resultados para los filtros aplicados.'
                      : 'No hay participantes registrados.'}
                  </p>
                </div>
              )}
          </div>
        </div>
      </div>

      {showDetailModal && selectedParticipant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    {selectedParticipant.first_name} {selectedParticipant.last_name}
                  </h2>
                  <p className="text-slate-600">{selectedParticipant.email}</p>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-slate-500">
                    <span>{selectedParticipant.company_name}</span>
                    {selectedParticipant.area && <span>{selectedParticipant.area}</span>}
                    {selectedParticipant.dni && <span>DNI: {selectedParticipant.dni}</span>}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDetailModal(false)
                    setSelectedParticipant(null)
                    setCourseDetails([])
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {isLoadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-600 font-medium">Total Cursos</p>
                      <p className="text-2xl font-bold text-slate-900">{courseDetails.length}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-green-600 font-medium">Completados</p>
                      <p className="text-2xl font-bold text-green-900">
                        {courseDetails.filter(c => c.progress === 100).length}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-600 font-medium">En Progreso</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {courseDetails.filter(c => c.progress > 0 && c.progress < 100).length}
                      </p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <p className="text-sm text-yellow-600 font-medium">Evaluaciones Aprobadas</p>
                      <p className="text-2xl font-bold text-yellow-900">
                        {courseDetails.filter(c => c.evaluation_status === 'passed').length}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-purple-600 font-medium">Certificados</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {courseDetails.filter(c => c.certificate_status === 'generated').length}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Cursos Asignados</h3>
                    <div className="space-y-4">
                      {courseDetails.map((course) => (
                        <div key={course.course_id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                          <div className="flex items-start space-x-4">
                            {course.course_image ? (
                              <img
                                src={course.course_image}
                                alt={course.course_title}
                                className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                              />
                            ) : (
                              <div className="w-24 h-24 bg-slate-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                <BookOpen className="w-8 h-8 text-slate-400" />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <h4 className="text-base font-semibold text-slate-900 mb-2">{course.course_title}</h4>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                <div>
                                  <p className="text-xs text-slate-500">Progreso</p>
                                  <div className="flex items-center">
                                    <div className="w-full bg-slate-200 rounded-full h-2 mr-2">
                                      <div
                                        className={`h-2 rounded-full ${
                                          course.progress === 100
                                            ? 'bg-green-500'
                                            : course.progress > 0
                                            ? 'bg-blue-500'
                                            : 'bg-slate-400'
                                        }`}
                                        style={{ width: `${course.progress}%` }}
                                      />
                                    </div>
                                    <span className="text-sm font-medium text-slate-900">{course.progress}%</span>
                                  </div>
                                </div>

                                <div>
                                  <p className="text-xs text-slate-500">Lecciones</p>
                                  <p className="text-sm font-medium text-slate-900">
                                    {course.completed_lessons}/{course.total_lessons}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-xs text-slate-500">Evaluación</p>
                                  <div className="mt-1">
                                    {getEvaluationStatusBadge(course.evaluation_status)}
                                  </div>
                                  {course.evaluation_score !== null && (
                                    <p className="text-xs text-slate-600 mt-1">Nota: {course.evaluation_score}%</p>
                                  )}
                                  {course.max_attempts > 0 && (
                                    <p className="text-xs text-slate-500 mt-1">
                                      Intentos: {course.evaluation_attempts}/{course.max_attempts}
                                    </p>
                                  )}
                                </div>

                                <div>
                                  <p className="text-xs text-slate-500">Certificado</p>
                                  {course.certificate_status === 'generated' ? (
                                    <div>
                                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center w-fit">
                                        <Award className="w-3 h-3 mr-1" /> Generado
                                      </span>
                                      {course.certificate_date && (
                                        <p className="text-xs text-slate-500 mt-1">
                                          {new Date(course.certificate_date).toLocaleDateString()}
                                        </p>
                                      )}
                                      {course.certificate_url && (
                                        <a
                                          href={course.certificate_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block"
                                        >
                                          Ver certificado
                                        </a>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 flex items-center w-fit">
                                      Pendiente
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                                <span>Asignado: {new Date(course.assigned_date).toLocaleDateString()}</span>
                                {course.started_date && (
                                  <span>Iniciado: {new Date(course.started_date).toLocaleDateString()}</span>
                                )}
                                {course.completed_date && (
                                  <span>Completado: {new Date(course.completed_date).toLocaleDateString()}</span>
                                )}
                                {course.signature_status !== 'not_required' && (
                                  <span className={course.signature_status === 'signed' ? 'text-green-600' : 'text-orange-600'}>
                                    Firma: {course.signature_status === 'signed' ? 'Firmada' : 'Pendiente'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {courseDetails.length === 0 && (
                      <div className="text-center py-8">
                        <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
                        <p className="mt-2 text-sm text-slate-500">No hay cursos asignados</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
