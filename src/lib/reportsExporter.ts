import * as XLSX from 'xlsx'

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

export const exportReportsToExcel = async (
  participantCourses: ParticipantCourseProgress[],
  companies: CompanyStats[]
) => {
  const workbook = XLSX.utils.book_new()

  const uniqueParticipants = new Set(participantCourses.map(p => p.participant_id)).size
  const completedCourses = participantCourses.filter(p => p.progress === 100 && (p.requires_evaluation ? p.evaluation_status === 'passed' : true)).length
  const generatedCertificates = participantCourses.filter(p => p.certificate_status === 'generated').length
  const avgProgress = participantCourses.length > 0
    ? Math.round(participantCourses.reduce((sum, p) => sum + p.progress, 0) / participantCourses.length)
    : 0

  const summaryData = [
    ['REPORTE DE PROGRESO DE PARTICIPANTES POR CURSO'],
    ['Generado el:', new Date().toLocaleString('es-ES')],
    [],
    ['RESUMEN GENERAL'],
    ['Total de Participantes', uniqueParticipants],
    ['Total de Asignaciones', participantCourses.length],
    ['Total de Cursos Completados', completedCourses],
    ['Total de Certificados Generados', generatedCertificates],
    ['Progreso Promedio', `${avgProgress}%`],
    [],
    ['ESTADÍSTICAS POR EMPRESA'],
    ['Empresa', 'Asignaciones', 'Completados', 'Certificados']
  ]

  companies.forEach(company => {
    const companyAssignments = participantCourses.filter(p => p.company_id === company.company_id)
    const companyCompleted = companyAssignments.filter(p => p.progress === 100 && (p.requires_evaluation ? p.evaluation_status === 'passed' : true)).length
    const companyCertificates = companyAssignments.filter(p => p.certificate_status === 'generated').length

    if (companyAssignments.length > 0) {
      summaryData.push([
        company.company_name,
        companyAssignments.length,
        companyCompleted,
        companyCertificates
      ])
    }
  })

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)

  summarySheet['!cols'] = [
    { wch: 35 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 }
  ]

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen')

  const detailData = [
    [
      'Nombre',
      'Apellido',
      'Email',
      'DNI',
      'Área',
      'Empresa',
      'Curso',
      'Progreso (%)',
      'Lecciones Completadas',
      'Lecciones Totales',
      'Requiere Evaluación',
      'Estado Evaluación',
      'Nota Evaluación',
      'Intentos Evaluación',
      'Estado Certificado',
      'Fecha Asignación',
      'Fecha Inicio',
      'Fecha Completado',
      'Última Actividad'
    ]
  ]

  participantCourses.forEach(item => {
    const getStatusText = () => {
      if (item.progress === 100 && (!item.requires_evaluation || item.evaluation_status === 'passed')) {
        return 'Completado'
      } else if (item.progress > 0) {
        return 'En progreso'
      }
      return 'No iniciado'
    }

    const getEvaluationStatus = () => {
      if (!item.requires_evaluation) return 'No requerida'
      if (item.evaluation_status === 'passed') return 'Aprobada'
      if (item.evaluation_status === 'failed') return 'Reprobada'
      if (item.evaluation_status === 'pending') return 'Pendiente'
      return 'No iniciada'
    }

    detailData.push([
      item.first_name,
      item.last_name,
      item.email,
      item.dni || '',
      item.area || '',
      item.company_name,
      item.course_title,
      item.progress,
      item.completed_lessons,
      item.total_lessons,
      item.requires_evaluation ? 'Sí' : 'No',
      getEvaluationStatus(),
      item.evaluation_score !== null ? item.evaluation_score : '',
      item.requires_evaluation ? `${item.evaluation_attempts}/${item.max_attempts}` : '',
      item.certificate_status === 'generated' ? 'Generado' : 'Pendiente',
      new Date(item.assigned_date).toLocaleDateString('es-ES'),
      item.started_date ? new Date(item.started_date).toLocaleDateString('es-ES') : '',
      item.completed_date ? new Date(item.completed_date).toLocaleDateString('es-ES') : '',
      item.last_activity ? new Date(item.last_activity).toLocaleDateString('es-ES') : 'Sin actividad'
    ])
  })

  const detailSheet = XLSX.utils.aoa_to_sheet(detailData)

  detailSheet['!cols'] = [
    { wch: 15 },
    { wch: 15 },
    { wch: 30 },
    { wch: 12 },
    { wch: 20 },
    { wch: 25 },
    { wch: 30 },
    { wch: 12 },
    { wch: 18 },
    { wch: 15 },
    { wch: 18 },
    { wch: 18 },
    { wch: 15 },
    { wch: 18 },
    { wch: 18 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 }
  ]

  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detalle por Curso')

  const date = new Date().toISOString().split('T')[0]
  const fileName = `Reporte_Progreso_Por_Curso_${date}.xlsx`

  XLSX.writeFile(workbook, fileName)
}
