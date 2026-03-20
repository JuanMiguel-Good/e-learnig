import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, CreditCard as Edit2, Trash2, Phone, Mail, User, Eye, EyeOff, Upload, Download, X, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { useAuth } from '../../contexts/AuthContext'
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
  password?: string
}

export default function CompanyParticipantsManagement() {
  const { user } = useAuth()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [companyName, setCompanyName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedParticipant[]>([])
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue
  } = useForm<ParticipantFormData>({
    defaultValues: {
      country_code: '+51'
    }
  })

  useEffect(() => {
    if (user?.company_id) {
      loadParticipants()
      loadCompanyName()
    }
  }, [user?.company_id])

  const loadParticipants = async () => {
    if (!user?.company_id) {
      toast.error('No tienes una empresa asignada')
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, company:companies(razon_social)')
        .eq('role', 'participant')
        .eq('company_id', user.company_id)
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

  const loadCompanyName = async () => {
    if (!user?.company_id) return

    try {
      const { data, error } = await supabase
        .from('companies')
        .select('razon_social')
        .eq('id', user.company_id)
        .single()

      if (error) throw error
      setCompanyName(data?.razon_social || '')
    } catch (error) {
      console.error('Error loading company name:', error)
    }
  }

  const filteredParticipants = participants.filter(participant => {
    if (searchTerm === '') return true
    return participant.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participant.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participant.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (participant.dni && participant.dni.toLowerCase().includes(searchTerm.toLowerCase()))
  })

  const handleCreateOrUpdate = async (data: ParticipantFormData) => {
    if (!user?.company_id) {
      toast.error('No tienes una empresa asignada')
      return
    }

    try {
      if (editingParticipant) {
        const updateData: any = {
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone || null,
          country_code: data.country_code,
          dni: data.dni || null,
          area: data.area || null,
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
              company_id: user.company_id,
              role: 'participant'
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
    if (!user?.company_id) {
      toast.error('No tienes una empresa asignada')
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
          company_id: user.company_id,
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

  if (!user?.company_id) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">No tienes una empresa asignada. Contacta al administrador.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Participantes</h1>
          <p className="text-slate-600">
            Gestiona los participantes de {companyName || 'tu empresa'}
          </p>
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

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6 w-full">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o DNI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border w-full overflow-hidden">
        <div className="max-h-[70vh] overflow-auto w-full">
          <div ref={tableScrollRef} className="min-w-full">
            <table className="w-full table-compact" style={{minWidth: '800px'}}>
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">
                    Participante
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">
                    DNI
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">
                    Contacto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">
                    Área
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
              {filteredParticipants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    {searchTerm
                      ? 'No se encontraron participantes con los filtros aplicados'
                      : 'No hay participantes registrados'}
                  </td>
                </tr>
              ) : (
                filteredParticipants.map((participant) => (
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
                      {participant.dni || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="flex items-center text-sm text-slate-600">
                        <Mail className="w-4 h-4 mr-2 text-slate-400" />
                        {participant.email}
                      </div>
                      {participant.phone && (
                        <div className="flex items-center text-sm text-slate-600">
                          <Phone className="w-4 h-4 mr-2 text-slate-400" />
                          {participant.country_code} {participant.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-600">
                      {participant.area || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(participant)}
                        className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(participant)}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
              )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">
                  {editingParticipant ? 'Editar Participante' : 'Nuevo Participante'}
                </h2>
                <button
                  onClick={() => {
                    setIsModalOpen(false)
                    setEditingParticipant(null)
                    reset()
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit(handleCreateOrUpdate)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      {...register('first_name', { required: 'El nombre es requerido' })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    />
                    {errors.first_name && (
                      <p className="mt-1 text-sm text-red-600">{errors.first_name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Apellido *
                    </label>
                    <input
                      type="text"
                      {...register('last_name', { required: 'El apellido es requerido' })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    />
                    {errors.last_name && (
                      <p className="mt-1 text-sm text-red-600">{errors.last_name.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      {...register('email', {
                        required: 'El email es requerido',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Email inválido'
                        }
                      })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      DNI *
                    </label>
                    <input
                      type="text"
                      {...register('dni', { required: 'El DNI es requerido' })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    />
                    {errors.dni && (
                      <p className="mt-1 text-sm text-red-600">{errors.dni.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Código de País
                    </label>
                    <select
                      {...register('country_code')}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    >
                      {countryCodes.map((cc) => (
                        <option key={cc.code} value={cc.code}>
                          {cc.code} - {cc.country}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      {...register('phone')}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Área
                  </label>
                  <input
                    type="text"
                    {...register('area')}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    placeholder="Ej: Operaciones, Mantenimiento, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Contraseña {!editingParticipant && '*'}
                  </label>
                  {!editingParticipant && (
                    <p className="text-xs text-slate-500 mb-2">
                      Por defecto, la contraseña será el número de DNI
                    </p>
                  )}
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      {...register('password', {
                        required: !editingParticipant ? 'La contraseña es requerida' : false
                      })}
                      className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                      placeholder={editingParticipant ? 'Dejar en blanco para no cambiar' : ''}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
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
                    {isSubmitting ? 'Guardando...' : editingParticipant ? 'Actualizar' : 'Crear'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Carga Masiva de Participantes</h2>
                <button
                  onClick={handleCloseBulkModal}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Nota:</strong> Todos los participantes se agregarán automáticamente a tu empresa: <strong>{companyName}</strong>
                  </p>
                </div>

                <div>
                  <button
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Descargar Plantilla Excel
                  </button>
                  <p className="text-sm text-slate-600 mt-2">
                    Descarga la plantilla, complétala y súbela aquí
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Archivo Excel
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="block w-full text-sm text-slate-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-medium
                      file:bg-slate-100 file:text-slate-700
                      hover:file:bg-slate-200"
                  />
                </div>

                {selectedFile && (
                  <>
                    {isProcessing ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800 mx-auto"></div>
                        <p className="text-slate-600 mt-2">Procesando archivo...</p>
                      </div>
                    ) : (
                      <>
                        {validationErrors.length > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-60 overflow-auto">
                            <h4 className="font-medium text-red-800 mb-2">Errores encontrados:</h4>
                            <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                              {validationErrors.map((error, idx) => (
                                <li key={idx}>
                                  Fila {error.row}: {error.field} - {error.message}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {parsedData.length > 0 && (
                          <div>
                            <h4 className="font-medium text-slate-800 mb-2">
                              Participantes a agregar: {parsedData.length}
                            </h4>
                            <div className="max-h-60 overflow-auto border border-slate-200 rounded-lg">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-50 sticky top-0">
                                  <tr>
                                    <th className="px-4 py-2 text-left">Nombre</th>
                                    <th className="px-4 py-2 text-left">Apellido</th>
                                    <th className="px-4 py-2 text-left">Email</th>
                                    <th className="px-4 py-2 text-left">DNI</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {parsedData.map((p, idx) => (
                                    <tr key={idx} className="border-t border-slate-200">
                                      <td className="px-4 py-2">{p.first_name}</td>
                                      <td className="px-4 py-2">{p.last_name}</td>
                                      <td className="px-4 py-2">{p.email}</td>
                                      <td className="px-4 py-2">{p.dni}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleCloseBulkModal}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleBulkUpload}
                    disabled={!selectedFile || parsedData.length === 0 || validationErrors.length > 0 || isProcessing}
                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {isProcessing ? 'Procesando...' : 'Cargar Participantes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
