interface AttendanceExcelData {
  course: {
    title: string
    hours: number
  }
  company: {
    razon_social: string
    ruc: string
    direccion: string
    distrito: string
    departamento: string
    provincia: string
    actividad_economica: string
    num_trabajadores: number
  }
  course_type: string
  cargo_otro?: string | null
  tema: string | null
  instructor_name: string
  fecha: string
  responsible_name: string
  responsible_position: string
  signatures: Array<{
    user: {
      first_name: string
      last_name: string
      dni: string | null
      area?: string | null
    }
    signed_at: string
  }>
}

export class ExcelExporter {
  static exportAttendanceToExcel(data: AttendanceExcelData): void {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"

    csvContent += "REGISTRO DE INDUCCIÓN CAPACITACIÓN ENTRENAMIENTO Y SIMULACROS DE EMERGENCIA\n\n"

    csvContent += "DATOS DEL EMPLEADOR:\n"
    csvContent += "Razón Social o Denominación Social,RUC,Domicilio,Actividad Económica,Nº Trabajadores en el Centro Laboral\n"
    csvContent += `"${data.company.razon_social}","${data.company.ruc}","${data.company.direccion} ${data.company.distrito} ${data.company.departamento} ${data.company.provincia}","${data.company.actividad_economica}","${data.company.num_trabajadores}"\n\n`

    csvContent += "MARCAR (X)\n"
    const typeMarks = {
      'INDUCCIÓN': data.course_type === 'INDUCCIÓN' ? 'X' : '',
      'CAPACITACIÓN': data.course_type === 'CAPACITACIÓN' ? 'X' : '',
      'ENTRENAMIENTO': data.course_type === 'ENTRENAMIENTO' ? 'X' : '',
      'SIMULACRO DE EMERGENCIA': data.course_type === 'SIMULACRO DE EMERGENCIA' ? 'X' : '',
      'CHARLA 5 MINUTOS': data.course_type === 'CHARLA 5 MINUTOS' ? 'X' : '',
      'REUNIÓN': data.course_type === 'REUNIÓN' ? 'X' : '',
      'CARGO': data.course_type === 'CARGO' ? 'X' : '',
      'OTRO': data.course_type === 'OTRO' ? 'X' : ''
    }
    csvContent += "INDUCCIÓN,CAPACITACIÓN,ENTRENAMIENTO,SIMULACRO DE EMERGENCIA\n"
    csvContent += `"${typeMarks['INDUCCIÓN']}","${typeMarks['CAPACITACIÓN']}","${typeMarks['ENTRENAMIENTO']}","${typeMarks['SIMULACRO DE EMERGENCIA']}"\n`
    csvContent += "CHARLA 5 MINUTOS,REUNIÓN,CARGO,OTRO\n"
    csvContent += `"${typeMarks['CHARLA 5 MINUTOS']}","${typeMarks['REUNIÓN']}","${typeMarks['CARGO']}${data.cargo_otro && data.course_type === 'CARGO' ? ': ' + data.cargo_otro : ''}","${typeMarks['OTRO']}${data.cargo_otro && data.course_type === 'OTRO' ? ': ' + data.cargo_otro : ''}"\n\n`

    csvContent += "TEMA,Nº HORAS,NOMBRE DEL CAPACITADOR O ENTRENADOR\n"
    csvContent += `"${data.tema || data.course.title}","${data.course.hours}","${data.instructor_name}"\n\n`

    csvContent += "DATOS DE LOS PARTICIPANTES:\n"
    csvContent += "Apellidos y Nombres de los Capacitados,Nº DNI,ÁREA,FECHA,FIRMA\n"

    if (data.signatures && data.signatures.length > 0) {
      data.signatures.forEach(signature => {
        const fullName = `${signature.user.last_name} ${signature.user.first_name}`
        const dni = signature.user.dni || ''
        const area = signature.user.area || ''
        const signDate = new Date(signature.signed_at).toLocaleDateString('es-ES')
        csvContent += `"${fullName}","${dni}","${area}","${signDate}","Firmado"\n`
      })
    } else {
      csvContent += "Sin participantes registrados,,,,"
    }

    for (let i = data.signatures?.length || 0; i < 10; i++) {
      csvContent += ",,,,"
      csvContent += "\n"
    }

    csvContent += "\nRESPONSABLE DEL REGISTRO\n"
    csvContent += "NOMBRE,CARGO,FECHA\n"
    csvContent += `"${data.responsible_name}","${data.responsible_position}","${new Date(data.fecha).toLocaleDateString('es-ES')}"\n`

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)

    const fileName = `Lista_Asistencia_${data.course.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date(data.fecha).toLocaleDateString('es-ES').replace(/\//g, '-')}.csv`
    link.setAttribute("download", fileName)

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  static exportParticipantsSummary(attendanceLists: any[]): void {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"

    csvContent += "RESUMEN DE PARTICIPANTES POR CURSO\n\n"
    csvContent += "Curso,Empresa,Tipo,Fecha,Participante,DNI,Área,Fecha de Firma,Estado\n"

    attendanceLists.forEach(attendance => {
      if (attendance.signatures && attendance.signatures.length > 0) {
        attendance.signatures.forEach((signature: any) => {
          const courseName = attendance.course?.title || 'Sin título'
          const companyName = attendance.company?.razon_social || 'Sin empresa'
          const courseType = attendance.course_type || 'Sin tipo'
          const attendanceDate = new Date(attendance.fecha).toLocaleDateString('es-ES')
          const participantName = `${signature.user.last_name} ${signature.user.first_name}`
          const dni = signature.user.dni || 'No especificado'
          const area = signature.user.area || ''
          const signDate = new Date(signature.signed_at).toLocaleDateString('es-ES')
          const status = 'Firmado'

          csvContent += `"${courseName}","${companyName}","${courseType}","${attendanceDate}","${participantName}","${dni}","${area}","${signDate}","${status}"\n`
        })
      } else {
        const courseName = attendance.course?.title || 'Sin título'
        const companyName = attendance.company?.razon_social || 'Sin empresa'
        const courseType = attendance.course_type || 'Sin tipo'
        const attendanceDate = new Date(attendance.fecha).toLocaleDateString('es-ES')

        csvContent += `"${courseName}","${companyName}","${courseType}","${attendanceDate}","Sin participantes","","","","Pendiente"\n`
      }
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)

    const fileName = `Resumen_Asistencias_${new Date().toLocaleDateString('es-ES').replace(/\//g, '-')}.csv`
    link.setAttribute("download", fileName)

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}
