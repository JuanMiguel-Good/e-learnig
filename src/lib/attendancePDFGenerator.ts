import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface AttendanceData {
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
    signature_data: string
  }>
}

export class AttendancePDFGenerator {
  static async generatePDF(data: AttendanceData): Promise<void> {
    // Create a hidden container for the attendance list
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.top = '-9999px'
    container.style.left = '-9999px'
    container.style.width = '794px'  // A4 portrait width at 96 DPI
    container.style.height = '1123px' // A4 portrait height at 96 DPI
    container.style.backgroundColor = 'white'
    container.style.fontFamily = 'Arial, sans-serif'
    container.style.fontSize = '10px'
    container.style.padding = '20px'
    container.style.boxSizing = 'border-box'
    
    // Create attendance list HTML content
    container.innerHTML = `
      <div style="width: 100%; margin: 0 auto; background: white;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 14px; font-weight: bold; text-transform: uppercase;">
            REGISTRO DE INDUCCIÓN, CAPACITACIÓN, ENTRENAMIENTO Y SIMULACROS DE EMERGENCIA
          </h2>
        </div>

        <!-- Company Data Section -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid black; margin-bottom: 15px;">
          <thead>
            <tr>
              <th colspan="5" style="background-color: #f0f0f0; padding: 5px; border: 1px solid black; font-size: 10px; font-weight: bold; text-align: center;">
                DATOS DEL EMPLEADOR
              </th>
            </tr>
            <tr style="height: 40px;">
              <th style="border: 1px solid black; padding: 5px; width: 25%; font-size: 9px; text-align: center; font-weight: bold;">
                RAZÓN SOCIAL O<br>DENOMINACIÓN SOCIAL
              </th>
              <th style="border: 1px solid black; padding: 5px; width: 15%; font-size: 9px; text-align: center; font-weight: bold;">
                RUC
              </th>
              <th style="border: 1px solid black; padding: 5px; width: 30%; font-size: 9px; text-align: center; font-weight: bold;">
                DOMICILIO<br><span style="font-size: 8px;">(Dirección, distrito, departamento, provincia)</span>
              </th>
              <th style="border: 1px solid black; padding: 5px; width: 20%; font-size: 9px; text-align: center; font-weight: bold;">
                ACTIVIDAD<br>ECONÓMICA
              </th>
              <th style="border: 1px solid black; padding: 5px; width: 10%; font-size: 9px; text-align: center; font-weight: bold;">
                Nº TRABAJADORES<br>EN EL CENTRO LABORAL
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style="height: 60px;">
              <td style="border: 1px solid black; padding: 5px; text-align: center; font-size: 9px; vertical-align: top;">
                ${data.company.razon_social}
              </td>
              <td style="border: 1px solid black; padding: 5px; text-align: center; font-size: 9px; vertical-align: top;">
                ${data.company.ruc}
              </td>
              <td style="border: 1px solid black; padding: 5px; text-align: center; font-size: 8px; vertical-align: top;">
                ${data.company.direccion}<br>
                ${data.company.distrito}, ${data.company.departamento}, ${data.company.provincia}
              </td>
              <td style="border: 1px solid black; padding: 5px; text-align: center; font-size: 8px; vertical-align: top;">
                ${data.company.actividad_economica}
              </td>
              <td style="border: 1px solid black; padding: 5px; text-align: center; font-size: 9px; vertical-align: top;">
                ${data.company.num_trabajadores}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Course Type Selection -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid black; margin-bottom: 15px;">
          <thead>
            <tr>
              <th colspan="4" style="background-color: #f0f0f0; padding: 5px; border: 1px solid black; font-size: 10px; font-weight: bold; text-align: center;">
                MARCAR (X)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style="height: 30px;">
              <td style="border: 1px solid black; padding: 5px; width: 25%; text-align: center; font-size: 9px; font-weight: bold;">
                INDUCCIÓN<br>
                <span style="font-size: 16px; font-weight: bold;">
                  ${data.course_type === 'INDUCCIÓN' ? 'X' : ''}
                </span>
              </td>
              <td style="border: 1px solid black; padding: 5px; width: 25%; text-align: center; font-size: 9px; font-weight: bold;">
                CAPACITACIÓN<br>
                <span style="font-size: 16px; font-weight: bold;">
                  ${data.course_type === 'CAPACITACIÓN' ? 'X' : ''}
                </span>
              </td>
              <td style="border: 1px solid black; padding: 5px; width: 25%; text-align: center; font-size: 9px; font-weight: bold;">
                ENTRENAMIENTO<br>
                <span style="font-size: 16px; font-weight: bold;">
                  ${data.course_type === 'ENTRENAMIENTO' ? 'X' : ''}
                </span>
              </td>
              <td style="border: 1px solid black; padding: 5px; width: 25%; text-align: center; font-size: 8px; font-weight: bold;">
                SIMULACRO DE EMERGENCIA<br>
                <span style="font-size: 16px; font-weight: bold;">
                  ${data.course_type === 'SIMULACRO DE EMERGENCIA' ? 'X' : ''}
                </span>
              </td>
            </tr>
            <tr style="height: 30px;">
              <td style="border: 1px solid black; padding: 5px; text-align: center; font-size: 9px; font-weight: bold;">
                CHARLA 5 MINUTOS<br>
                <span style="font-size: 16px; font-weight: bold;">
                  ${data.course_type === 'CHARLA 5 MINUTOS' ? 'X' : ''}
                </span>
              </td>
              <td style="border: 1px solid black; padding: 5px; text-align: center; font-size: 9px; font-weight: bold;">
                REUNIÓN<br>
                <span style="font-size: 16px; font-weight: bold;">
                  ${data.course_type === 'REUNIÓN' ? 'X' : ''}
                </span>
              </td>
              <td style="border: 1px solid black; padding: 5px; text-align: center; font-size: 9px; font-weight: bold;">
                CARGO<br>
                <span style="font-size: 16px; font-weight: bold;">
                  ${data.course_type === 'CARGO' ? 'X' : ''}
                </span>
                ${data.course_type === 'CARGO' && data.cargo_otro ? 
                  `<br><span style="font-size: 8px;">${data.cargo_otro}</span>` : ''}
              </td>
              <td style="border: 1px solid black; padding: 5px; text-align: center; font-size: 9px; font-weight: bold;">
                OTRO<br>
                <span style="font-size: 16px; font-weight: bold;">
                  ${data.course_type === 'OTRO' ? 'X' : ''}
                </span>
                ${data.course_type === 'OTRO' && data.cargo_otro ? 
                  `<br><span style="font-size: 8px;">${data.cargo_otro}</span>` : ''}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Topic and Hours -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid black; margin-bottom: 15px;">
          <tbody>
            <tr style="height: 60px;">
              <td style="border: 1px solid black; padding: 5px; width: 50%; font-size: 9px; vertical-align: top;">
                <strong>TEMA:</strong><br>
                <span style="font-size: 9px;">${data.tema || data.course.title}</span>
              </td>
              <td style="border: 1px solid black; padding: 5px; width: 25%; text-align: center; font-size: 9px; vertical-align: top;">
                <strong>Nº HORAS:</strong><br>
                <span style="font-size: 14px; font-weight: bold;">${data.course.hours}</span>
              </td>
              <td style="border: 1px solid black; padding: 5px; width: 25%; font-size: 9px; vertical-align: top;">
                <strong>NOMBRE DEL CAPACITADOR:</strong><br>
                <span style="font-size: 9px;">${data.instructor_name}</span><br><br>
                <div style="text-align: right; font-size: 8px; font-weight: bold;">FIRMA:</div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Participants Table -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid black; margin-bottom: 15px;">
          <thead>
            <tr>
              <th colspan="5" style="background-color: #f0f0f0; padding: 5px; border: 1px solid black; font-size: 10px; font-weight: bold; text-align: center;">
                DATOS DE LOS PARTICIPANTES
              </th>
            </tr>
            <tr style="height: 30px;">
              <th style="border: 1px solid black; padding: 5px; width: 35%; font-size: 9px; text-align: center; font-weight: bold;">
                APELLIDOS Y NOMBRES DE LOS CAPACITADOS
              </th>
              <th style="border: 1px solid black; padding: 5px; width: 15%; font-size: 9px; text-align: center; font-weight: bold;">
                Nº DNI
              </th>
              <th style="border: 1px solid black; padding: 5px; width: 20%; font-size: 9px; text-align: center; font-weight: bold;">
                ÁREA
              </th>
              <th style="border: 1px solid black; padding: 5px; width: 15%; font-size: 9px; text-align: center; font-weight: bold;">
                FECHA
              </th>
              <th style="border: 1px solid black; padding: 5px; width: 15%; font-size: 9px; text-align: center; font-weight: bold;">
                FIRMA
              </th>
            </tr>
          </thead>
          <tbody>
            ${data.signatures && data.signatures.length > 0 ? data.signatures.map((signature) => `
              <tr style="height: 40px;">
                <td style="border: 1px solid black; padding: 3px; font-size: 8px; vertical-align: middle;">
                  ${signature.user.first_name} ${signature.user.last_name}
                </td>
                <td style="border: 1px solid black; padding: 3px; text-align: center; font-size: 8px; vertical-align: middle;">
                  ${signature.user.dni || ''}
                </td>
                <td style="border: 1px solid black; padding: 3px; text-align: center; font-size: 8px; vertical-align: middle;">
                  ${data.company.razon_social}
                </td>
                <td style="border: 1px solid black; padding: 3px; text-align: center; font-size: 8px; vertical-align: middle;">
                  ${new Date(signature.signed_at).toLocaleDateString('es-ES')}
                </td>
                <td style="border: 1px solid black; padding: 3px; text-align: center; vertical-align: middle;">
                  ${signature.signature_data ? 
                    `<img src="data:image/png;base64,${signature.signature_data}" style="max-height: 25px; max-width: 80px;" />` : 
                    ''
                  }
                </td>
              </tr>
            `).join('') : `
              <tr style="height: 40px;">
                <td colspan="5" style="border: 1px solid black; padding: 10px; text-align: center; font-size: 9px; color: #666;">
                  No hay participantes registrados
                </td>
              </tr>
            `}
            <!-- Add empty rows to fill the page -->
            ${Array.from({ length: Math.max(0, 8 - (data.signatures?.length || 0)) }, (_, index) => `
              <tr style="height: 40px;">
                <td style="border: 1px solid black; padding: 3px;">&nbsp;</td>
                <td style="border: 1px solid black; padding: 3px;">&nbsp;</td>
                <td style="border: 1px solid black; padding: 3px;">&nbsp;</td>
                <td style="border: 1px solid black; padding: 3px;">&nbsp;</td>
                <td style="border: 1px solid black; padding: 3px;">&nbsp;</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Responsible Section -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid black;">
          <thead>
            <tr>
              <th colspan="3" style="background-color: #f0f0f0; padding: 5px; border: 1px solid black; font-size: 10px; font-weight: bold; text-align: center;">
                RESPONSABLE DEL REGISTRO
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style="height: 60px;">
              <td style="border: 1px solid black; padding: 5px; width: 40%; font-size: 9px; vertical-align: top;">
                <strong>NOMBRE:</strong><br>
                <span style="font-size: 9px;">${data.responsible_name}</span>
              </td>
              <td style="border: 1px solid black; padding: 5px; width: 30%; font-size: 9px; vertical-align: top;">
                <strong>CARGO:</strong><br>
                <span style="font-size: 9px;">${data.responsible_position}</span>
              </td>
              <td style="border: 1px solid black; padding: 5px; width: 30%; font-size: 9px; vertical-align: top;">
                <strong>FECHA:</strong><br>
                <span style="font-size: 9px;">${new Date(data.fecha).toLocaleDateString('es-ES')}</span><br><br>
                <div style="text-align: right; font-size: 8px; font-weight: bold;">FIRMA:</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `
    
    document.body.appendChild(container)
    
    // Wait a bit for rendering and then generate PDF
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: 'white'
          })
          
          document.body.removeChild(container)
          
          // Create PDF
          const pdf = new jsPDF('portrait', 'mm', 'a4')
          const imgData = canvas.toDataURL('image/png')
          
          // Calculate dimensions to fit the page
          const imgWidth = 210 // A4 width in mm
          const imgHeight = (canvas.height * imgWidth) / canvas.width
          
          pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
          
          // Download the PDF
          const fileName = `Lista_Asistencia_${data.course.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date(data.fecha).toLocaleDateString('es-ES').replace(/\//g, '-')}.pdf`
          pdf.save(fileName)
          
          resolve()
        } catch (error) {
          if (document.body.contains(container)) {
            document.body.removeChild(container)
          }
          reject(error)
        }
      }, 1500)
    })
  }
}