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
    }
    signed_at: string
  }>
}

export class ExcelExporter {
  static exportAttendanceToExcel(data: AttendanceExcelData): void {
    // Create CSV content
    let csvContent = "data:text/csv;charset=utf-8,"
    
    // Add headers
    csvContent += "LISTA DE ASISTENCIA - " + data.course.title + "\n\n"
    
    // Company information
    csvContent += "DATOS DEL EMPLEADOR\n"
    csvContent += "Razón Social,RUC,Domicilio,Actividad Económica,Nº Trabajadores\n"
    csvContent += `"${data.company.razon_social}","${data.company.ruc}","${data.company.direccion}, ${data.company.distrito}, ${data.company.departamento}, ${data.company.provincia}","${data.company.actividad_economica}","${data.company.num_trabajadores}"\n\n`
    
    // Course details
    csvContent += "DETALLES DEL CURSO\n"
    csvContent += "Tipo,Tema,Horas,Instructor,Fecha\n"
    csvContent += `"${data.course_type}${data.cargo_otro ? ' - ' + data.cargo_otro : ''}","${data.tema || data.course.title}","${data.course.hours}","${data.instructor_name}","${new Date(data.fecha).toLocaleDateString('es-ES')}"\n\n`
    
    // Participants
    csvContent += "PARTICIPANTES\n"
    csvContent += "Apellidos y Nombres,DNI,Área,Fecha de Firma\n"
    
    if (data.signatures && data.signatures.length > 0) {
      data.signatures.forEach(signature => {
        const fullName = `${signature.user.first_name} ${signature.user.last_name}`
        const dni = signature.user.dni || 'No especificado'
        const area = data.company.razon_social
        const signDate = new Date(signature.signed_at).toLocaleDateString('es-ES')
        csvContent += `"${fullName}","${dni}","${area}","${signDate}"\n`
      })
    } else {
      csvContent += "No hay participantes registrados\n"
    }
    
    // Responsible
    csvContent += "\nRESPONSABLE DEL REGISTRO\n"
    csvContent += "Nombre,Cargo,Fecha\n"
    csvContent += `"${data.responsible_name}","${data.responsible_position}","${new Date(data.fecha).toLocaleDateString('es-ES')}"\n`
    
    // Create and download file
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
    let csvContent = "data:text/csv;charset=utf-8,"
    
    // Headers
    csvContent += "RESUMEN DE PARTICIPANTES POR CURSO\n\n"
    csvContent += "Curso,Empresa,Tipo,Fecha,Participante,DNI,Fecha de Firma,Estado\n"
    
    // Data rows
    attendanceLists.forEach(attendance => {
      if (attendance.signatures && attendance.signatures.length > 0) {
        attendance.signatures.forEach((signature: any) => {
          const courseName = attendance.course?.title || 'Sin título'
          const companyName = attendance.company?.razon_social || 'Sin empresa'
          const courseType = attendance.course_type || 'Sin tipo'
          const attendanceDate = new Date(attendance.fecha).toLocaleDateString('es-ES')
          const participantName = `${signature.user.first_name} ${signature.user.last_name}`
          const dni = signature.user.dni || 'No especificado'
          const signDate = new Date(signature.signed_at).toLocaleDateString('es-ES')
          const status = 'Firmado'
          
          csvContent += `"${courseName}","${companyName}","${courseType}","${attendanceDate}","${participantName}","${dni}","${signDate}","${status}"\n`
        })
      } else {
        // Include attendance lists without participants
        const courseName = attendance.course?.title || 'Sin título'
        const companyName = attendance.company?.razon_social || 'Sin empresa'
        const courseType = attendance.course_type || 'Sin tipo'
        const attendanceDate = new Date(attendance.fecha).toLocaleDateString('es-ES')
        
        csvContent += `"${courseName}","${companyName}","${courseType}","${attendanceDate}","Sin participantes","","","Pendiente"\n`
      }
    })
    
    // Download file
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