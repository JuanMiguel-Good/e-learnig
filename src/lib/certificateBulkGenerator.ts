import { supabase } from './supabase'
import { CertificateGenerator } from './certificateGenerator'

interface CertificateToGenerate {
  certificateId: string
  userId: string
  courseId: string
  userName: string
  courseName: string
  instructorName: string
  instructorSignature: string | null
  completionDate: string
}

export class CertificateBulkGenerator {
  static async generatePendingCertificates(
    onProgress?: (current: number, total: number, userName: string, courseName: string) => void,
    onError?: (error: string, userName: string, courseName: string) => void
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    }

    try {
      const { data: certificates, error } = await supabase
        .from('certificates')
        .select(`
          id,
          user_id,
          course_id,
          completion_date,
          users!inner(
            id,
            first_name,
            last_name
          ),
          courses!inner(
            id,
            title,
            instructors!inner(
              id,
              full_name,
              signature_url
            )
          )
        `)
        .is('certificate_url', null)
        .order('completion_date', { ascending: true })

      if (error) throw error
      if (!certificates || certificates.length === 0) {
        return results
      }

      const total = certificates.length

      for (let i = 0; i < certificates.length; i++) {
        const cert = certificates[i] as any

        const userName = `${cert.users.first_name} ${cert.users.last_name}`
        const courseName = cert.courses.title
        const instructorName = cert.courses.instructors?.full_name || 'Instructor'
        const instructorSignature = cert.courses.instructors?.signature_url || null
        const completionDate = cert.completion_date

        if (onProgress) {
          onProgress(i + 1, total, userName, courseName)
        }

        try {
          const certificateData = {
            userName,
            courseName,
            instructorName,
            instructorSignature,
            completionDate
          }

          const certificateBase64 = await CertificateGenerator.generateCertificate(certificateData)
          await CertificateGenerator.saveCertificate(
            cert.user_id,
            cert.course_id,
            certificateBase64
          )

          results.success++

          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          const errorMsg = `Error generando certificado para ${userName} - ${courseName}: ${error}`
          results.errors.push(errorMsg)
          results.failed++

          if (onError) {
            onError(String(error), userName, courseName)
          }

          console.error(errorMsg, error)
        }
      }

      return results
    } catch (error) {
      console.error('Error in bulk certificate generation:', error)
      throw error
    }
  }
}
