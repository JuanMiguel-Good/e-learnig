import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { StorageService } from '../../lib/storage'
import { Plus, CreditCard as Edit2, Trash2, Upload, User, Building2, Search, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'

interface Company {
  id: string
  razon_social: string
  ruc: string
}

interface CompanyResponsible {
  id: string
  company_id: string
  nombre: string
  cargo: string
  signature_url: string | null
  created_at: string
  company: {
    razon_social: string
    ruc: string
  }
}

interface ResponsibleFormData {
  company_id: string
  nombre: string
  cargo: string
  signature: FileList
}

export default function CompanyResponsiblesManagement() {
  const [responsibles, setResponsibles] = useState<CompanyResponsible[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingResponsible, setEditingResponsible] = useState<CompanyResponsible | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [uploading, setUploading] = useState(false)
  const [selectedSignature, setSelectedSignature] = useState<File | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue
  } = useForm<ResponsibleFormData>()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Load responsibles with company info
      const { data: responsiblesData, error: responsiblesError } = await supabase
        .from('company_responsibles')
        .select(`
          *,
          company:companies!inner(razon_social, ruc)
        `)
        .order('created_at', { ascending: false })

      if (responsiblesError) throw responsiblesError

      // Load companies for select
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, razon_social, ruc')
        .order('razon_social')

      if (companiesError) throw companiesError

      setResponsibles(responsiblesData || [])
      setCompanies(companiesData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateOrUpdate = async (data: ResponsibleFormData) => {
    try {
      setUploading(true)
      let signatureUrl = editingResponsible?.signature_url || null

      // Upload signature if provided
      if (data.signature && data.signature.length > 0) {
        const file = data.signature[0]
        const sanitizedName = StorageService.sanitizeFileName(file.name)
        const fileName = `responsible_signature_${Date.now()}_${sanitizedName}`

        const { url, error } = await StorageService.uploadFile(
          'responsible-signatures',
          fileName,
          file
        )

        if (error) throw error
        signatureUrl = url
      }

      const responsibleData = {
        company_id: data.company_id,
        nombre: data.nombre,
        cargo: data.cargo,
        signature_url: signatureUrl
      }

      if (editingResponsible) {
        const { error } = await supabase
          .from('company_responsibles')
          .update({
            ...responsibleData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingResponsible.id)

        if (error) throw error
        toast.success('Responsable actualizado correctamente')
      } else {
        const { error } = await supabase
          .from('company_responsibles')
          .insert([responsibleData])

        if (error) throw error
        toast.success('Responsable creado correctamente')
      }

      await loadData()
      setIsModalOpen(false)
      setEditingResponsible(null)
      setSelectedSignature(null)
      reset()
    } catch (error: any) {
      console.error('Error saving responsible:', error)
      toast.error(error.message || 'Error al guardar responsable')
    } finally {
      setUploading(false)
    }
  }

  const handleEdit = (responsible: CompanyResponsible) => {
    setEditingResponsible(responsible)
    setValue('company_id', responsible.company_id)
    setValue('nombre', responsible.nombre)
    setValue('cargo', responsible.cargo)
    setIsModalOpen(true)
  }

  const handleDelete = async (responsible: CompanyResponsible) => {
    if (!confirm(`¿Estás seguro de eliminar al responsable "${responsible.nombre}"?`)) {
      return
    }

    try {
      // Delete signature file if exists
      if (responsible.signature_url) {
        const fileName = responsible.signature_url.split('/').pop()
        if (fileName) {
          await StorageService.deleteFile('responsible-signatures', fileName)
        }
      }

      const { error } = await supabase
        .from('company_responsibles')
        .delete()
        .eq('id', responsible.id)

      if (error) throw error
      
      toast.success('Responsable eliminado correctamente')
      await loadData()
    } catch (error) {
      console.error('Error deleting responsible:', error)
      toast.error('Error al eliminar responsable')
    }
  }

  const filteredResponsibles = responsibles.filter(responsible => 
    responsible.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    responsible.cargo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    responsible.company.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
    responsible.company.ruc.includes(searchTerm)
  )

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
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Responsables de Empresas</h1>
          <p className="text-sm md:text-base text-slate-600">Gestiona los responsables de cada empresa</p>
        </div>
        <button
          onClick={() => {
            setEditingResponsible(null)
            reset()
            setIsModalOpen(true)
          }}
          className="inline-flex items-center px-3 md:px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors text-sm md:text-base"
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5 mr-2" />
          Agregar Responsable
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar responsables por nombre, cargo o empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm md:text-base"
          />
        </div>
      </div>

      {/* Responsibles List */}
      <div className="space-y-4">
        {filteredResponsibles.map((responsible) => (
          <div key={responsible.id} className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Responsible Info */}
              <div className="flex items-start gap-4 flex-1">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-100 rounded-lg flex items-center justify-center">
                  <User className="w-6 h-6 md:w-8 md:h-8 text-slate-600" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-1">
                    {responsible.nombre}
                  </h3>
                  <p className="text-sm md:text-base text-slate-600 mb-2">
                    {responsible.cargo}
                  </p>
                  <div className="flex items-center text-xs md:text-sm text-slate-500">
                    <Building2 className="w-4 h-4 mr-1" />
                    <span className="line-clamp-1">
                      {responsible.company.razon_social} (RUC: {responsible.company.ruc})
                    </span>
                  </div>
                </div>
              </div>

              {/* Signature */}
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-2">Firma</p>
                  {responsible.signature_url ? (
                    <img 
                      src={responsible.signature_url} 
                      alt="Firma"
                      className="h-12 md:h-16 w-auto border rounded bg-white"
                    />
                  ) : (
                    <div className="h-12 md:h-16 w-24 border-2 border-dashed border-slate-300 rounded flex items-center justify-center">
                      <FileText className="w-4 h-4 text-slate-400" />
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-2">
                <button
                  onClick={() => handleEdit(responsible)}
                  className="flex-1 lg:flex-none px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors text-sm"
                >
                  <Edit2 className="w-4 h-4 mx-auto lg:mr-2" />
                  <span className="hidden lg:inline">Editar</span>
                </button>
                <button
                  onClick={() => handleDelete(responsible)}
                  className="flex-1 lg:flex-none px-3 py-2 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-lg transition-colors text-sm"
                >
                  <Trash2 className="w-4 h-4 mx-auto lg:mr-2" />
                  <span className="hidden lg:inline">Eliminar</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredResponsibles.length === 0 && (
        <div className="text-center py-8 md:py-12">
          <User className="mx-auto h-10 w-10 md:h-12 md:w-12 text-slate-400" />
          <h3 className="mt-2 text-sm md:text-base font-medium text-slate-900">
            {searchTerm ? 'No hay resultados' : 'No hay responsables'}
          </h3>
          <p className="mt-1 text-xs md:text-sm text-slate-500">
            {searchTerm 
              ? 'Intenta con otros términos de búsqueda.' 
              : 'Comienza agregando responsables para las empresas.'
            }
          </p>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 md:p-4 z-50 overflow-y-auto no-scrollbar">
          <div className="bg-white md:rounded-xl shadow-xl max-w-md w-full max-h-screen overflow-y-auto md:my-4 modal-content">
            <div className="p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-slate-800 mb-4 md:mb-6">
                {editingResponsible ? 'Editar Responsable' : 'Agregar Responsable'}
              </h2>

              <form onSubmit={handleSubmit(handleCreateOrUpdate)} className="space-y-4">
                {/* Company */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Empresa *
                  </label>
                  <select
                    {...register('company_id', { required: 'Selecciona una empresa' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                  >
                    <option value="">Seleccionar empresa</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.razon_social} (RUC: {company.ruc})
                      </option>
                    ))}
                  </select>
                  {errors.company_id && (
                    <p className="text-red-500 text-xs mt-1">{errors.company_id.message}</p>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    {...register('nombre', { required: 'El nombre es requerido' })}
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                    placeholder="Juan Carlos Pérez López"
                  />
                  {errors.nombre && (
                    <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>
                  )}
                </div>

                {/* Position */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Cargo *
                  </label>
                  <input
                    {...register('cargo', { required: 'El cargo es requerido' })}
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                    placeholder="Gerente de Recursos Humanos"
                  />
                  {errors.cargo && (
                    <p className="text-red-500 text-xs mt-1">{errors.cargo.message}</p>
                  )}
                </div>

                {/* Signature */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Firma {editingResponsible ? '(opcional - subir nueva para cambiar)' : '*'}
                  </label>
                  
                  {editingResponsible?.signature_url && (
                    <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800 mb-2">✍️ Firma actual:</p>
                      <img 
                        src={editingResponsible.signature_url} 
                        alt="Firma actual"
                        className="h-16 w-auto border rounded bg-white"
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100">
                      <div className="flex flex-col items-center justify-center pt-2 pb-3">
                        <Upload className="w-6 h-6 mb-1 text-slate-400" />
                        <p className="text-sm text-slate-500">
                          <span className="font-semibold">{selectedSignature ? selectedSignature.name : 'Subir firma'}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {selectedSignature ? `${(selectedSignature.size / 1024).toFixed(2)} KB` : 'PNG, JPG (fondo transparente recomendado)'}
                        </p>
                      </div>
                      <input
                        {...register('signature', {
                          required: editingResponsible ? false : 'La firma es requerida',
                          onChange: (e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              setSelectedSignature(file)
                              toast.success(`Firma "${file.name}" cargada`)
                            }
                          }
                        })}
                        type="file"
                        className="hidden"
                        accept="image/*"
                      />
                    </label>
                  </div>
                  {errors.signature && (
                    <p className="text-red-500 text-xs mt-1">{errors.signature.message}</p>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false)
                      setEditingResponsible(null)
                      setSelectedSignature(null)
                      reset()
                    }}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || uploading}
                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
                  >
                    {isSubmitting || uploading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto"></div>
                    ) : (
                      editingResponsible ? 'Actualizar' : 'Crear'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}