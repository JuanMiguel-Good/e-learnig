import * as XLSX from 'xlsx'

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

export const exportReportsToExcel = async (
  participants: ParticipantProgress[],
  companies: CompanyStats[]
) => {
  const workbook = XLSX.utils.book_new()

  const summaryData = [
    ['REPORTE DE PROGRESO DE PARTICIPANTES'],
    ['Generado el:', new Date().toLocaleString('es-ES')],
    [],
    ['RESUMEN GENERAL'],
    ['Total de Participantes', participants.length],
    ['Total de Cursos Asignados', participants.reduce((sum, p) => sum + p.total_courses, 0)],
    ['Total de Cursos Completados', participants.reduce((sum, p) => sum + p.completed_courses, 0)],
    ['Total de Certificados Generados', participants.reduce((sum, p) => sum + p.certificates_generated, 0)],
    ['Progreso Promedio', `${participants.length > 0 ? Math.round(participants.reduce((sum, p) => sum + p.overall_progress, 0) / participants.length) : 0}%`],
    [],
    ['ESTADÍSTICAS POR EMPRESA'],
    ['Empresa', 'Participantes', 'Cursos Asignados', 'Certificados', 'Progreso Promedio']
  ]

  companies.forEach(company => {
    const companyParticipants = participants.filter(p => p.company_id === company.company_id)
    const avgProgress = companyParticipants.length > 0
      ? Math.round(companyParticipants.reduce((sum, p) => sum + p.overall_progress, 0) / companyParticipants.length)
      : 0

    summaryData.push([
      company.company_name,
      company.total_participants,
      company.total_courses_assigned,
      company.total_certificates,
      `${avgProgress}%`
    ])
  })

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)

  summarySheet['!cols'] = [
    { wch: 35 },
    { wch: 20 },
    { wch: 20 },
    { wch: 15 },
    { wch: 18 }
  ]

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen')

  const participantsData = [
    [
      'Nombre',
      'Apellido',
      'Email',
      'DNI',
      'Área',
      'Empresa',
      'Total Cursos',
      'Completados',
      'En Progreso',
      'No Iniciados',
      'Evaluaciones Total',
      'Evaluaciones Aprobadas',
      'Evaluaciones Reprobadas',
      'Evaluaciones Pendientes',
      'Certificados Generados',
      'Progreso General (%)',
      'Última Actividad'
    ]
  ]

  participants.forEach(p => {
    participantsData.push([
      p.first_name,
      p.last_name,
      p.email,
      p.dni || '',
      p.area || '',
      p.company_name,
      p.total_courses,
      p.completed_courses,
      p.in_progress_courses,
      p.not_started_courses,
      p.total_evaluations,
      p.passed_evaluations,
      p.failed_evaluations,
      p.pending_evaluations,
      p.certificates_generated,
      p.overall_progress,
      p.last_activity ? new Date(p.last_activity).toLocaleDateString('es-ES') : 'Sin actividad'
    ])
  })

  const participantsSheet = XLSX.utils.aoa_to_sheet(participantsData)

  participantsSheet['!cols'] = [
    { wch: 15 },
    { wch: 15 },
    { wch: 30 },
    { wch: 12 },
    { wch: 20 },
    { wch: 25 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 15 },
    { wch: 18 }
  ]

  XLSX.utils.book_append_sheet(workbook, participantsSheet, 'Detalle por Participante')

  companies.forEach(company => {
    const companyParticipants = participants.filter(p => p.company_id === company.company_id)

    if (companyParticipants.length > 0) {
      const companyData = [
        [`EMPRESA: ${company.company_name}`],
        [],
        [
          'Nombre Completo',
          'Email',
          'DNI',
          'Área',
          'Total Cursos',
          'Completados',
          'En Progreso',
          'Certificados',
          'Progreso (%)'
        ]
      ]

      companyParticipants.forEach(p => {
        companyData.push([
          `${p.first_name} ${p.last_name}`,
          p.email,
          p.dni || '',
          p.area || '',
          p.total_courses,
          p.completed_courses,
          p.in_progress_courses,
          p.certificates_generated,
          p.overall_progress
        ])
      })

      const companySheet = XLSX.utils.aoa_to_sheet(companyData)

      companySheet['!cols'] = [
        { wch: 30 },
        { wch: 30 },
        { wch: 12 },
        { wch: 20 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 }
      ]

      const sheetName = company.company_name.substring(0, 30)
      XLSX.utils.book_append_sheet(workbook, companySheet, sheetName)
    }
  })

  const date = new Date().toISOString().split('T')[0]
  const fileName = `Reporte_Progreso_Participantes_${date}.xlsx`

  XLSX.writeFile(workbook, fileName)
}
