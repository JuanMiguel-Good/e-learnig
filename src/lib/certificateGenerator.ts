import html2canvas from 'html2canvas'
import { supabase } from './supabase'

interface CertificateData {
  userName: string
  courseName: string
  instructorName: string
  instructorSignature?: string | null
  completionDate: string
}

export class CertificateGenerator {
  static async generateCertificate(data: CertificateData): Promise<string> {
    // Create a hidden container for the certificate
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.top = '-9999px'
    container.style.left = '-9999px'
    container.style.width = '1122px' // A4 landscape width at 96 DPI
    container.style.height = '794px'  // A4 landscape height at 96 DPI
    container.style.backgroundColor = 'white'
    container.style.fontFamily = 'Arial, sans-serif'
    
    // Create certificate HTML content using the provided background image
    container.innerHTML = `
      <div style="
        position: relative;
        width: 100%;
        height: 100%;
        background-image: url('/certificado.jpg');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        padding: 60px;
      ">
        <!-- Certificate Title -->
        <div style="
          position: absolute;
          top: 280px;
          left: 50%;
          transform: translateX(-50%);
          color: #1e293b;
          font-size: 54px;
          font-weight: bold;
          letter-spacing: 3px;
          text-transform: uppercase;
        ">
          CERTIFICADO
        </div>
        
        <!-- Subtitle -->
        <div style="
          position: absolute;
          top: 350px;
          left: 50%;
          transform: translateX(-50%);
          color: #475569;
          font-size: 20px;
          font-weight: normal;
          letter-spacing: 1px;
        ">
          DE FINALIZACIÓN
        </div>
        
        <!-- Main text -->
        <div style="
          position: absolute;
          top: 400px;
          left: 50%;
          transform: translateX(-50%);
          color: #1e293b;
          font-size: 18px;
          margin-bottom: 20px;
        ">
          Se certifica que
        </div>
        
        <!-- Student name -->
        <div style="
          position: absolute;
          top: 430px;
          left: 50%;
          transform: translateX(-50%);
          color: #0f172a;
          font-size: 32px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 2px;
          padding-bottom: 10px;
          max-width: 700px;
          text-align: center;
          white-space: nowrap;
        ">
          ${data.userName}
        </div>

        <!-- Course completion text -->
        <div style="
          position: absolute;
          top: 510px;
          left: 50%;
          transform: translateX(-50%);
          color: #1e293b;
          font-size: 16px;
          white-space: nowrap;
        ">
          ha completado satisfactoriamente el curso
        </div>

        <!-- Course name -->
        <div style="
          position: absolute;
          top: 555px;
          left: 50%;
          transform: translateX(-50%);
          color: #0f172a;
          font-size: 22px;
          font-weight: bold;
          font-style: italic;
          max-width: 600px;
          text-align: center;
          line-height: 1.3;
        ">
          "${data.courseName}"
        </div>

        <!-- Completion date -->
        <div style="
          position: absolute;
          top: 640px;
          left: 50%;
          transform: translateX(-50%);
          color: #64748b;
          font-size: 14px;
          white-space: nowrap;
        ">
          Fecha de finalización: ${new Date(data.completionDate).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>

        <!-- Instructor section -->
        <div style="
          position: absolute;
          bottom: 80px;
          left: 200px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          color: #475569;
        ">
          ${data.instructorSignature ? `
            <img src="${data.instructorSignature}"
                 style="height: 60px; width: auto; margin-bottom: 4px; mix-blend-mode: multiply;"
                 alt="Firma del instructor" />
          ` : '<div style="height: 64px;"></div>'}
          <div style="
            width: 180px;
            height: 1px;
            background-color: #94a3b8;
            margin-bottom: 6px;
          "></div>
          <div style="
            color: #1e293b;
            font-size: 15px;
            font-weight: bold;
            margin-bottom: 4px;
          ">
            ${data.instructorName}
          </div>
          <div style="font-size: 12px;">
            Instructor
          </div>
        </div>
      </div>
    `
    
    document.body.appendChild(container)
    
    // Wait a bit for fonts and images to load
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
          
          // Convert canvas to base64
          const base64 = canvas.toDataURL('image/png').split(',')[1]
          resolve(base64)
        } catch (error) {
          document.body.removeChild(container)
          reject(error)
        }
      }, 1500)
    })
  }

  static async saveCertificate(
    userId: string, 
    courseId: string, 
    certificateBase64: string
  ): Promise<string | null> {
    try {
      // Convert base64 to blob
      const byteCharacters = atob(certificateBase64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'image/png' })

      // Upload the PNG to Supabase Storage
      const fileName = `certificate_${userId}_${courseId}_${Date.now()}.png`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(fileName, blob)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('certificates')
        .getPublicUrl(uploadData.path)

      // Save record in database
      const { error: dbError } = await supabase
        .from('certificates')
        .upsert([
          {
            user_id: userId,
            course_id: courseId,
            certificate_url: urlData.publicUrl,
            completion_date: new Date().toISOString()
          }
        ], {
          onConflict: 'user_id,course_id'
        })

      if (dbError) throw dbError

      return urlData.publicUrl
    } catch (error) {
      console.error('Error saving certificate:', error)
      throw error
    }
  }
}