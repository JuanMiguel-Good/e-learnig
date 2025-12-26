import * as ExcelJS from 'exceljs'

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

async function fetchImageAsArrayBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`)
  return await response.arrayBuffer()
}

function formatDateFromISO(isoString: string): string {
  const date = new Date(isoString)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${day}/${month}/${year}`
}

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
    logo_url?: string | null
    codigo?: string | null
    version?: string | null
  }
  course_type: string
  attendance_type?: string
  cargo_otro?: string | null
  tema: string | null
  instructor_name: string
  instructor_signature_url?: string | null
  fecha: string
  responsible_name: string
  responsible_position: string
  responsible_signature_url?: string | null
  responsible_date?: string
  signatures: Array<{
    user: {
      first_name: string
      last_name: string
      dni: string | null
      area?: string | null
    }
    signed_at: string
    signature_data?: string
  }>
}

export class ExcelAttendanceExporter {
  private static readonly PARTICIPANTS_PER_PAGE = 15
  private static readonly GRAY_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE0E0E0' } }
  private static readonly BORDER_STYLE: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }

  static async exportAttendanceToExcel(data: AttendanceExcelData): Promise<void> {
    const workbook = new ExcelJS.Workbook()

    const totalParticipants = data.signatures?.length || 0
    const totalPages = Math.max(1, Math.ceil(totalParticipants / this.PARTICIPANTS_PER_PAGE))

    for (let page = 0; page < totalPages; page++) {
      const startIdx = page * this.PARTICIPANTS_PER_PAGE
      const endIdx = Math.min(startIdx + this.PARTICIPANTS_PER_PAGE, totalParticipants)
      const pageParticipants = data.signatures?.slice(startIdx, endIdx) || []

      const sheetName = totalPages > 1 ? `Página ${page + 1}` : 'Lista de Asistencia'
      const worksheet = workbook.addWorksheet(sheetName)

      await this.createAttendanceSheet(worksheet, data, pageParticipants, workbook)
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const formattedDate = formatDateFromISO(data.fecha).replace(/\//g, '-')
    const fileName = `Lista_Asistencia_${data.course.title.replace(/[^a-zA-Z0-9]/g, '_')}_${formattedDate}.xlsx`
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  private static async createAttendanceSheet(
    worksheet: ExcelJS.Worksheet,
    data: AttendanceExcelData,
    participants: typeof data.signatures,
    workbook: ExcelJS.Workbook
  ): Promise<void> {
    worksheet.properties.defaultColWidth = 10
    worksheet.columns = [
      { width: 3 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 11 },
      { width: 11 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 11 }
    ]

    let currentRow = 1

    currentRow = await this.addHeader(worksheet, data, currentRow, workbook)
    currentRow = this.addEmployerData(worksheet, data, currentRow)
    currentRow = this.addCourseTypeSelection(worksheet, data, currentRow)
    currentRow = await this.addTopicAndInstructor(worksheet, data, currentRow, workbook)
    currentRow = await this.addParticipantsTable(worksheet, participants, currentRow, workbook)
    currentRow = await this.addResponsibleSection(worksheet, data, currentRow, workbook)
  }

  private static async addHeader(
    worksheet: ExcelJS.Worksheet,
    data: AttendanceExcelData,
    startRow: number,
    workbook: ExcelJS.Workbook
  ): Promise<number> {
    const logoCell = worksheet.getCell(startRow, 1)
    const titleCell = worksheet.getCell(startRow, 3)
    const codeCell = worksheet.getCell(startRow, 9)

    worksheet.mergeCells(startRow, 1, startRow + 3, 2)
    worksheet.mergeCells(startRow, 3, startRow + 3, 8)
    worksheet.mergeCells(startRow, 9, startRow + 1, 10)
    worksheet.mergeCells(startRow + 2, 9, startRow + 3, 10)

    if (data.company.logo_url) {
      try {
        const arrayBuffer = await fetchImageAsArrayBuffer(data.company.logo_url)
        const ext = data.company.logo_url.toLowerCase().includes('.jpg') || data.company.logo_url.toLowerCase().includes('.jpeg') ? 'jpeg' : 'png'
        const imageId = workbook.addImage({
          buffer: arrayBuffer,
          extension: ext,
        })
        worksheet.addImage(imageId, {
          tl: { col: 0.1, row: startRow - 0.9 },
          ext: { width: 130, height: 50 }
        })
      } catch (error) {
        console.error('Error loading company logo:', error)
        logoCell.value = 'AQUÍ VA EL LOGO'
        logoCell.alignment = { vertical: 'middle', horizontal: 'center' }
        logoCell.font = { size: 9, bold: true, color: { argb: 'FF666666' } }
      }
    } else {
      logoCell.value = 'AQUÍ VA EL LOGO'
      logoCell.alignment = { vertical: 'middle', horizontal: 'center' }
      logoCell.font = { size: 9, bold: true, color: { argb: 'FF666666' } }
    }

    titleCell.value = 'REGISTRO DE INDUCCIÓN, CAPACITACIÓN, ENTRENAMIENTO Y SIMULACROS DE\nEMERGENCIA'
    titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    titleCell.font = { size: 11, bold: true }

    const codigoLabelCell = worksheet.getCell(startRow, 9)
    codigoLabelCell.value = 'CÓDIGO:'
    codigoLabelCell.alignment = { vertical: 'top', horizontal: 'left' }
    codigoLabelCell.font = { size: 9, bold: true }
    codigoLabelCell.border = { ...this.BORDER_STYLE, bottom: { style: 'thin' } }

    const codigoValueCell = worksheet.getCell(startRow + 1, 9)
    codigoValueCell.value = data.company.codigo || ''
    codigoValueCell.alignment = { vertical: 'middle', horizontal: 'center' }
    codigoValueCell.font = { size: 8 }
    codigoValueCell.border = { ...this.BORDER_STYLE, top: undefined }

    const versionLabelCell = worksheet.getCell(startRow + 2, 9)
    versionLabelCell.value = 'VERSIÓN:'
    versionLabelCell.alignment = { vertical: 'top', horizontal: 'left' }
    versionLabelCell.font = { size: 9, bold: true }
    versionLabelCell.border = { ...this.BORDER_STYLE, bottom: { style: 'thin' } }

    const versionValueCell = worksheet.getCell(startRow + 3, 9)
    versionValueCell.value = data.company.version || ''
    versionValueCell.alignment = { vertical: 'middle', horizontal: 'center' }
    versionValueCell.font = { size: 8 }
    versionValueCell.border = { ...this.BORDER_STYLE, top: undefined }

    logoCell.border = this.BORDER_STYLE
    titleCell.border = this.BORDER_STYLE

    worksheet.getRow(startRow).height = 15
    worksheet.getRow(startRow + 1).height = 15
    worksheet.getRow(startRow + 2).height = 15
    worksheet.getRow(startRow + 3).height = 15

    return startRow + 4
  }

  private static addEmployerData(
    worksheet: ExcelJS.Worksheet,
    data: AttendanceExcelData,
    startRow: number
  ): number {
    const headerRow = worksheet.getRow(startRow)
    const labelRow = worksheet.getRow(startRow + 1)
    const dataRow = worksheet.getRow(startRow + 2)

    worksheet.mergeCells(startRow, 1, startRow, 10)
    const headerCell = worksheet.getCell(startRow, 1)
    headerCell.value = 'DATOS DEL EMPLEADOR:'
    headerCell.fill = this.GRAY_FILL
    headerCell.font = { size: 10, bold: true }
    headerCell.alignment = { vertical: 'middle', horizontal: 'left' }
    headerCell.border = this.BORDER_STYLE

    const labels = [
      { merge: [startRow + 1, 1, startRow + 1, 2], text: 'RAZÓN SOCIAL O\nDENOMINACIÓN SOCIAL' },
      { merge: [startRow + 1, 3, startRow + 1, 3], text: 'RUC' },
      { merge: [startRow + 1, 4, startRow + 1, 6], text: 'DOMICILIO\n(Dirección, distrito, departamento,\nprovincia)' },
      { merge: [startRow + 1, 7, startRow + 1, 8], text: 'ACTIVIDAD\nECONÓMICA' },
      { merge: [startRow + 1, 9, startRow + 1, 10], text: 'Nº TRABAJADORES\nEN EL CENTRO LABORAL' }
    ]

    labels.forEach(({ merge, text }) => {
      worksheet.mergeCells(...merge)
      const cell = worksheet.getCell(merge[0], merge[1])
      cell.value = text
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.font = { size: 9, bold: true }
      cell.border = this.BORDER_STYLE
    })

    const dataValues = [
      { merge: [startRow + 2, 1, startRow + 2, 2], value: data.company.razon_social },
      { merge: [startRow + 2, 3, startRow + 2, 3], value: data.company.ruc },
      { merge: [startRow + 2, 4, startRow + 2, 6], value: `${data.company.direccion}\n${data.company.distrito}, ${data.company.departamento}, ${data.company.provincia}` },
      { merge: [startRow + 2, 7, startRow + 2, 8], value: data.company.actividad_economica },
      { merge: [startRow + 2, 9, startRow + 2, 10], value: data.company.num_trabajadores }
    ]

    dataValues.forEach(({ merge, value }) => {
      worksheet.mergeCells(...merge)
      const cell = worksheet.getCell(merge[0], merge[1])
      cell.value = value
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.font = { size: 8 }
      cell.border = this.BORDER_STYLE
    })

    headerRow.height = 20
    labelRow.height = 35
    dataRow.height = 40

    return startRow + 3
  }

  private static addCourseTypeSelection(
    worksheet: ExcelJS.Worksheet,
    data: AttendanceExcelData,
    startRow: number
  ): number {
    worksheet.mergeCells(startRow, 1, startRow, 10)
    const headerCell = worksheet.getCell(startRow, 1)
    headerCell.value = 'MARCAR (X)'
    headerCell.fill = this.GRAY_FILL
    headerCell.font = { size: 10, bold: true }
    headerCell.alignment = { vertical: 'middle', horizontal: 'center' }
    headerCell.border = this.BORDER_STYLE

    const row1Types = [
      { col: [1, 2], text: 'INDUCCIÓN', type: 'INDUCCIÓN' },
      { col: [3, 4], text: 'CAPACITACIÓN', type: 'CAPACITACIÓN' },
      { col: [5, 7], text: 'ENTRENAMIENTO', type: 'ENTRENAMIENTO' },
      { col: [8, 10], text: 'SIMULACRO DE EMERGENCIA', type: 'SIMULACRO DE EMERGENCIA' }
    ]

    row1Types.forEach(({ col, text, type }) => {
      worksheet.mergeCells(startRow + 1, col[0], startRow + 1, col[1])
      const cell = worksheet.getCell(startRow + 1, col[0])
      const mark = (data.course_type === type || data.attendance_type === type) ? 'X' : ''
      cell.value = `${text}     ${mark}`
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.font = { size: 9, bold: true }
      cell.border = this.BORDER_STYLE
    })

    const row2Types = [
      { col: [1, 2], text: 'CHARLA 5 MINUTOS', type: 'CHARLA 5 MINUTOS' },
      { col: [3, 4], text: 'REUNIÓN', type: 'REUNIÓN' },
      { col: [5, 6], text: 'CARGO', type: 'CARGO' },
      { col: [7, 10], text: 'OTRO', type: 'OTRO' }
    ]

    row2Types.forEach(({ col, text, type }) => {
      worksheet.mergeCells(startRow + 2, col[0], startRow + 2, col[1])
      const cell = worksheet.getCell(startRow + 2, col[0])
      const mark = (data.course_type === type || data.attendance_type === type) ? 'X' : ''
      let value = `${text}     ${mark}`

      if ((type === 'CARGO' || type === 'OTRO') && data.cargo_otro && (data.course_type === type || data.attendance_type === type)) {
        value += `\n${data.cargo_otro}`
      }

      cell.value = value
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.font = { size: 9, bold: true }
      cell.border = this.BORDER_STYLE
    })

    worksheet.getRow(startRow).height = 20
    worksheet.getRow(startRow + 1).height = 22
    worksheet.getRow(startRow + 2).height = 22

    return startRow + 3
  }

  private static async addTopicAndInstructor(
    worksheet: ExcelJS.Worksheet,
    data: AttendanceExcelData,
    startRow: number,
    workbook: ExcelJS.Workbook
  ): Promise<number> {
    worksheet.mergeCells(startRow, 1, startRow, 5)
    const temaCell = worksheet.getCell(startRow, 1)
    temaCell.value = `TEMA:  ${data.tema || data.course.title}`
    temaCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    temaCell.font = { size: 9, bold: true }
    temaCell.border = this.BORDER_STYLE

    worksheet.mergeCells(startRow, 6, startRow, 7)
    const horasCell = worksheet.getCell(startRow, 6)
    horasCell.value = `Nº HORAS:\n${data.course.hours}`
    horasCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    horasCell.font = { size: 9, bold: true }
    horasCell.border = this.BORDER_STYLE

    worksheet.mergeCells(startRow, 8, startRow + 1, 10)
    const instructorCell = worksheet.getCell(startRow, 8)
    instructorCell.value = `NOMBRE DEL\nCAPACITADOR O\nENTRENADOR:\n${data.instructor_name}\n\n\n\nFIRMA`
    instructorCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
    instructorCell.font = { size: 9, bold: true }
    instructorCell.border = this.BORDER_STYLE

    if (data.instructor_signature_url) {
      try {
        const arrayBuffer = await fetchImageAsArrayBuffer(data.instructor_signature_url)
        const imageId = workbook.addImage({
          buffer: arrayBuffer,
          extension: 'png',
        })
        worksheet.addImage(imageId, {
          tl: { col: 8.2, row: startRow - 0.6 },
          ext: { width: 80, height: 40 }
        })
      } catch (error) {
        console.error('Error loading instructor signature:', error)
      }
    }

    worksheet.getRow(startRow).height = 30
    worksheet.getRow(startRow + 1).height = 30

    return startRow + 2
  }

  private static async addParticipantsTable(
    worksheet: ExcelJS.Worksheet,
    participants: AttendanceExcelData['signatures'],
    startRow: number,
    workbook: ExcelJS.Workbook
  ): Promise<number> {
    worksheet.mergeCells(startRow, 1, startRow, 10)
    const headerCell = worksheet.getCell(startRow, 1)
    headerCell.value = 'DATOS DE LOS PARTICIPANTES:'
    headerCell.fill = this.GRAY_FILL
    headerCell.font = { size: 10, bold: true }
    headerCell.alignment = { vertical: 'middle', horizontal: 'left' }
    headerCell.border = this.BORDER_STYLE

    const headers = [
      { col: [1, 4], text: 'APELLIDOS Y NOMBRES DE LOS\nCAPACITADOS' },
      { col: [5, 6], text: 'Nº DNI' },
      { col: [7, 7], text: 'ÁREA' },
      { col: [8, 8], text: 'FECHA' },
      { col: [9, 10], text: 'FIRMA' }
    ]

    headers.forEach(({ col, text }) => {
      worksheet.mergeCells(startRow + 1, col[0], startRow + 1, col[1])
      const cell = worksheet.getCell(startRow + 1, col[0])
      cell.value = text
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.font = { size: 9, bold: true }
      cell.border = this.BORDER_STYLE
    })

    worksheet.getRow(startRow).height = 20
    worksheet.getRow(startRow + 1).height = 25

    let currentRow = startRow + 2
    const rowsToFill = Math.max(this.PARTICIPANTS_PER_PAGE, participants.length)

    for (let i = 0; i < rowsToFill; i++) {
      const participant = participants[i]

      if (participant) {
        worksheet.mergeCells(currentRow, 1, currentRow, 4)
        const nameCell = worksheet.getCell(currentRow, 1)
        nameCell.value = `${participant.user.last_name} ${participant.user.first_name}`
        nameCell.alignment = { vertical: 'middle', horizontal: 'left' }
        nameCell.font = { size: 8 }
        nameCell.border = this.BORDER_STYLE

        worksheet.mergeCells(currentRow, 5, currentRow, 6)
        const dniCell = worksheet.getCell(currentRow, 5)
        dniCell.value = participant.user.dni || ''
        dniCell.alignment = { vertical: 'middle', horizontal: 'center' }
        dniCell.font = { size: 8 }
        dniCell.border = this.BORDER_STYLE

        const areaCell = worksheet.getCell(currentRow, 7)
        areaCell.value = participant.user.area || ''
        areaCell.alignment = { vertical: 'middle', horizontal: 'center' }
        areaCell.font = { size: 7 }
        areaCell.border = this.BORDER_STYLE

        const dateCell = worksheet.getCell(currentRow, 8)
        dateCell.value = new Date(participant.signed_at).toLocaleDateString('es-ES')
        dateCell.alignment = { vertical: 'middle', horizontal: 'center' }
        dateCell.font = { size: 8 }
        dateCell.border = this.BORDER_STYLE

        worksheet.mergeCells(currentRow, 9, currentRow, 10)
        const signCell = worksheet.getCell(currentRow, 9)
        signCell.border = this.BORDER_STYLE

        if (participant.signature_data) {
          try {
            const base64Data = participant.signature_data.replace(/^data:image\/\w+;base64,/, '')
            const arrayBuffer = base64ToArrayBuffer(base64Data)
            const imageId = workbook.addImage({
              buffer: arrayBuffer,
              extension: 'png',
            })
            worksheet.addImage(imageId, {
              tl: { col: 8.1, row: currentRow - 0.85 },
              ext: { width: 70, height: 25 }
            })
          } catch (error) {
            console.error('Error loading participant signature:', error, participant)
          }
        }
      } else {
        worksheet.mergeCells(currentRow, 1, currentRow, 4)
        worksheet.getCell(currentRow, 1).border = this.BORDER_STYLE

        worksheet.mergeCells(currentRow, 5, currentRow, 6)
        worksheet.getCell(currentRow, 5).border = this.BORDER_STYLE

        worksheet.getCell(currentRow, 7).border = this.BORDER_STYLE
        worksheet.getCell(currentRow, 8).border = this.BORDER_STYLE

        worksheet.mergeCells(currentRow, 9, currentRow, 10)
        worksheet.getCell(currentRow, 9).border = this.BORDER_STYLE
      }

      worksheet.getRow(currentRow).height = 28
      currentRow++
    }

    return currentRow
  }

  private static async addResponsibleSection(
    worksheet: ExcelJS.Worksheet,
    data: AttendanceExcelData,
    startRow: number,
    workbook: ExcelJS.Workbook
  ): Promise<number> {
    worksheet.mergeCells(startRow, 1, startRow, 10)
    const headerCell = worksheet.getCell(startRow, 1)
    headerCell.value = 'RESPONSABLE DEL REGISTRO'
    headerCell.fill = this.GRAY_FILL
    headerCell.font = { size: 10, bold: true }
    headerCell.alignment = { vertical: 'middle', horizontal: 'center' }
    headerCell.border = this.BORDER_STYLE

    worksheet.mergeCells(startRow + 1, 1, startRow + 1, 3)
    const nameCell = worksheet.getCell(startRow + 1, 1)
    nameCell.value = `NOMBRE:\n${data.responsible_name}`
    nameCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
    nameCell.font = { size: 9, bold: true }
    nameCell.border = this.BORDER_STYLE

    worksheet.mergeCells(startRow + 1, 4, startRow + 1, 6)
    const cargoCell = worksheet.getCell(startRow + 1, 4)
    cargoCell.value = `CARGO:\n${data.responsible_position}`
    cargoCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
    cargoCell.font = { size: 9, bold: true }
    cargoCell.border = this.BORDER_STYLE

    worksheet.mergeCells(startRow + 1, 7, startRow + 1, 10)
    const fechaCell = worksheet.getCell(startRow + 1, 7)
    const responsibleDate = data.responsible_date || data.fecha
    fechaCell.value = `FECHA:\n${formatDateFromISO(responsibleDate)}\n\n\n\nFIRMA`
    fechaCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
    fechaCell.font = { size: 9, bold: true }
    fechaCell.border = this.BORDER_STYLE

    if (data.responsible_signature_url) {
      try {
        const arrayBuffer = await fetchImageAsArrayBuffer(data.responsible_signature_url)
        const imageId = workbook.addImage({
          buffer: arrayBuffer,
          extension: 'png',
        })
        worksheet.addImage(imageId, {
          tl: { col: 7.5, row: startRow + 0.1 },
          ext: { width: 80, height: 40 }
        })
      } catch (error) {
        console.error('Error loading responsible signature:', error)
      }
    }

    worksheet.getRow(startRow).height = 20
    worksheet.getRow(startRow + 1).height = 40

    return startRow + 2
  }

  static async exportParticipantsSummary(attendanceLists: any[]): Promise<void> {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Resumen de Asistencias')

    worksheet.columns = [
      { width: 25 }, { width: 25 }, { width: 15 }, { width: 12 },
      { width: 25 }, { width: 12 }, { width: 15 }, { width: 12 }, { width: 12 }
    ]

    const titleRow = worksheet.getRow(1)
    worksheet.mergeCells(1, 1, 1, 9)
    const titleCell = worksheet.getCell(1, 1)
    titleCell.value = 'RESUMEN DE PARTICIPANTES POR CURSO'
    titleCell.fill = this.GRAY_FILL
    titleCell.font = { size: 14, bold: true }
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
    titleRow.height = 25

    const headerRow = worksheet.getRow(2)
    const headers = ['Curso', 'Empresa', 'Tipo', 'Fecha', 'Participante', 'DNI', 'Área', 'Fecha de Firma', 'Estado']
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1)
      cell.value = header
      cell.fill = this.GRAY_FILL
      cell.font = { size: 10, bold: true }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = this.BORDER_STYLE
    })
    headerRow.height = 20

    let currentRow = 3

    attendanceLists.forEach(attendance => {
      if (attendance.signatures && attendance.signatures.length > 0) {
        attendance.signatures.forEach((signature: any) => {
          const row = worksheet.getRow(currentRow)
          const cells = [
            attendance.course?.title || 'Sin título',
            attendance.company?.razon_social || 'Sin empresa',
            attendance.course_type || 'Sin tipo',
            formatDateFromISO(attendance.fecha),
            `${signature.user.last_name} ${signature.user.first_name}`,
            signature.user.dni || 'No especificado',
            signature.user.area || '',
            formatDateFromISO(signature.signed_at),
            'Firmado'
          ]

          cells.forEach((value, index) => {
            const cell = row.getCell(index + 1)
            cell.value = value
            cell.alignment = { vertical: 'middle', horizontal: 'left' }
            cell.font = { size: 9 }
            cell.border = this.BORDER_STYLE
          })

          row.height = 18
          currentRow++
        })
      } else {
        const row = worksheet.getRow(currentRow)
        const cells = [
          attendance.course?.title || 'Sin título',
          attendance.company?.razon_social || 'Sin empresa',
          attendance.course_type || 'Sin tipo',
          formatDateFromISO(attendance.fecha),
          'Sin participantes',
          '',
          '',
          '',
          'Pendiente'
        ]

        cells.forEach((value, index) => {
          const cell = row.getCell(index + 1)
          cell.value = value
          cell.alignment = { vertical: 'middle', horizontal: 'left' }
          cell.font = { size: 9 }
          cell.border = this.BORDER_STYLE
        })

        row.height = 18
        currentRow++
      }
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const fileName = `Resumen_Asistencias_${new Date().toLocaleDateString('es-ES').replace(/\//g, '-')}.xlsx`
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }
}
