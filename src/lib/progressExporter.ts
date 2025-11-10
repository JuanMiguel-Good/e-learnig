import * as XLSX from 'xlsx'

interface ProgressRecord {
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
  }
  status: string
  progress: number
  started_at: string | null
  last_activity_at: string | null
  completed_at: string | null
  assigned_at: string
  days_inactive: number | null
}

const getStatusLabel = (status: string): string => {
  const statusLabels: Record<string, string> = {
    not_started: 'No Iniciado',
    in_progress: 'En Progreso',
    lessons_completed: 'Lecciones Completas',
    evaluation_pending: 'Evaluación Pendiente',
    evaluation_passed: 'Evaluación Aprobada',
    signature_pending: 'Firma Pendiente',
    completed: 'Completado',
    certificate_generated: 'Certificado Generado'
  }
  return statusLabels[status] || status
}

export const exportProgressToExcel = (records: ProgressRecord[]) => {
  const data = records.map(record => ({
    'Nombre': `${record.user.first_name} ${record.user.last_name}`,
    'Email': record.user.email,
    'DNI': record.user.dni || '-',
    'Área': record.user.area || '-',
    'Empresa': record.user.company?.razon_social || '-',
    'Curso': record.course.title,
    'Estado': getStatusLabel(record.status),
    'Progreso (%)': record.progress,
    'Fecha Asignación': record.assigned_at ? new Date(record.assigned_at).toLocaleDateString() : '-',
    'Fecha Inicio': record.started_at ? new Date(record.started_at).toLocaleDateString() : '-',
    'Última Actividad': record.last_activity_at ? new Date(record.last_activity_at).toLocaleDateString() : '-',
    'Fecha Completado': record.completed_at ? new Date(record.completed_at).toLocaleDateString() : '-',
    'Días Inactivo': record.days_inactive !== null ? record.days_inactive : '-'
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)

  const colWidths = [
    { wch: 25 },
    { wch: 30 },
    { wch: 12 },
    { wch: 20 },
    { wch: 30 },
    { wch: 40 },
    { wch: 25 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 15 }
  ]
  worksheet['!cols'] = colWidths

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Seguimiento')

  const fileName = `seguimiento_participantes_${new Date().toISOString().split('T')[0]}.xlsx`
  XLSX.writeFile(workbook, fileName)
}
