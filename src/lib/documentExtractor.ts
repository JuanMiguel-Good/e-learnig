import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
}

const MAX_FILE_SIZE_MB = 10
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

export const ALLOWED_FILE_TYPES = {
  PDF: 'application/pdf',
  TXT: 'text/plain',
}

export function validateFileSize(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `El archivo es muy grande. Tamaño máximo: ${MAX_FILE_SIZE_MB}MB`,
    }
  }
  return { valid: true }
}

export function validateFileType(file: File): { valid: boolean; error?: string } {
  const allowedTypes = Object.values(ALLOWED_FILE_TYPES)
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Tipo de archivo no soportado. Solo se permiten archivos PDF y TXT',
    }
  }
  return { valid: true }
}

export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    let fullText = ''

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')

      fullText += pageText + '\n\n'
    }

    if (fullText.trim().length === 0) {
      throw new Error('El PDF no contiene texto extraíble')
    }

    return fullText.trim()
  } catch (error) {
    console.error('Error extracting text from PDF:', error)
    throw new Error(
      'Error al extraer texto del PDF. Asegúrate de que el archivo no esté corrupto y contenga texto.'
    )
  }
}

export async function extractTextFromTXT(file: File): Promise<string> {
  try {
    const text = await file.text()

    if (text.trim().length === 0) {
      throw new Error('El archivo de texto está vacío')
    }

    return text.trim()
  } catch (error) {
    console.error('Error extracting text from TXT:', error)
    throw new Error('Error al leer el archivo de texto')
  }
}

export async function extractTextFromFile(file: File): Promise<string> {
  const sizeValidation = validateFileSize(file)
  if (!sizeValidation.valid) {
    throw new Error(sizeValidation.error)
  }

  const typeValidation = validateFileType(file)
  if (!typeValidation.valid) {
    throw new Error(typeValidation.error)
  }

  if (file.type === ALLOWED_FILE_TYPES.PDF) {
    return extractTextFromPDF(file)
  } else if (file.type === ALLOWED_FILE_TYPES.TXT) {
    return extractTextFromTXT(file)
  }

  throw new Error('Tipo de archivo no soportado')
}

export function getFileTypeLabel(fileType: string): string {
  switch (fileType) {
    case ALLOWED_FILE_TYPES.PDF:
      return 'PDF'
    case ALLOWED_FILE_TYPES.TXT:
      return 'TXT'
    default:
      return 'Desconocido'
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}
