import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { StorageService } from '../../lib/storage'
import { Plus, Edit2, Trash2, Upload, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'

interface Instructor {
  id: string
  name: string
  signature_url: string | null
  created_at: string
}

interface InstructorFormData {
  name: string
  signature: FileList
}

export default function InstructorsManagement() {
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null)
  const [uploading, setUploading] = useState(false)
  const tableScrollRef = React.useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue
  } = useForm<InstructorFormData>()

  useEffect(() => {
    loadInstructors()
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const container = tableScrollRef.current
      if (!container) return

      const hasScrollLeft = container.scrollLeft > 10
      const hasScrollRight = container.scrollLeft < container.scrollWidth - container.clientWidth - 10

      if (hasScrollLeft) {
        container.classList.add('has-scroll-left')
      } else {
        container.classList.remove('has-scroll-left')
      }

      if (hasScrollRight) {
        container.classList.add('has-scroll-right')
      } else {
        container.classList.remove('has-scroll-right')
      }
    }

    const container = tableScrollRef.current
    if (container) {
      handleScroll()
      container.addEventListener('scroll', handleScroll)
      window.addEventListener('resize', handleScroll)

      return () => {
        container.removeEventListener('scroll', handleScroll)
        window.removeEventListener('resize', handleScroll)
      }
    }
  }, [instructors])

  const loadInstructors = async () => {
    try {
      const { data, error } = await supabase
        .from('instructors')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setInstructors(data || [])
    } catch (error) {
      console.error('Error loading instructors:', error)
      toast.error('Error al cargar instructores')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateOrUpdate = async (data: InstructorFormData) => {
    try {
      setUploading(true)
      let signatureUrl = editingInstructor?.signature_url || null

      // Upload signature if provided
      if (data.signature && data.signature.length > 0) {
        const file = data.signature[0]
        const sanitizedName = StorageService.sanitizeFileName(file.name)
        const fileName = `instructor_${Date.now()}_${sanitizedName}`

        const { url, error } = await StorageService.uploadFile(
          'instructor-signatures',
          fileName,
          file
        )

        if (error) throw error
        signatureUrl = url
      }

      if (editingInstructor) {
        // Update existing instructor
        const { error } = await supabase
          .from('instructors')
          .update({
            name: data.name,
            signature_url: signatureUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingInstructor.id)

        if (error) throw error
        toast.success('Instructor actualizado correctamente')
      } else {
        // Create new instructor
        const { error } = await supabase
          .from('instructors')
          .insert([
            {
              name: data.name,
              signature_url: signatureUrl
            }
          ])

        if (error) throw error
        toast.success('Instructor creado correctamente')
      }

      await loadInstructors()
      setIsModalOpen(false)
      setEditingInstructor(null)
      reset()
    } catch (error: any) {
      console.error('Error saving instructor:', error)
      toast.error(error.message || 'Error al guardar instructor')
    } finally {
      setUploading(false)
    }
  }

  const handleEdit = (instructor: Instructor) => {
    setEditingInstructor(instructor)
    setValue('name', instructor.name)
    setIsModalOpen(true)
  }

  const handleDelete = async (instructor: Instructor) => {
    if (!confirm(`¿Estás seguro de eliminar a ${instructor.name}?`)) {
      return
    }

    try {
      // Delete signature file if exists
      if (instructor.signature_url) {
        const fileName = instructor.signature_url.split('/').pop()
        if (fileName) {
          await StorageService.deleteFile('instructor-signatures', fileName)
        }
      }

      const { error } = await supabase
        .from('instructors')
        .delete()
        .eq('id', instructor.id)

      if (error) throw error
      
      toast.success('Instructor eliminado correctamente')
      await loadInstructors()
    } catch (error) {
      console.error('Error deleting instructor:', error)
      toast.error('Error al eliminar instructor')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Instructores</h1>
          <p className="text-slate-600">Gestiona los instructores de la plataforma</p>
        </div>
        <button
          onClick={() => {
            setEditingInstructor(null)
            reset()
            setIsModalOpen(true)
          }}
          className="inline-flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Agregar Instructor
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div ref={tableScrollRef} className="table-scroll-container">
          <table className="w-full table-compact min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Instructor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Firma
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider col-date">
                  Fecha de Registro
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider col-actions">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {instructors.map((instructor) => (
                <tr key={instructor.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-slate-600" />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-slate-900">
                          {instructor.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {instructor.signature_url ? (
                      <img
                        src={instructor.signature_url}
                        alt="Firma"
                        className="h-8 w-auto"
                      />
                    ) : (
                      <span className="text-slate-400 text-sm">Sin firma</span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                    {new Date(instructor.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(instructor)}
                      className="text-slate-600 hover:text-slate-900 mr-3"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(instructor)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {instructors.length === 0 && (
          <div className="text-center py-12">
            <User className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-2 text-sm font-medium text-slate-900">No hay instructores</h3>
            <p className="mt-1 text-sm text-slate-500">Comienza agregando tu primer instructor.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 md:p-4 z-50">
          <div className="bg-white md:rounded-xl shadow-xl max-w-md w-full h-full md:h-auto p-6 mobile-scroll-container md:mobile-no-overflow no-scrollbar">
            <h2 className="text-xl font-bold text-slate-800 mb-6">
              {editingInstructor ? 'Editar Instructor' : 'Agregar Instructor'}
            </h2>

            <form onSubmit={handleSubmit(handleCreateOrUpdate)} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre Completo
                </label>
                <input
                  {...register('name', { required: 'El nombre es requerido' })}
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  placeholder="Nombre del instructor"
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
                )}
              </div>

              {/* Signature */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Firma {editingInstructor ? '(opcional - deja vacío para mantener actual)' : ''}
                </label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-slate-400" />
                      <p className="mb-2 text-sm text-slate-500">
                        <span className="font-semibold">Haz clic para subir</span> la firma
                      </p>
                      <p className="text-xs text-slate-500">PNG, JPG o PDF</p>
                    </div>
                    <input
                      {...register('signature', { 
                        required: editingInstructor ? false : 'La firma es requerida'
                      })}
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf"
                    />
                  </label>
                </div>
                {errors.signature && (
                  <p className="text-red-500 text-xs mt-1">{errors.signature.message}</p>
                )}
                
                {editingInstructor?.signature_url && (
                  <div className="mt-2">
                    <p className="text-sm text-slate-600 mb-2">Firma actual:</p>
                    <img 
                      src={editingInstructor.signature_url} 
                      alt="Firma actual"
                      className="h-16 w-auto border rounded"
                    />
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setEditingInstructor(null)
                    reset()
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || uploading}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isSubmitting || uploading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto"></div>
                  ) : (
                    editingInstructor ? 'Actualizar' : 'Crear'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}