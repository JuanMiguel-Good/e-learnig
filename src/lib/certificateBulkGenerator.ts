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
  static async generateSingleCertificate(userId: string, courseId: string): Promise<string> {
    const { data: userData } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', userId)
      .maybeSingle()

    if (!userData) throw new Error('Participante no encontrado')

    const { data: courseData } = await supabase
      .from('courses')
      .select('title, instructors(name, signature_url)')
      .eq('id', courseId)
      .maybeSingle()

    if (!courseData) throw new Error('Curso no encontrado')

    const instructor = (courseData as any).instructors
    const certificateData = {
      userName: `${userData.first_name} ${userData.last_name}`,
      courseName: courseData.title,
      instructorName: instructor?.name || 'Instructor',
      instructorSignature: instructor?.signature_url || null,
      completionDate: new Date().toISOString()
    }

    const certificateBase64 = await CertificateGenerator.generateCertificate(certificateData)
    const url = await CertificateGenerator.saveCertificate(userId, courseId, certificateBase64)
    if (!url) throw new Error('No se pudo guardar el certificado')
    return url
  }

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
              name,
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
        const instructorName = cert.courses.instructors?.name || 'Instructor'
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
