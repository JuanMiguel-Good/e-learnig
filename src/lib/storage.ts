import { supabase } from './supabase'

export class StorageService {
  static sanitizeFileName(fileName: string): string {
    const extension = fileName.split('.').pop() || ''
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName
    const sanitized = nameWithoutExt
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase()

    return `${sanitized}.${extension.toLowerCase()}`
  }
  static async uploadFile(
    bucket: string,
    path: string,
    file: File,
    options?: { upsert?: boolean }
  ): Promise<{ url: string | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          upsert: options?.upsert || false
        })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path)

      return { url: publicUrl, error: null }
    } catch (error) {
      console.error('Storage upload error:', error)
      return { url: null, error: error as Error }
    }
  }

  static async deleteFile(
    bucket: string,
    path: string
  ): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path])

      if (error) throw error
      return { error: null }
    } catch (error) {
      console.error('Storage delete error:', error)
      return { error: error as Error }
    }
  }

  static getPublicUrl(bucket: string, path: string): string {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)
    
    return data.publicUrl
  }
}