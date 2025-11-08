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
    codigo?: string | null
    version?: string | null
  }
  course_type: string
  cargo_otro?: string | null
  tema: string | null
  instructor_name: string
  instructor_signature_url?: string | null
  fecha: string
  responsible_name: string
  responsible_position: string
  responsible_signature_url?: string | null
  signatures: Array<{
    user: {
      first_name: string
      last_name: string
      dni: string | null
      area?: string | null
    }
    signed_at: string
    signature_data: string
  }>
}

export class AttendancePDFGenerator {
  static async generatePDF(data: AttendanceData): Promise<void> {
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.top = '-9999px'
    container.style.left = '-9999px'
    container.style.width = '794px'
    container.style.height = 'auto'
    container.style.backgroundColor = 'white'
    container.style.fontFamily = 'Arial, sans-serif'
    container.style.fontSize = '10px'
    container.style.padding = '15px'
    container.style.boxSizing = 'border-box'

    container.innerHTML = `
      <div style="width: 100%; margin: 0 auto; background: white;">
        <!-- Header with Logo, Title, and Version -->
        <table style="width: 100%; border-collapse: collapse; border: 2px solid black; margin-bottom: 10px;">
          <tr>
            <td style="border: 2px solid black; padding: 10px; width: 180px; text-align: center; vertical-align: middle;">
              ${data.company.logo_url ?
                `<img src="${data.company.logo_url}" style="max-width: 160px; max-height: 60px; object-fit: contain;" alt="Logo" />` :
                '<div style="font-size: 10px; font-weight: bold; color: #666;">AQUÍ VA EL LOGO</div>'
              }
            </td>
            <td style="border: 2px solid black; padding: 10px; text-align: center; vertical-align: middle;">
              <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; line-height: 1.3;">
                REGISTRO DE INDUCCIÓN, CAPACITACIÓN, ENTRENAMIENTO Y SIMULACROS DE<br>EMERGENCIA
              </div>
            </td>
            <td style="border: 2px solid black; padding: 5px; width: 100px; vertical-align: top;">
              <div style="border-bottom: 1px solid black; padding: 3px; font-size: 9px; font-weight: bold;">
                CÓDIGO:
              </div>
              <div style="border-bottom: 1px solid black; padding: 3px; font-size: 8px; height: 18px;">
                ${data.company.codigo || ''}
              </div>
              <div style="padding: 3px; font-size: 9px; font-weight: bold;">
                VERSIÓN:
              </div>
              <div style="padding: 3px; font-size: 8px; height: 18px;">
                ${data.company.version || ''}
              </div>
            </td>
          </tr>
        </table>

        <!-- Company Data Section -->
        <table style="width: 100%; border-collapse: collapse; border: 2px solid black; margin-bottom: 10px;">
          <thead>
            <tr>
              <th colspan="5" style="background-color: #e0e0e0; padding: 5px; border: 1px solid black; font-size: 10px; font-weight: bold; text-align: left;">
                DATOS DEL EMPLEADOR:
              </th>
            </tr>
            <tr>
              <th style="border: 1px solid black; padding: 5px; width: 25%; font-size: 9px; text-align: center; font-weight: bold;">
                RAZÓN SOCIAL O<br>DENOMINACIÓN SOCIAL
              </th>
              <th style="border: 1px solid black; padding: 5px; width: 12%; font-size: 9px; text-align: center; font-weight: bold;">
                RUC
              </th>
              <th style="border: 1px solid black; padding: 5px; width: 30%; font-size: 9px; text-align: center; font-weight: bold;">
                DOMICILIO<br><span style="font-size: 8px; font-weight: normal;">(Dirección, distrito, departamento,<br>provincia)</span>
              </th>
              <th style="border: 1px solid black; padding: 5px; width: 18%; font-size: 9px; text-align: center; font-weight: bold;">
                ACTIVIDAD<br>ECONÓMICA
              </th>
              <th style="border: 1px solid black; padding: 5px; width: 15%; font-size: 9px; text-align: center; font-weight: bold;">
                Nº TRABAJADORES<br>EN EL CENTRO LABORAL
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style="height: 50px;">
              <td style="border: 1px solid black; padding: 5px; text-align: center; font-size: 8px; vertical-align: middle;">
                ${data.company.razon_social}
              </td>
              <td style="border: 1px solid black; padding: 5px; text-align: center; font-size: 8px; vertical-align: middle;">
                ${data.company.ruc}
              </td>
              <td style="border: 1px solid black; padding: 5px; text-align: center; font-size: 7px; vertical-align: middle;">
                ${data.company.direccion}<br>
                ${data.company.distrito}, ${data.company.departamento}, ${data.company.provincia}
              </td>
              <td style="border: 1px solid black; padding: 5px; text-align: center; font-size: 7px; vertical-align: middle;">
                ${data.company.actividad_economica}
              </td>
              <td style="border: 1px solid black; padding: 5px; text-align: center; font-size: 8px; vertical-align: middle;">
                ${data.company.num_trabajadores}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Course Type Selection -->
        <table style="width: 100%; border-collapse: collapse; border: 2px solid black; margin-bottom: 10px;">
          <thead>
            <tr>
              <th colspan="4" style="background-color: #e0e0e0; padding: 5px; border: 1px solid black; font-size: 10px; font-weight: bold; text-align: center;">
                MARCAR (X)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style="height: 28px;">
              <td style="border: 1px solid black; padding: 3px; width: 25%; text-align: center; font-size: 9px;">
                <span style="font-weight: bold;">INDUCCIÓN</span>
                <span style="font-size: 18px; font-weight: bold; margin-left: 5px;">
                  ${data.course_type === 'INDUCCIÓN' ? 'X' : ''}
                </span>
              </td>
              <td style="border: 1px solid black; padding: 3px; width: 25%; text-align: center; font-size: 9px;">
                <span style="font-weight: bold;">CAPACITACIÓN</span>
                <span style="font-size: 18px; font-weight: bold; margin-left: 5px;">
                  ${data.course_type === 'CAPACITACIÓN' ? 'X' : ''}
                </span>
              </td>
              <td style="border: 1px solid black; padding: 3px; width: 25%; text-align: center; font-size: 9px;">
                <span style="font-weight: bold;">ENTRENAMIENTO</span>
                <span style="font-size: 18px; font-weight: bold; margin-left: 5px;">
                  ${data.course_type === 'ENTRENAMIENTO' ? 'X' : ''}
                </span>
              </td>
              <td style="border: 1px solid black; padding: 3px; width: 25%; text-align: center; font-size: 8px;">
                <span style="font-weight: bold;">SIMULACRO DE EMERGENCIA</span>
                <span style="font-size: 18px; font-weight: bold; margin-left: 5px;">
                  ${data.course_type === 'SIMULACRO DE EMERGENCIA' ? 'X' : ''}
                </span>
              </td>
            </tr>
            <tr style="height: 28px;">
              <td style="border: 1px solid black; padding: 3px; text-align: center; font-size: 9px;">
                <span style="font-weight: bold;">CHARLA 5 MINUTOS</span>
                <span style="font-size: 18px; font-weight: bold; margin-left: 5px;">
                  ${data.course_type === 'CHARLA 5 MINUTOS' ? 'X' : ''}
                </span>
              </td>
              <td style="border: 1px solid black; padding: 3px; text-align: center; font-size: 9px;">
                <span style="font-weight: bold;">REUNIÓN</span>
                <span style="font-size: 18px; font-weight: bold; margin-left: 5px;">
                  ${data.course_type === 'REUNIÓN' ? 'X' : ''}
                </span>
              </td>
              <td style="border: 1px solid black; padding: 3px; text-align: center; font-size: 9px;">
                <span style="font-weight: bold;">CARGO</span>
                <span style="font-size: 18px; font-weight: bold; margin-left: 5px;">
                  ${data.course_type === 'CARGO' ? 'X' : ''}
                </span>
                ${data.course_type === 'CARGO' && data.cargo_otro ?
                  `<div style="font-size: 7px; margin-top: 2px;">${data.cargo_otro}</div>` : ''}
              </td>
              <td style="border: 1px solid black; padding: 3px; text-align: center; font-size: 9px;">
                <span style="font-weight: bold;">OTRO</span>
                <span style="font-size: 18px; font-weight: bold; margin-left: 5px;">
                  ${data.course_type === 'OTRO' ? 'X' : ''}
                </span>
                ${data.course_type === 'OTRO' && data.cargo_otro ?
                  `<div style="font-size: 7px; margin-top: 2px;">${data.cargo_otro}</div>` : ''}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Topic, Hours and Instructor -->
        <table style="width: 100%; border-collapse: collapse; border: 2px solid black; margin-bottom: 10px;">
          <tbody>
            <tr>
              <td style="border: 1px solid black; padding: 5px; width: 55%; font-size: 9px; vertical-align: top;">
                <div style="display: flex; align-items: flex-start;">
                  <span style="font-weight: bold; margin-right: 5px;">TEMA:</span>
                  <span style="font-size: 8px;">${data.tema || data.course.title}</span>
                </div>
              </td>
              <td style="border: 1px solid black; padding: 5px; width: 20%; font-size: 9px; vertical-align: top;">
                <div style="text-align: center;">
                  <div style="font-weight: bold; margin-bottom: 3px;">Nº HORAS:</div>
                  <div style="height: 30px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 12px; font-weight: bold;">${data.course.hours}</span>
                  </div>
                </div>
              </td>
              <td rowspan="2" style="border: 1px solid black; padding: 5px; width: 25%; font-size: 9px; vertical-align: top;">
                <div>
                  <div style="font-weight: bold; margin-bottom: 3px;">NOMBRE DEL<br>CAPACITADOR O<br>ENTRENADOR:</div>
                  <div style="min-height: 30px; margin-bottom: 5px;">
                    <span style="font-size: 8px;">${data.instructor_name}</span>
                  </div>
                  <div style="text-align: center; margin-top: 10px;">
                    ${data.instructor_signature_url ?
                      `<img src="${data.instructor_signature_url}" style="max-height: 30px; max-width: 70px;" />` :
                      ''
                    }
                    <div style="font-weight: bold; font-size: 8px; margin-top: 5px;">FIRMA</div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Participants Table -->
        <table style="width: 100%; border-collapse: collapse; border: 2px solid black; margin-bottom: 10px;">
          <thead>
            <tr>
              <th colspan="5" style="background-color: #e0e0e0; padding: 5px; border: 1px solid black; font-size: 10px; font-weight: bold; text-align: left;">
                DATOS DE LOS PARTICIPANTES:
              </th>
            </tr>
            <tr style="height: 25px;">
              <th style="border: 1px solid black; padding: 3px; width: 35%; font-size: 9px; text-align: center; font-weight: bold;">
                APELLIDOS Y NOMBRES DE LOS<br>CAPACITADOS
              </th>
              <th style="border: 1px solid black; padding: 3px; width: 13%; font-size: 9px; text-align: center; font-weight: bold;">
                Nº DNI
              </th>
              <th style="border: 1px solid black; padding: 3px; width: 20%; font-size: 9px; text-align: center; font-weight: bold;">
                ÁREA
              </th>
              <th style="border: 1px solid black; padding: 3px; width: 12%; font-size: 9px; text-align: center; font-weight: bold;">
                FECHA
              </th>
              <th style="border: 1px solid black; padding: 3px; width: 20%; font-size: 9px; text-align: center; font-weight: bold;">
                FIRMA
              </th>
            </tr>
          </thead>
          <tbody>
            ${data.signatures && data.signatures.length > 0 ? data.signatures.map((signature) => `
              <tr style="height: 35px;">
                <td style="border: 1px solid black; padding: 3px; font-size: 8px; vertical-align: middle;">
                  ${signature.user.last_name} ${signature.user.first_name}
                </td>
                <td style="border: 1px solid black; padding: 3px; text-align: center; font-size: 8px; vertical-align: middle;">
                  ${signature.user.dni || ''}
                </td>
                <td style="border: 1px solid black; padding: 3px; text-align: center; font-size: 7px; vertical-align: middle;">
                  ${signature.user.area || ''}
                </td>
                <td style="border: 1px solid black; padding: 3px; text-align: center; font-size: 8px; vertical-align: middle;">
                  ${new Date(signature.signed_at).toLocaleDateString('es-ES')}
                </td>
                <td style="border: 1px solid black; padding: 3px; text-align: center; vertical-align: middle;">
                  ${signature.signature_data ?
                    `<img src="data:image/png;base64,${signature.signature_data}" style="max-height: 25px; max-width: 90%;" />` :
                    ''
                  }
                </td>
              </tr>
            `).join('') : ''}
            ${Array.from({ length: Math.max(0, 10 - (data.signatures?.length || 0)) }, () => `
              <tr style="height: 35px;">
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
        <table style="width: 100%; border-collapse: collapse; border: 2px solid black;">
          <thead>
            <tr>
              <th colspan="3" style="background-color: #e0e0e0; padding: 5px; border: 1px solid black; font-size: 10px; font-weight: bold; text-align: center;">
                RESPONSABLE DEL REGISTRO
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style="height: 50px;">
              <td style="border: 1px solid black; padding: 5px; width: 35%; font-size: 9px; vertical-align: top;">
                <div style="font-weight: bold; margin-bottom: 3px;">NOMBRE:</div>
                <div style="font-size: 8px;">${data.responsible_name}</div>
              </td>
              <td style="border: 1px solid black; padding: 5px; width: 30%; font-size: 9px; vertical-align: top;">
                <div style="font-weight: bold; margin-bottom: 3px;">CARGO:</div>
                <div style="font-size: 8px;">${data.responsible_position}</div>
              </td>
              <td style="border: 1px solid black; padding: 5px; width: 35%; font-size: 9px; vertical-align: top;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                  <div>
                    <div style="font-weight: bold; margin-bottom: 3px;">FECHA:</div>
                    <div style="font-size: 8px;">${new Date(data.fecha).toLocaleDateString('es-ES')}</div>
                  </div>
                  <div style="text-align: center; min-width: 80px;">
                    ${data.responsible_signature_url ?
                      `<img src="${data.responsible_signature_url}" style="max-height: 30px; max-width: 70px;" />` :
                      ''
                    }
                    <div style="font-weight: bold; font-size: 8px; margin-top: 5px;">FIRMA</div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `

    document.body.appendChild(container)

    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: 'white',
            logging: false
          })

          document.body.removeChild(container)

          const pdf = new jsPDF('portrait', 'mm', 'a4')
          const imgData = canvas.toDataURL('image/png')

          const imgWidth = 210
          const imgHeight = (canvas.height * imgWidth) / canvas.width

          pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)

          const fileName = `Lista_Asistencia_${data.course.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date(data.fecha).toLocaleDateString('es-ES').replace(/\//g, '-')}.pdf`
          pdf.save(fileName)

          resolve()
        } catch (error) {
          if (document.body.contains(container)) {
            document.body.removeChild(container)
          }
          reject(error)
        }
      }, 2000)
    })
  }
}
