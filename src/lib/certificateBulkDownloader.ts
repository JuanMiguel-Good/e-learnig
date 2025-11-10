import jsPDF from 'jspdf'
import JSZip from 'jszip'

interface CertificateDownloadData {
  participant_id: string
  first_name: string
  last_name: string
  dni: string | null
  course_title: string
  certificate_url: string
}

interface DownloadProgress {
  current: number
  total: number
  percentage: number
  currentFile: string
}

type ProgressCallback = (progress: DownloadProgress) => void

export class CertificateBulkDownloader {
  private static sanitizeFilename(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s-_]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 100)
  }

  private static generateFilename(
    firstName: string,
    lastName: string,
    dni: string | null,
    courseTitle: string
  ): string {
    const sanitizedFirstName = this.sanitizeFilename(firstName)
    const sanitizedLastName = this.sanitizeFilename(lastName)
    const sanitizedCourseTitle = this.sanitizeFilename(courseTitle)

    if (dni) {
      return `${dni}_${sanitizedFirstName}_${sanitizedLastName}_${sanitizedCourseTitle}.pdf`
    }

    return `${sanitizedFirstName}_${sanitizedLastName}_${sanitizedCourseTitle}.pdf`
  }

  private static async fetchImageAsBlob(url: string): Promise<Blob> {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit'
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }

    return await response.blob()
  }

  private static async convertImageToPDF(imageBlob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const reader = new FileReader()

      reader.onload = (e) => {
        img.src = e.target?.result as string
      }

      img.onload = () => {
        try {
          const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
          })

          const pdfWidth = 297
          const pdfHeight = 210

          const imgWidth = img.width
          const imgHeight = img.height
          const imgRatio = imgWidth / imgHeight

          let finalWidth = pdfWidth
          let finalHeight = pdfHeight
          const pdfRatio = pdfWidth / pdfHeight

          if (imgRatio > pdfRatio) {
            finalHeight = pdfWidth / imgRatio
          } else {
            finalWidth = pdfHeight * imgRatio
          }

          const xOffset = (pdfWidth - finalWidth) / 2
          const yOffset = (pdfHeight - finalHeight) / 2

          pdf.addImage(img.src, 'PNG', xOffset, yOffset, finalWidth, finalHeight)

          const pdfBlob = pdf.output('blob')
          resolve(pdfBlob)
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }

      reader.onerror = () => {
        reject(new Error('Failed to read blob'))
      }

      reader.readAsDataURL(imageBlob)
    })
  }

  static async downloadCertificatesAsZip(
    certificates: CertificateDownloadData[],
    onProgress?: ProgressCallback
  ): Promise<void> {
    const zip = new JSZip()
    const batchSize = 5
    let completed = 0
    const total = certificates.length

    const results: Array<{
      success: boolean
      filename: string
      error?: string
    }> = []

    for (let i = 0; i < certificates.length; i += batchSize) {
      const batch = certificates.slice(i, i + batchSize)

      const batchPromises = batch.map(async (cert) => {
        const filename = this.generateFilename(
          cert.first_name,
          cert.last_name,
          cert.dni,
          cert.course_title
        )

        try {
          const imageBlob = await this.fetchImageAsBlob(cert.certificate_url)
          const pdfBlob = await this.convertImageToPDF(imageBlob)

          zip.file(filename, pdfBlob)

          completed++

          if (onProgress) {
            onProgress({
              current: completed,
              total,
              percentage: Math.round((completed / total) * 100),
              currentFile: filename
            })
          }

          return { success: true, filename }
        } catch (error) {
          completed++

          if (onProgress) {
            onProgress({
              current: completed,
              total,
              percentage: Math.round((completed / total) * 100),
              currentFile: filename
            })
          }

          console.error(`Error processing certificate for ${filename}:`, error)
          return {
            success: false,
            filename,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length

    if (successCount === 0) {
      throw new Error('No se pudo descargar ningún certificado')
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/T/, '_')
      .replace(/\..+/, '')
      .replace(/:/g, '-')
    const zipFilename = `Certificados_${timestamp}.zip`

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })

    const link = document.createElement('a')
    link.href = URL.createObjectURL(zipBlob)
    link.download = zipFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)

    if (failureCount > 0) {
      console.warn(
        `${failureCount} certificado(s) fallaron:`,
        results.filter((r) => !r.success)
      )
    }

    return {
      successCount,
      failureCount,
      total
    } as any
  }
}
