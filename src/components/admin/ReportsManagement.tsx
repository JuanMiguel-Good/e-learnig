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
  HelpCircle,
  PackageOpen
} from 'lucide-react'
import toast from 'react-hot-toast'
import { exportReportsToExcel } from '../../lib/reportsExporter'
import { CertificateBulkDownloader } from '../../lib/certificateBulkDownloader'

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
  const [participantCourses, setParticipantCourses] = useState<ParticipantCourseProgress[]>([])
  const [filteredParticipantCourses, setFilteredParticipantCourses] = useState<ParticipantCourseProgress[]>([])
  const [companies, setCompanies] = useState<CompanyStats[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in_progress' | 'not_started'>('all')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [courseFilter, setCourseFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [isDownloadingCertificates, setIsDownloadingCertificates] = useState(false)
  const tableScrollRef = React.useRef<HTMLDivElement>(null)
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0, percentage: 0 })
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showProgressModal, setShowProgressModal] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [participantCourses, searchTerm, statusFilter, companyFilter, courseFilter])

  useEffect(() => {
    const handleScroll = () => {
      const container = tableScrollRef.current
      if (!container) return

      const hasScrollLeft = container.scrollLeft > 10
      const hasScrollRight = container.scrollLeft < container.scrollWidth - container.clientWidth - 10

      if (hasScrollLeft) {
        container.classList.add('has-scroll-left')
      } else {
        container.classList.remove('has-scroll-left')
      }

      if (hasScrollRight) {
        container.classList.add('has-scroll-right')
      } else {
        container.classList.remove('has-scroll-right')
      }
    }

    const container = tableScrollRef.current
    if (container) {
      handleScroll()
      container.addEventListener('scroll', handleScroll)
      window.addEventListener('resize', handleScroll)

      return () => {
        container.removeEventListener('scroll', handleScroll)
        window.removeEventListener('resize', handleScroll)
      }
    }
  }, [filteredParticipantCourses])

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
      const { data: participants, error: participantsError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, dni, area, company_id')
        .eq('role', 'participant')
        .order('first_name')

      if (participantsError) throw participantsError
      if (!participants || participants.length === 0) {
        setParticipantCourses([])
        return
      }

      const participantIds = participants.map(p => p.id)

      const [
        { data: companies },
        { data: allAssignmentsData },
        { data: allModules },
        { data: allLessons },
        { data: allLessonProgress },
        { data: allEvaluations },
        { data: allAttempts },
        { data: allSignatures },
        { data: allCertificates }
      ] = await Promise.all([
        supabase.from('companies').select('id, razon_social'),
        supabase.from('course_assignments').select('user_id, course_id, assigned_at, courses!inner(id, title, image_url, requires_evaluation)').in('user_id', participantIds),
        supabase.from('modules').select('id, course_id'),
        supabase.from('lessons').select('id, module_id'),
        supabase.from('lesson_progress').select('user_id, lesson_id, completed, completed_at').in('user_id', participantIds),
        supabase.from('evaluations').select('id, course_id, max_attempts, is_active').eq('is_active', true),
        supabase.from('evaluation_attempts').select('id, user_id, evaluation_id, passed, score, completed_at').in('user_id', participantIds).order('completed_at', { ascending: false }),
        supabase.from('attendance_signatures').select('user_id, evaluation_attempt_id').in('user_id', participantIds),
        supabase.from('certificates').select('user_id, course_id, certificate_url, completion_date').in('user_id', participantIds)
      ])

      const companiesMap = new Map(companies?.map(c => [c.id, c.razon_social]))
      const participantsMap = new Map(participants.map(p => [p.id, p]))

      const modulesByCourse = new Map<string, any[]>()
      allModules?.forEach(m => {
        if (!modulesByCourse.has(m.course_id)) modulesByCourse.set(m.course_id, [])
        modulesByCourse.get(m.course_id)!.push(m)
      })

      const lessonsByModule = new Map<string, any[]>()
      allLessons?.forEach(l => {
        if (!lessonsByModule.has(l.module_id)) lessonsByModule.set(l.module_id, [])
        lessonsByModule.get(l.module_id)!.push(l)
      })

      const progressByUserAndLesson = new Map<string, any>()
      allLessonProgress?.forEach(p => {
        progressByUserAndLesson.set(`${p.user_id}-${p.lesson_id}`, p)
      })

      const evaluationsByCourse = new Map<string, any>()
      allEvaluations?.forEach(e => {
        if (e.is_active) evaluationsByCourse.set(e.course_id, e)
      })

      const attemptsByUserAndEval = new Map<string, any[]>()
      allAttempts?.forEach(a => {
        const key = `${a.user_id}-${a.evaluation_id}`
        if (!attemptsByUserAndEval.has(key)) attemptsByUserAndEval.set(key, [])
        attemptsByUserAndEval.get(key)!.push(a)
      })

      const signaturesByUserAndAttempt = new Map<string, boolean>()
      allSignatures?.forEach(s => {
        if (s.evaluation_attempt_id) {
          signaturesByUserAndAttempt.set(`${s.user_id}-${s.evaluation_attempt_id}`, true)
        }
      })

      const certificatesByUserAndCourse = new Map<string, any>()
      allCertificates?.forEach(c => {
        certificatesByUserAndCourse.set(`${c.user_id}-${c.course_id}`, c)
      })

      const allAssignments = (allAssignmentsData || []).map(assignment => {
        const participant = participantsMap.get(assignment.user_id)
        return {
          ...assignment,
          users: participant,
          participant_company: companiesMap.get(participant?.company_id || '') || 'Sin empresa'
        }
      })

      const participantCoursesData = allAssignments.map((assignment: any) => {
        const participant = assignment.users
        const course = assignment.courses

        const modules = modulesByCourse.get(course.id) || []
        const moduleIds = modules.map(m => m.id)

        const lessons = moduleIds.flatMap(modId => lessonsByModule.get(modId) || [])
        const totalLessons = lessons.length

        const lessonProgressList = lessons.map(l => progressByUserAndLesson.get(`${participant.id}-${l.id}`)).filter(Boolean)
        const completedLessons = lessonProgressList.filter(p => p.completed).length
        const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

        const completedModulesSet = new Set<string>()
        lessonProgressList.filter(p => p.completed).forEach(p => {
          const lesson = lessons.find(l => l.id === p.lesson_id)
          if (lesson) completedModulesSet.add(lesson.module_id)
        })

        const completedProgressWithDates = lessonProgressList.filter(p => p.completed_at)
        const latestActivity = completedProgressWithDates.length > 0
          ? completedProgressWithDates.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0]?.completed_at
          : null

        const startedDate = completedProgressWithDates.length > 0
          ? completedProgressWithDates.sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())[0]?.completed_at
          : null

        let evaluationStatus: 'not_started' | 'passed' | 'failed' | 'pending' = 'not_started'
        let evaluationScore: number | null = null
        let evaluationAttempts = 0
        let maxAttempts = 0
        let signatureStatus: 'signed' | 'pending' | 'not_required' = 'not_required'
        let passedAttemptId: string | null = null

        if (course.requires_evaluation) {
          const evaluation = evaluationsByCourse.get(course.id)

          if (evaluation) {
            maxAttempts = evaluation.max_attempts
            const attempts = attemptsByUserAndEval.get(`${participant.id}-${evaluation.id}`) || []
            evaluationAttempts = attempts.length

            if (attempts.length > 0) {
              const passedAttempt = attempts.find(a => a.passed)
              if (passedAttempt) {
                evaluationStatus = 'passed'
                evaluationScore = passedAttempt.score
                passedAttemptId = passedAttempt.id

                const hasSigned = signaturesByUserAndAttempt.has(`${participant.id}-${passedAttemptId}`)
                signatureStatus = hasSigned ? 'signed' : 'pending'
              } else {
                evaluationStatus = 'failed'
                evaluationScore = attempts[0].score
              }
            } else if (progress === 100) {
              evaluationStatus = 'pending'
            }
          }
        }

        const certificate = certificatesByUserAndCourse.get(`${participant.id}-${course.id}`)

        let completedDate: string | null = null
        if (course.requires_evaluation) {
          if (evaluationStatus === 'passed') {
            completedDate = certificate?.completion_date || null
          }
        } else {
          if (progress === 100) {
            completedDate = latestActivity
          }
        }

        return {
          participant_id: participant.id,
          first_name: participant.first_name,
          last_name: participant.last_name,
          email: participant.email,
          dni: participant.dni,
          area: participant.area,
          company_name: assignment.participant_company,
          company_id: participant.company_id || '',
          course_id: course.id,
          course_title: course.title,
          course_image: course.image_url,
          assigned_date: assignment.assigned_at,
          started_date: startedDate,
          completed_date: completedDate,
          progress,
          total_modules: modules.length,
          completed_modules: completedModulesSet.size,
          total_lessons: totalLessons,
          completed_lessons: completedLessons,
          requires_evaluation: course.requires_evaluation,
          evaluation_status: evaluationStatus,
          evaluation_score: evaluationScore,
          evaluation_attempts: evaluationAttempts,
          max_attempts: maxAttempts,
          signature_status: signatureStatus,
          certificate_status: certificate ? 'generated' : 'pending',
          certificate_url: certificate?.certificate_url || null,
          certificate_date: certificate?.completion_date || null,
          last_activity: latestActivity
        }
      })

      setParticipantCourses(participantCoursesData)
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


  const applyFilters = () => {
    let filtered = [...participantCourses]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(p =>
        p.first_name.toLowerCase().includes(term) ||
        p.last_name.toLowerCase().includes(term) ||
        p.email.toLowerCase().includes(term) ||
        p.dni?.toLowerCase().includes(term) ||
        p.company_name.toLowerCase().includes(term) ||
        p.course_title.toLowerCase().includes(term)
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => {
        if (statusFilter === 'completed') return p.progress === 100 && (p.requires_evaluation ? p.evaluation_status === 'passed' : true)
        if (statusFilter === 'in_progress') return p.progress > 0 && p.progress < 100
        if (statusFilter === 'not_started') return p.progress === 0
        return true
      })
    }

    if (companyFilter !== 'all') {
      filtered = filtered.filter(p => p.company_id === companyFilter)
    }

    if (courseFilter !== 'all') {
      filtered = filtered.filter(p => p.course_id === courseFilter)
    }

    setFilteredParticipantCourses(filtered)
  }

  const handleExport = async () => {
    try {
      setIsExporting(true)
      await exportReportsToExcel(filteredParticipantCourses, companies)
      toast.success('Reporte exportado correctamente')
    } catch (error) {
      console.error('Error exporting report:', error)
      toast.error('Error al exportar reporte')
    } finally {
      setIsExporting(false)
    }
  }

  const getAvailableCertificates = () => {
    return filteredParticipantCourses.filter(
      (p) => p.certificate_status === 'generated' && p.certificate_url
    )
  }

  const handleBulkDownloadClick = () => {
    const availableCertificates = getAvailableCertificates()
    if (availableCertificates.length === 0) {
      toast.error('No hay certificados disponibles para descargar')
      return
    }
    setShowConfirmModal(true)
  }

  const handleConfirmDownload = async () => {
    setShowConfirmModal(false)
    const availableCertificates = getAvailableCertificates()

    if (availableCertificates.length === 0) {
      return
    }

    try {
      setIsDownloadingCertificates(true)
      setShowProgressModal(true)
      setDownloadProgress({ current: 0, total: availableCertificates.length, percentage: 0 })

      const certificateData = availableCertificates.map((cert) => ({
        participant_id: cert.participant_id,
        first_name: cert.first_name,
        last_name: cert.last_name,
        dni: cert.dni,
        course_title: cert.course_title,
        certificate_url: cert.certificate_url!
      }))

      const result = await CertificateBulkDownloader.downloadCertificatesAsZip(
        certificateData,
        (progress) => {
          setDownloadProgress(progress)
        }
      )

      setShowProgressModal(false)

      if (result.failureCount > 0) {
        toast.success(
          `${result.successCount} de ${result.total} certificados descargados correctamente`
        )
      } else {
        toast.success('Todos los certificados se descargaron correctamente')
      }
    } catch (error) {
      console.error('Error downloading certificates:', error)
      setShowProgressModal(false)
      toast.error('Error al descargar certificados')
    } finally {
      setIsDownloadingCertificates(false)
      setDownloadProgress({ current: 0, total: 0, percentage: 0 })
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
        <div className="flex gap-3">
          <button
            onClick={handleBulkDownloadClick}
            disabled={isDownloadingCertificates || isExporting || getAvailableCertificates().length === 0}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloadingCertificates ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Descargando...
              </>
            ) : (
              <>
                <PackageOpen className="w-5 h-5 mr-2" />
                Descargar Certificados
              </>
            )}
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || isDownloadingCertificates}
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
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-6">
          <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-blue-600 font-medium">Total Asignaciones</p>
                      <p className="text-2xl font-bold text-blue-900">{participantCourses.length}</p>
                    </div>
                    <BookOpen className="w-8 h-8 text-blue-600 flex-shrink-0 ml-2" />
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-green-600 font-medium">Cursos Completados</p>
                      <p className="text-2xl font-bold text-green-900">
                        {participantCourses.filter(p => p.progress === 100 && (p.requires_evaluation ? p.evaluation_status === 'passed' : true)).length}
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0 ml-2" />
                  </div>
                </div>

                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-yellow-600 font-medium">Certificados Generados</p>
                      <p className="text-2xl font-bold text-yellow-900">
                        {participantCourses.filter(p => p.certificate_status === 'generated').length}
                      </p>
                    </div>
                    <Award className="w-8 h-8 text-yellow-600 flex-shrink-0 ml-2" />
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-600 font-medium">Progreso Promedio</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {participantCourses.length > 0
                          ? Math.round(participantCourses.reduce((sum, p) => sum + p.progress, 0) / participantCourses.length)
                          : 0}%
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-slate-600 flex-shrink-0 ml-2" />
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

              <div className="-mx-6 px-6 max-h-[70vh] overflow-y-auto overflow-x-auto border-t border-b border-slate-200 relative">
                <div ref={tableScrollRef} className="table-scroll-container">
                  <table className="min-w-full table-compact divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap min-w-[200px] bg-slate-50">
                          Participante
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap min-w-[160px] bg-slate-50">
                          Empresa
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap min-w-[220px] bg-slate-50">
                          Curso
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap col-status bg-slate-50">
                          Progreso
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap col-status bg-slate-50">
                          Evaluación
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap col-status bg-slate-50">
                          Certificado
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap col-status bg-slate-50">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                    {filteredParticipantCourses.map((item, index) => (
                      <tr key={`${item.participant_id}-${item.course_id}-${index}`} className="hover:bg-slate-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {item.first_name} {item.last_name}
                            </div>
                            <div className="text-sm text-slate-500">{item.email}</div>
                            {item.dni && (
                              <div className="text-xs text-slate-400">DNI: {item.dni}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-slate-900">{item.company_name}</div>
                          {item.area && (
                            <div className="text-xs text-slate-500">{item.area}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-slate-900">{item.course_title}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {item.total_lessons} lecciones • {item.completed_lessons} completadas
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col items-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getProgressColor(item.progress)}`}>
                              {item.progress}%
                            </span>
                            <div className="w-16 bg-slate-200 rounded-full h-1.5 mt-1">
                              <div
                                className={`h-1.5 rounded-full ${
                                  item.progress === 100
                                    ? 'bg-green-500'
                                    : item.progress > 0
                                    ? 'bg-blue-500'
                                    : 'bg-slate-400'
                                }`}
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {item.requires_evaluation ? (
                            <div className="flex flex-col items-center">
                              {getEvaluationStatusBadge(item.evaluation_status)}
                              {item.evaluation_score !== null && (
                                <div className="text-xs text-slate-500 mt-1">
                                  Nota: {item.evaluation_score}%
                                </div>
                              )}
                              {item.evaluation_attempts > 0 && (
                                <div className="text-xs text-slate-400 mt-1">
                                  {item.evaluation_attempts}/{item.max_attempts}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">No req.</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {item.certificate_status === 'generated' ? (
                            <a
                              href={item.certificate_url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-green-600 hover:text-green-800"
                            >
                              <Award className="w-4 h-4 mr-1" />
                              <span className="text-xs">Ver</span>
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">Pendiente</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {item.progress === 100 && (!item.requires_evaluation || item.evaluation_status === 'passed') ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              Completado
                            </span>
                          ) : item.progress > 0 ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              En progreso
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                              No iniciado
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {filteredParticipantCourses.length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="mt-2 text-sm font-medium text-slate-900">No hay asignaciones</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {searchTerm || statusFilter !== 'all' || companyFilter !== 'all' || courseFilter !== 'all'
                      ? 'No hay resultados para los filtros aplicados.'
                      : 'No hay cursos asignados a participantes.'}
                  </p>
                </div>
              )}
          </div>
        </div>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                <PackageOpen className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Descargar Certificados
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Se descargarán <strong>{getAvailableCertificates().length} certificados</strong> en formato PDF.
                  Este proceso puede tomar varios minutos dependiendo de la cantidad de certificados.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDownload}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Descargar
              </button>
            </div>
          </div>
        </div>
      )}

      {showProgressModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Descargando Certificados
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Procesando certificado {downloadProgress.current} de {downloadProgress.total}
              </p>
              <div className="w-full bg-slate-200 rounded-full h-2.5 mb-2">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress.percentage}%` }}
                ></div>
              </div>
              <p className="text-sm font-medium text-slate-700">
                {downloadProgress.percentage}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
