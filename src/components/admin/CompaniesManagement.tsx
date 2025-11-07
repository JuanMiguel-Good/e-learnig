import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { StorageService } from '../../lib/storage'
import { Plus, CreditCard as Edit2, Trash2, Upload, Building2, Search, Users, MapPin, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'

interface Company {
  id: string
  razon_social: string
  ruc: string
  direccion: string
  distrito: string
  departamento: string
  provincia: string
  actividad_economica: string
  num_trabajadores: number
  logo_url: string | null
  codigo: string | null
  version: string | null
  created_at: string
}

interface CompanyFormData {
  razon_social: string
  ruc: string
  direccion: string
  distrito: string
  departamento: string
  provincia: string
  actividad_economica: string
  num_trabajadores: number
  logo: FileList
  codigo: string
  version: string
}

export default function CompaniesManagement() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [uploading, setUploading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue
  } = useForm<CompanyFormData>()

  useEffect(() => {
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCompanies(data || [])
    } catch (error) {
      console.error('Error loading companies:', error)
      toast.error('Error al cargar empresas')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateOrUpdate = async (data: CompanyFormData) => {
    try {
      setUploading(true)
      let logoUrl = editingCompany?.logo_url || null

      // Upload logo if provided
      if (data.logo && data.logo.length > 0) {
        const file = data.logo[0]
        const fileName = `company_logo_${Date.now()}_${file.name}`
        
        const { url, error } = await StorageService.uploadFile(
          'company-logos',
          fileName,
          file
        )
        
        if (error) throw error
        logoUrl = url
      }

      const companyData = {
        razon_social: data.razon_social,
        ruc: data.ruc,
        direccion: data.direccion,
        distrito: data.distrito,
        departamento: data.departamento,
        provincia: data.provincia,
        actividad_economica: data.actividad_economica,
        num_trabajadores: data.num_trabajadores,
        logo_url: logoUrl,
        codigo: data.codigo || null,
        version: data.version || null
      }

      if (editingCompany) {
        const { error } = await supabase
          .from('companies')
          .update({
            ...companyData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCompany.id)

        if (error) throw error
        toast.success('Empresa actualizada correctamente')
      } else {
        const { error } = await supabase
          .from('companies')
          .insert([companyData])

        if (error) throw error
        toast.success('Empresa creada correctamente')
      }

      await loadCompanies()
      setIsModalOpen(false)
      setEditingCompany(null)
      reset()
    } catch (error: any) {
      console.error('Error saving company:', error)
      if (error.code === '23505' && error.message.includes('ruc')) {
        toast.error('Este RUC ya está registrado')
      } else {
        toast.error(error.message || 'Error al guardar empresa')
      }
    } finally {
      setUploading(false)
    }
  }

  const handleEdit = (company: Company) => {
    setEditingCompany(company)
    setValue('razon_social', company.razon_social)
    setValue('ruc', company.ruc)
    setValue('direccion', company.direccion)
    setValue('distrito', company.distrito)
    setValue('departamento', company.departamento)
    setValue('provincia', company.provincia)
    setValue('actividad_economica', company.actividad_economica)
    setValue('num_trabajadores', company.num_trabajadores)
    setValue('codigo', company.codigo || '')
    setValue('version', company.version || '')
    setIsModalOpen(true)
  }

  const handleDelete = async (company: Company) => {
    if (!confirm(`¿Estás seguro de eliminar la empresa "${company.razon_social}"?`)) {
      return
    }

    try {
      // Check if company has users assigned
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', company.id)
        .limit(1)

      if (users && users.length > 0) {
        toast.error('No se puede eliminar una empresa con usuarios asignados')
        return
      }

      // Delete logo if exists
      if (company.logo_url) {
        const fileName = company.logo_url.split('/').pop()
        if (fileName) {
          await StorageService.deleteFile('company-logos', fileName)
        }
      }

      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', company.id)

      if (error) throw error
      
      toast.success('Empresa eliminada correctamente')
      await loadCompanies()
    } catch (error) {
      console.error('Error deleting company:', error)
      toast.error('Error al eliminar empresa')
    }
  }

  const filteredCompanies = companies.filter(company => 
    company.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.ruc.includes(searchTerm) ||
    company.distrito.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.departamento.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Empresas</h1>
          <p className="text-sm md:text-base text-slate-600">Gestiona las empresas del sistema</p>
        </div>
        <button
          onClick={() => {
            setEditingCompany(null)
            reset()
            setIsModalOpen(true)
          }}
          className="inline-flex items-center px-3 md:px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors text-sm md:text-base"
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5 mr-2" />
          Agregar Empresa
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar empresas por razón social, RUC, distrito o departamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm md:text-base"
          />
        </div>
      </div>

      {/* Companies Grid/List */}
      <div className="space-y-4">
        {filteredCompanies.map((company) => (
          <div key={company.id} className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Company Logo and Basic Info */}
              <div className="flex items-start gap-4">
                {company.logo_url ? (
                  <img 
                    src={company.logo_url} 
                    alt={`Logo ${company.razon_social}`}
                    className="w-12 h-12 md:w-16 md:h-16 object-cover rounded-lg border"
                  />
                ) : (
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 md:w-8 md:h-8 text-slate-600" />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-1">
                    {company.razon_social}
                  </h3>
                  <div className="flex flex-wrap gap-2 text-xs md:text-sm text-slate-600">
                    <span className="inline-flex items-center px-2 py-1 bg-slate-100 rounded-full">
                      <FileText className="w-3 h-3 mr-1" />
                      RUC: {company.ruc}
                    </span>
                    <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                      <Users className="w-3 h-3 mr-1" />
                      {company.num_trabajadores} trabajadores
                    </span>
                  </div>
                </div>
              </div>

              {/* Company Details */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="flex items-start text-slate-600">
                    <MapPin className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{company.direccion}, {company.distrito}</span>
                  </p>
                  <p className="text-slate-500 ml-5 text-xs">
                    {company.departamento}, {company.provincia}
                  </p>
                </div>
                <div>
                  <p className="text-slate-600 line-clamp-2">
                    <span className="font-medium">Actividad:</span> {company.actividad_economica}
                  </p>
                  {(company.codigo || company.version) && (
                    <p className="text-slate-500 text-xs mt-1">
                      {company.codigo && `Código: ${company.codigo}`}
                      {company.codigo && company.version && ' | '}
                      {company.version && `Versión: ${company.version}`}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-2">
                <button
                  onClick={() => handleEdit(company)}
                  className="flex-1 lg:flex-none px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors text-sm"
                >
                  <Edit2 className="w-4 h-4 mx-auto lg:mr-2" />
                  <span className="hidden lg:inline">Editar</span>
                </button>
                <button
                  onClick={() => handleDelete(company)}
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

      {filteredCompanies.length === 0 && (
        <div className="text-center py-8 md:py-12">
          <Building2 className="mx-auto h-10 w-10 md:h-12 md:w-12 text-slate-400" />
          <h3 className="mt-2 text-sm md:text-base font-medium text-slate-900">
            {searchTerm ? 'No hay resultados' : 'No hay empresas'}
          </h3>
          <p className="mt-1 text-xs md:text-sm text-slate-500">
            {searchTerm 
              ? 'Intenta con otros términos de búsqueda.' 
              : 'Comienza agregando tu primera empresa.'
            }
          </p>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 md:p-4 z-50 overflow-y-auto no-scrollbar">
          <div className="bg-white md:rounded-xl shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto md:my-4 modal-content">
            <div className="p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-slate-800 mb-4 md:mb-6">
                {editingCompany ? 'Editar Empresa' : 'Agregar Empresa'}
              </h2>

              <form onSubmit={handleSubmit(handleCreateOrUpdate)} className="space-y-4">
                {/* Razón Social */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Razón Social *
                  </label>
                  <input
                    {...register('razon_social', { required: 'La razón social es requerida' })}
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                    placeholder="Razón social o denominación social"
                  />
                  {errors.razon_social && (
                    <p className="text-red-500 text-xs mt-1">{errors.razon_social.message}</p>
                  )}
                </div>

                {/* RUC y Trabajadores */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      RUC *
                    </label>
                    <input
                      {...register('ruc', { 
                        required: 'El RUC es requerido',
                        pattern: {
                          value: /^[0-9]{11}$/,
                          message: 'RUC debe tener 11 dígitos'
                        }
                      })}
                      type="text"
                      maxLength={11}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                      placeholder="12345678901"
                    />
                    {errors.ruc && (
                      <p className="text-red-500 text-xs mt-1">{errors.ruc.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nº de Trabajadores *
                    </label>
                    <input
                      {...register('num_trabajadores', { 
                        required: 'El número de trabajadores es requerido',
                        min: { value: 1, message: 'Debe ser mayor a 0' }
                      })}
                      type="number"
                      min="1"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                      placeholder="50"
                    />
                    {errors.num_trabajadores && (
                      <p className="text-red-500 text-xs mt-1">{errors.num_trabajadores.message}</p>
                    )}
                  </div>
                </div>

                {/* Dirección */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Dirección *
                  </label>
                  <input
                    {...register('direccion', { required: 'La dirección es requerida' })}
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                    placeholder="Av. Principal 123, San Isidro"
                  />
                  {errors.direccion && (
                    <p className="text-red-500 text-xs mt-1">{errors.direccion.message}</p>
                  )}
                </div>

                {/* Ubicación */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Distrito *
                    </label>
                    <input
                      {...register('distrito', { required: 'El distrito es requerido' })}
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                      placeholder="San Isidro"
                    />
                    {errors.distrito && (
                      <p className="text-red-500 text-xs mt-1">{errors.distrito.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Provincia *
                    </label>
                    <input
                      {...register('provincia', { required: 'La provincia es requerida' })}
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                      placeholder="Lima"
                    />
                    {errors.provincia && (
                      <p className="text-red-500 text-xs mt-1">{errors.provincia.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Departamento *
                    </label>
                    <input
                      {...register('departamento', { required: 'El departamento es requerido' })}
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                      placeholder="Lima"
                    />
                    {errors.departamento && (
                      <p className="text-red-500 text-xs mt-1">{errors.departamento.message}</p>
                    )}
                  </div>
                </div>

                {/* Actividad Económica */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Actividad Económica *
                  </label>
                  <textarea
                    {...register('actividad_economica', { required: 'La actividad económica es requerida' })}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                    placeholder="Servicios de consultoría empresarial"
                  />
                  {errors.actividad_economica && (
                    <p className="text-red-500 text-xs mt-1">{errors.actividad_economica.message}</p>
                  )}
                </div>

                {/* Logo */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Logo de la Empresa {editingCompany ? '(opcional - subir nuevo para cambiar)' : ''}
                  </label>
                  
                  {editingCompany?.logo_url && (
                    <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800 mb-2">🏢 Logo actual:</p>
                      <img 
                        src={editingCompany.logo_url} 
                        alt="Logo actual"
                        className="h-16 w-auto border rounded"
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100">
                      <div className="flex flex-col items-center justify-center pt-2 pb-3">
                        <Upload className="w-6 h-6 mb-1 text-slate-400" />
                        <p className="text-sm text-slate-500">
                          <span className="font-semibold">Subir logo</span>
                        </p>
                        <p className="text-xs text-slate-500">PNG, JPG (recomendado: 500x500)</p>
                      </div>
                      <input
                        {...register('logo', { 
                          required: editingCompany ? false : false // Logo is optional
                        })}
                        type="file"
                        className="hidden"
                        accept="image/*"
                      />
                    </label>
                  </div>
                </div>

                {/* Código y Versión */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Código (opcional)
                    </label>
                    <input
                      {...register('codigo')}
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                      placeholder="V001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Versión (opcional)
                    </label>
                    <input
                      {...register('version')}
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                      placeholder="1.0"
                    />
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false)
                      setEditingCompany(null)
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
                      editingCompany ? 'Actualizar' : 'Crear Empresa'
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