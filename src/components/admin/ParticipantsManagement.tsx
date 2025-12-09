import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, CreditCard as Edit2, Trash2, Phone, Mail, User, Eye, EyeOff, Upload, Download, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { generateParticipantsTemplate, parseParticipantsFromExcel, ValidationError, ParsedParticipant } from '../../lib/excelTemplateGenerator'

interface Participant {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  country_code: string
  dni: string | null
  area: string | null
  company_id: string | null
  created_at: string
  company?: {
    razon_social: string
  }
}

interface ParticipantFormData {
  email: string
  first_name: string
  last_name: string
  phone: string
  country_code: string
  dni: string
  area: string
  company_id: string
  password?: string
  role: string
}

interface Company {
  id: string
  razon_social: string
}

export default function ParticipantsManagement() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedParticipant[]>([])
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedCompanyForBulk, setSelectedCompanyForBulk] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tableScrollRef = React.useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue
  } = useForm<ParticipantFormData>({
    defaultValues: {
      country_code: '+51',
      role: 'participant'
    }
  })

  useEffect(() => {
    loadParticipants()
    loadCompanies()
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
  }, [participants])

  const loadParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, company:companies(razon_social)')
        .eq('role', 'participant')
        .order('created_at', { ascending: false })

      if (error) throw error
      setParticipants(data || [])
    } catch (error) {
      console.error('Error loading participants:', error)
      toast.error('Error al cargar participantes')
    } finally {
      setIsLoading(false)
    }
  }

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, razon_social')
        .order('razon_social')

      if (error) throw error
      setCompanies(data || [])
    } catch (error) {
      console.error('Error loading companies:', error)
      toast.error('Error al cargar empresas')
    }
  }

  const handleCreateOrUpdate = async (data: ParticipantFormData) => {
    try {
      if (editingParticipant) {
        // Update existing participant
        const updateData: any = {
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone || null,
          country_code: data.country_code,
          dni: data.dni || null,
          area: data.area || null,
          company_id: data.company_id || null,
          role: data.role,
          updated_at: new Date().toISOString()
        }

        if (data.password) {
          const bcrypt = await import('bcryptjs')
          updateData.password_hash = await bcrypt.hash(data.password, 10)
        }

        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', editingParticipant.id)

        if (error) throw error
        toast.success('Participante actualizado correctamente')
      } else {
        // Create new participant
        if (!data.password) {
          toast.error('La contraseña es requerida para nuevos participantes')
          return
        }

        const bcrypt = await import('bcryptjs')
        const passwordHash = await bcrypt.hash(data.password, 10)

        const { error } = await supabase
          .from('users')
          .insert([
            {
              email: data.email,
              password_hash: passwordHash,
              first_name: data.first_name,
              last_name: data.last_name,
              phone: data.phone || null,
              country_code: data.country_code,
              dni: data.dni || null,
              area: data.area || null,
              company_id: data.company_id || null,
              role: data.role
            }
          ])

        if (error) throw error
        toast.success('Participante creado correctamente')
      }

      await loadParticipants()
      setIsModalOpen(false)
      setEditingParticipant(null)
      reset()
    } catch (error: any) {
      console.error('Error saving participant:', error)
      toast.error(error.message || 'Error al guardar participante')
    }
  }

  const handleEdit = (participant: Participant) => {
    setEditingParticipant(participant)
    setValue('email', participant.email)
    setValue('first_name', participant.first_name)
    setValue('last_name', participant.last_name)
    setValue('phone', participant.phone || '')
    setValue('country_code', participant.country_code)
    setValue('dni', participant.dni || '')
    setValue('area', participant.area || '')
    setValue('company_id', participant.company_id || '')
    setIsModalOpen(true)
  }

  const handleDelete = async (participant: Participant) => {
    if (!confirm(`¿Estás seguro de eliminar a ${participant.first_name} ${participant.last_name}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', participant.id)

      if (error) throw error

      toast.success('Participante eliminado correctamente')
      await loadParticipants()
    } catch (error) {
      console.error('Error deleting participant:', error)
      toast.error('Error al eliminar participante')
    }
  }

  const handleDownloadTemplate = () => {
    generateParticipantsTemplate()
    toast.success('Plantilla descargada correctamente')
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setIsProcessing(true)

    try {
      const { participants, errors } = await parseParticipantsFromExcel(file)
      setParsedData(participants)
      setValidationErrors(errors)

      if (errors.length > 0) {
        toast.error(`Se encontraron ${errors.length} errores en el archivo`)
      } else {
        toast.success(`Se procesaron ${participants.length} participantes correctamente`)
      }
    } catch (error) {
      console.error('Error parsing file:', error)
      toast.error('Error al procesar el archivo')
      setSelectedFile(null)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBulkUpload = async () => {
    if (!selectedCompanyForBulk) {
      toast.error('Selecciona una empresa')
      return
    }

    if (parsedData.length === 0) {
      toast.error('No hay participantes para cargar')
      return
    }

    if (validationErrors.length > 0) {
      toast.error('Corrige los errores antes de continuar')
      return
    }

    setIsProcessing(true)

    try {
      const bcrypt = await import('bcryptjs')

      const participantsToInsert = await Promise.all(
        parsedData.map(async (p) => ({
          email: p.email,
          first_name: p.first_name,
          last_name: p.last_name,
          phone: p.phone || null,
          country_code: '+51',
          dni: p.dni,
          area: p.area || null,
          company_id: selectedCompanyForBulk,
          role: 'participant',
          password_hash: await bcrypt.hash(p.dni, 10)
        }))
      )

      const { error } = await supabase
        .from('users')
        .insert(participantsToInsert)

      if (error) throw error

      toast.success(`${participantsToInsert.length} participantes agregados correctamente`)
      await loadParticipants()
      handleCloseBulkModal()
    } catch (error: any) {
      console.error('Error bulk uploading:', error)
      if (error.code === '23505') {
        toast.error('Algunos participantes ya existen (DNI o correo duplicado)')
      } else {
        toast.error('Error al cargar participantes')
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCloseBulkModal = () => {
    setIsBulkModalOpen(false)
    setSelectedFile(null)
    setParsedData([])
    setValidationErrors([])
    setSelectedCompanyForBulk('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const countryCodes = [
    { code: '+1', country: 'Estados Unidos/Canadá' },
    { code: '+52', country: 'México' },
    { code: '+34', country: 'España' },
    { code: '+54', country: 'Argentina' },
    { code: '+57', country: 'Colombia' },
    { code: '+51', country: 'Perú' },
    { code: '+56', country: 'Chile' },
    { code: '+58', country: 'Venezuela' },
    { code: '+593', country: 'Ecuador' },
    { code: '+591', country: 'Bolivia' },
  ]

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
          <h1 className="text-2xl font-bold text-slate-800">Participantes</h1>
          <p className="text-slate-600">Gestiona los participantes de la plataforma</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            <Upload className="w-5 h-5 mr-2" />
            Carga Masiva
          </button>
          <button
            onClick={() => {
              setEditingParticipant(null)
              reset()
              setIsModalOpen(true)
            }}
            className="inline-flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Agregar Participante
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="max-h-[70vh] overflow-y-auto overflow-x-auto border-t border-b border-slate-200 relative">
          <div ref={tableScrollRef} className="table-scroll-container">
            <table className="w-full table-compact min-w-full">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">
                    Participante
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">
                    Empresa
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">
                    Contacto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider col-date bg-slate-50">
                    Fecha de Registro
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider col-actions bg-slate-50">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
              {participants.map((participant) => (
                <tr key={participant.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-slate-600" />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-slate-900">
                          {participant.first_name} {participant.last_name}
                        </div>
                        <div className="text-sm text-slate-500">{participant.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-600">
                      {participant.company?.razon_social || 'Sin empresa'}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="flex items-center text-sm text-slate-600">
                        <Mail className="w-4 h-4 mr-2 flex-shrink-0" />
                        {participant.email}
                      </div>
                      {participant.phone && (
                        <div className="flex items-center text-sm text-slate-600">
                          <Phone className="w-4 h-4 mr-2 flex-shrink-0" />
                          {participant.country_code} {participant.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                    {new Date(participant.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(participant)}
                      className="text-slate-600 hover:text-slate-900 mr-3"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(participant)}
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
        </div>

        {participants.length === 0 && (
          <div className="text-center py-12">
            <User className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-2 text-sm font-medium text-slate-900">No hay participantes</h3>
            <p className="mt-1 text-sm text-slate-500">Comienza agregando tu primer participante.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 md:p-4 z-50">
          <div className="bg-white md:rounded-xl shadow-xl max-w-md w-full h-full md:h-auto p-6 mobile-scroll-container md:mobile-no-overflow no-scrollbar">
            <h2 className="text-xl font-bold text-slate-800 mb-6">
              {editingParticipant ? 'Editar Participante' : 'Agregar Participante'}
            </h2>

            <form onSubmit={handleSubmit(handleCreateOrUpdate)} className="space-y-4">
              {/* Nombres */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nombre
                  </label>
                  <input
                    {...register('first_name', { required: 'El nombre es requerido' })}
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                  {errors.first_name && (
                    <p className="text-red-500 text-xs mt-1">{errors.first_name.message}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Apellido
                  </label>
                  <input
                    {...register('last_name', { required: 'El apellido es requerido' })}
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                  {errors.last_name && (
                    <p className="text-red-500 text-xs mt-1">{errors.last_name.message}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  {...register('email', {
                    required: 'El email es requerido',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Email inválido'
                    }
                  })}
                  type="email"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* Empresa */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Empresa
                </label>
                <select
                  {...register('company_id', { required: 'La empresa es requerida' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                >
                  <option value="">Selecciona una empresa</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.razon_social}
                    </option>
                  ))}
                </select>
                {errors.company_id && (
                  <p className="text-red-500 text-xs mt-1">{errors.company_id.message}</p>
                )}
              </div>

              {/* DNI y Área */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    DNI
                  </label>
                  <input
                    {...register('dni')}
                    type="text"
                    maxLength={8}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    placeholder="12345678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Área
                  </label>
                  <input
                    {...register('area')}
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    placeholder="Operaciones"
                  />
                </div>
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Teléfono
                </label>
                <div className="flex space-x-2">
                  <select
                    {...register('country_code')}
                    className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  >
                    {countryCodes.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.code}
                      </option>
                    ))}
                  </select>
                  <input
                    {...register('phone', { required: 'El teléfono es requerido' })}
                    type="tel"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>
                {errors.phone && (
                  <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>
                )}
              </div>

              {/* Password - only for new participants */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {editingParticipant ? 'Nueva Contraseña (opcional)' : 'Contraseña'}
                </label>
                <div className="relative">
                  <input
                    {...register('password', {
                      required: !editingParticipant ? 'La contraseña es requerida' : false,
                      minLength: { value: 6, message: 'Mínimo 6 caracteres' }
                    })}
                    type={showPassword ? 'text' : 'password'}
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    placeholder={editingParticipant ? 'Dejar vacío para mantener actual' : 'Contraseña'}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
                )}
                {editingParticipant && (
                  <p className="text-slate-500 text-xs mt-1">
                    * Solo ingresa una contraseña si quieres cambiarla
                  </p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setEditingParticipant(null)
                    reset()
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto"></div>
                  ) : (
                    editingParticipant ? 'Actualizar' : 'Crear'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Carga Masiva de Participantes</h2>
                <p className="text-sm text-slate-600 mt-1">Importa múltiples participantes desde un archivo Excel</p>
              </div>
              <button
                onClick={handleCloseBulkModal}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-6">
                {/* Step 1: Download Template */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h3 className="font-semibold text-slate-800 mb-2">Paso 1: Descarga la Plantilla</h3>
                  <p className="text-sm text-slate-600 mb-3">
                    Descarga la plantilla Excel con el formato correcto y los campos requeridos.
                  </p>
                  <button
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Descargar Plantilla
                  </button>
                </div>

                {/* Step 2: Select Company */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h3 className="font-semibold text-slate-800 mb-2">Paso 2: Selecciona la Empresa</h3>
                  <p className="text-sm text-slate-600 mb-3">
                    Todos los participantes se asignarán a esta empresa.
                  </p>
                  <select
                    value={selectedCompanyForBulk}
                    onChange={(e) => setSelectedCompanyForBulk(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  >
                    <option value="">Seleccionar empresa...</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.razon_social}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 3: Upload File */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h3 className="font-semibold text-slate-800 mb-2">Paso 3: Sube el Archivo</h3>
                  <p className="text-sm text-slate-600 mb-3">
                    Completa la plantilla con los datos de los participantes y súbela aquí.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-900 cursor-pointer"
                  />
                  {selectedFile && (
                    <p className="text-sm text-slate-600 mt-2">
                      Archivo seleccionado: <span className="font-medium">{selectedFile.name}</span>
                    </p>
                  )}
                </div>

                {/* Validation Errors */}
                {validationErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-semibold text-red-800 mb-2">
                      Errores de Validación ({validationErrors.length})
                    </h3>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {validationErrors.map((error, idx) => (
                        <p key={idx} className="text-sm text-red-700">
                          Fila {error.row}, {error.field}: {error.message}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview Data */}
                {parsedData.length > 0 && validationErrors.length === 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-semibold text-green-800 mb-2">
                      Participantes Listos para Importar ({parsedData.length})
                    </h3>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-green-100 sticky top-0">
                          <tr>
                            <th className="p-2 text-left">DNI</th>
                            <th className="p-2 text-left">Nombres</th>
                            <th className="p-2 text-left">Apellidos</th>
                            <th className="p-2 text-left">Área</th>
                            <th className="p-2 text-left">Email</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedData.map((p, idx) => (
                            <tr key={idx} className="border-b border-green-200">
                              <td className="p-2">{p.dni}</td>
                              <td className="p-2">{p.first_name}</td>
                              <td className="p-2">{p.last_name}</td>
                              <td className="p-2">{p.area || '-'}</td>
                              <td className="p-2">{p.email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
              <button
                onClick={handleCloseBulkModal}
                disabled={isProcessing}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkUpload}
                disabled={isProcessing || parsedData.length === 0 || validationErrors.length > 0 || !selectedCompanyForBulk}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Procesando...
                  </div>
                ) : (
                  `Importar ${parsedData.length} Participantes`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}