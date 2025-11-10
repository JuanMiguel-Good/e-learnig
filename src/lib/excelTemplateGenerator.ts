import * as XLSX from 'xlsx'

export interface ParticipantTemplateRow {
  'DNI *': string
  'Nombres *': string
  'Apellidos *': string
  'Área': string
  'Correo Electrónico *': string
  'Teléfono': string
}

export function generateParticipantsTemplate() {
  const templateData: ParticipantTemplateRow[] = [
    {
      'DNI *': '12345678',
      'Nombres *': 'Juan Carlos',
      'Apellidos *': 'Pérez García',
      'Área': 'Producción',
      'Correo Electrónico *': 'juan.perez@empresa.com',
      'Teléfono': '987654321'
    },
    {
      'DNI *': '87654321',
      'Nombres *': 'María Elena',
      'Apellidos *': 'González López',
      'Área': 'Administración',
      'Correo Electrónico *': 'maria.gonzalez@empresa.com',
      'Teléfono': '912345678'
    }
  ]

  const ws = XLSX.utils.json_to_sheet(templateData)

  const colWidths = [
    { wch: 12 },
    { wch: 20 },
    { wch: 25 },
    { wch: 20 },
    { wch: 30 },
    { wch: 15 }
  ]
  ws['!cols'] = colWidths

  const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
    if (!ws[cellAddress]) continue
    ws[cellAddress].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1E293B' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Participantes')

  XLSX.writeFile(wb, 'plantilla_participantes.xlsx')
}

export interface ParsedParticipant {
  dni: string
  first_name: string
  last_name: string
  area?: string
  email: string
  phone?: string
}

export interface ValidationError {
  row: number
  field: string
  message: string
}

export function parseParticipantsFromExcel(file: File): Promise<{
  participants: ParsedParticipant[]
  errors: ValidationError[]
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

        const participants: ParsedParticipant[] = []
        const errors: ValidationError[] = []

        jsonData.forEach((row, index) => {
          const rowNumber = index + 2

          const dni = String(row['DNI *'] || '').trim()
          const firstName = String(row['Nombres *'] || '').trim()
          const lastName = String(row['Apellidos *'] || '').trim()
          const area = String(row['Área'] || '').trim()
          const email = String(row['Correo Electrónico *'] || '').trim()
          const phone = String(row['Teléfono'] || '').trim()

          if (!dni) {
            errors.push({ row: rowNumber, field: 'DNI', message: 'El DNI es requerido' })
          } else if (!/^\d{8}$/.test(dni)) {
            errors.push({ row: rowNumber, field: 'DNI', message: 'El DNI debe tener 8 dígitos' })
          }

          if (!firstName) {
            errors.push({ row: rowNumber, field: 'Nombres', message: 'Los nombres son requeridos' })
          }

          if (!lastName) {
            errors.push({ row: rowNumber, field: 'Apellidos', message: 'Los apellidos son requeridos' })
          }

          if (!email) {
            errors.push({ row: rowNumber, field: 'Correo Electrónico', message: 'El correo es requerido' })
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push({ row: rowNumber, field: 'Correo Electrónico', message: 'El correo no es válido' })
          }

          if (phone && !/^\d{9}$/.test(phone)) {
            errors.push({ row: rowNumber, field: 'Teléfono', message: 'El teléfono debe tener 9 dígitos' })
          }

          if (dni && firstName && lastName && email) {
            participants.push({
              dni,
              first_name: firstName,
              last_name: lastName,
              area: area || undefined,
              email,
              phone: phone || undefined
            })
          }
        })

        resolve({ participants, errors })
      } catch (error) {
        reject(new Error('Error al leer el archivo Excel'))
      }
    }

    reader.onerror = () => {
      reject(new Error('Error al cargar el archivo'))
    }

    reader.readAsBinaryString(file)
  })
}
