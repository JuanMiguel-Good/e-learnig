import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, FileText, Users, Building2, Download, Eye, Trash2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'

interface Course {
  id: string
  title: string
  hours: number
  instructor: {
    id: string
    name: string
    signature_url: string | null
  }
}

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
  responsibles: {
    nombre: string
    cargo: string
    signature_url: string | null
  }[]
}

interface AttendanceList {
  id: string
  course_type: string
  charla_5_minutos: boolean
  reunion: boolean
  cargo_otro: string | null
  tema: string | null
  instructor_name: string
  fecha: string
  created_at: string
  course: {
    title: string
    hours: number
  }
  company: {
    razon_social: string
  }
  signatures?: any[]
}

interface AttendanceFormData {
  course_id: string
  company_id: string
  attendance_type: 'INDUCCIÓN' | 'CAPACITACIÓN' | 'ENTRENAMIENTO' | 'SIMULACRO DE EMERGENCIA' | 'CHARLA 5 MINUTOS' | 'REUNIÓN' | 'CARGO' | 'OTRO'
  cargo_otro: string
  tema: string
  fecha: string
  fecha_inicio: string
  fecha_fin: string
  responsible_name: string
  responsible_position: string
  responsible_date: string
}

export default function AttendanceManagement() {
  const [attendanceLists, setAttendanceLists] = useState<AttendanceList[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceList | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch
  } = useForm<AttendanceFormData>({
    defaultValues: {
      attendance_type: 'CAPACITACIÓN',
      fecha: new Date().toISOString().split('T')[0],
      responsible_date: new Date().toISOString().split('T')[0],
      fecha_inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 días atrás
      fecha_fin: new Date().toISOString().split('T')[0] // Hoy
    }
  })

  const selectedCourseId = watch('course_id')
  const selectedCompanyId = watch('company_id')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Load attendance lists
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_lists')
        .select(`
          *,
          course:courses!inner(title, hours),
          company:companies!inner(razon_social),
          signatures:attendance_signatures(
            user:users!inner(first_name, last_name, dni),
            signed_at
          )
        `)
        .order('created_at', { ascending: false })

      if (attendanceError) throw attendanceError

      // Load courses with instructor
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select(`
          id,
          title,
          hours,
          instructor:instructors!inner(id, name, signature_url)
        `)
        .eq('is_active', true)
        .order('title')

      if (coursesError) throw coursesError

      // Load companies with responsibles
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select(`
          *,
          responsibles:company_responsibles(nome, cargo, signature_url)
        `)
        .order('razon_social')

      if (companiesError) throw companiesError

      setAttendanceLists(attendanceData || [])
      setCourses(coursesData || [])
      setCompanies(companiesData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async (data: AttendanceFormData) => {
    try {
      const selectedCourse = courses.find(c => c.id === data.course_id)
      if (!selectedCourse) throw new Error('Curso no encontrado')

      // Get participants who passed evaluation in the date range
      const { data: participantsData, error: participantsError } = await supabase
        .from('evaluation_attempts')
        .select(`
          user_id,
          completed_at,
          users!inner(first_name, last_name, dni, company_id)
        `)
        .eq('passed', true)
        .eq('users.company_id', data.company_id)
        .gte('completed_at', data.fecha_inicio)
        .lte('completed_at', data.fecha_fin)
        .eq('evaluations.course_id', data.course_id)

      if (participantsError) throw participantsError

      const { error } = await supabase
        .from('attendance_lists')
        .insert([
          {
            course_id: data.course_id,
            company_id: data.company_id,
            attendance_type: data.attendance_type,
            cargo_otro: data.cargo_otro || null,
            tema: data.tema || selectedCourse.title,
            instructor_name: selectedCourse.instructor.name,
            fecha: new Date(data.fecha).toISOString(),
            responsible_name: data.responsible_name,
            responsible_position: data.responsible_position,
            responsible_date: new Date(data.responsible_date).toISOString(),
            date_range_start: new Date(data.fecha_inicio).toISOString(),
            date_range_end: new Date(data.fecha_fin).toISOString()
          }
        ])

      if (error) throw error
      
      toast.success('Lista de asistencia creada correctamente')
      await loadData()
      setIsModalOpen(false)
      reset()
    } catch (error: any) {
      console.error('Error creating attendance list:', error)
      if (error.code === '23505') {
        toast.error('Ya existe una lista de asistencia para este curso y empresa')
      } else {
        toast.error(error.message || 'Error al crear lista de asistencia')
      }
    }
  }

  const handleDelete = async (attendance: AttendanceList) => {
    if (!confirm(`¿Estás seguro de eliminar esta lista de asistencia?`)) return

    try {
      const { error } = await supabase
        .from('attendance_lists')
        .delete()
        .eq('id', attendance.id)

      if (error) throw error
      
      toast.success('Lista eliminada correctamente')
      await loadData()
    } catch (error) {
      console.error('Error deleting attendance:', error)
      toast.error('Error al eliminar lista')
    }
  }

  const viewAttendanceList = async (attendance: AttendanceList) => {
    try {
      // Load signatures for this attendance list
      const { data: signaturesData, error } = await supabase
        .from('attendance_signatures')
        .select(`
          *,
          user:users!inner(first_name, last_name, dni, company:companies(razon_social))
        `)
        .eq('attendance_list_id', attendance.id)
        .order('signed_at')

      if (error) throw error

      setSelectedAttendance({
        ...attendance,
        signatures: signaturesData || []
      })
    } catch (error) {
      console.error('Error loading signatures:', error)
      toast.error('Error al cargar firmas')
    }
  }

  const exportToPDF = (attendance: AttendanceList) => {
    // TODO: Implement PDF export using jsPDF
    toast.info('Exportación a PDF próximamente')
  }

  const filteredLists = attendanceLists.filter(list => 
    list.course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    list.company.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
    list.instructor_name.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Listas de Asistencia</h1>
          <p className="text-sm md:text-base text-slate-600">Gestiona las listas de asistencia por curso y empresa</p>
        </div>
        <button
          onClick={() => {
            reset()
            setIsModalOpen(true)
          }}
          className="inline-flex items-center px-3 md:px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors text-sm md:text-base"
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5 mr-2" />
          Nueva Lista
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por curso, empresa o instructor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm md:text-base"
          />
        </div>
      </div>

      {/* Attendance Lists */}
      <div className="space-y-4">
        {filteredLists.map((attendance) => (
          <div key={attendance.id} className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Info */}
              <div className="flex items-start gap-4 flex-1">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-1">
                    {attendance.course.title}
                  </h3>
                  <p className="text-sm md:text-base text-slate-600 mb-2">
                    {attendance.company.razon_social}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 text-xs mb-2">
                    <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                      {attendance.attendance_type}
                    </span>
                    <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full">
                      {attendance.course.hours} horas
                    </span>
                    <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
                      {attendance.signatures?.length || 0} participantes
                    </span>
                  </div>
                  
                  <div className="text-sm text-slate-500">
                    <p>Instructor: {attendance.instructor_name}</p>
                    <p>Fecha: {new Date(attendance.fecha).toLocaleDateString('es-ES')}</p>
                    {attendance.tema && <p>Tema: {attendance.tema}</p>}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-2">
                <button
                  onClick={() => viewAttendanceList(attendance)}
                  className="flex-1 lg:flex-none px-3 py-2 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-lg transition-colors text-sm"
                >
                  <Eye className="w-4 h-4 mx-auto lg:mr-2" />
                  <span className="hidden lg:inline">Ver Lista</span>
                </button>
                <button
                  onClick={() => exportToPDF(attendance)}
                  className="flex-1 lg:flex-none px-3 py-2 text-green-600 hover:text-green-900 hover:bg-green-100 rounded-lg transition-colors text-sm"
                >
                  <Download className="w-4 h-4 mx-auto lg:mr-2" />
                  <span className="hidden lg:inline">PDF</span>
                </button>
                <button
                  onClick={() => handleDelete(attendance)}
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

      {filteredLists.length === 0 && (
        <div className="text-center py-8 md:py-12">
          <FileText className="mx-auto h-10 w-10 md:h-12 md:w-12 text-slate-400" />
          <h3 className="mt-2 text-sm md:text-base font-medium text-slate-900">
            {searchTerm ? 'No hay resultados' : 'No hay listas de asistencia'}
          </h3>
          <p className="mt-1 text-xs md:text-sm text-slate-500">
            {searchTerm 
              ? 'Intenta con otros términos de búsqueda.' 
              : 'Comienza creando una lista de asistencia.'
            }
          </p>
        </div>
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 md:p-4 z-50 overflow-y-auto no-scrollbar">
          <div className="bg-white md:rounded-xl shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto md:my-4 modal-content">
            <div className="p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-slate-800 mb-4 md:mb-6">
                Nueva Lista de Asistencia
              </h2>

              <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
                {/* Course and Company */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Curso *
                    </label>
                    <select
                      {...register('course_id', { required: 'Selecciona un curso' })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                    >
                      <option value="">Seleccionar curso</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title} ({course.hours}h)
                        </option>
                      ))}
                    </select>
                    {errors.course_id && (
                      <p className="text-red-500 text-xs mt-1">{errors.course_id.message}</p>
                    )}
                  </div>

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
                          {company.razon_social}
                        </option>
                      ))}
                    </select>
                    {errors.company_id && (
                      <p className="text-red-500 text-xs mt-1">{errors.company_id.message}</p>
                    )}
                  </div>
                </div>

                {/* Course Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tipo de Curso *
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {['INDUCCIÓN', 'CAPACITACIÓN', 'ENTRENAMIENTO', 'SIMULACRO DE EMERGENCIA'].map((type) => (
                      <label key={type} className="flex items-center">
                        <input
                          {...register('course_type', { required: 'Selecciona un tipo' })}
                          type="radio"
                          value={type}
                          className="h-4 w-4 text-slate-600 focus:ring-slate-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-slate-700">{type}</span>
                      </label>
                    ))}
                  </div>
                  {errors.course_type && (
                    <p className="text-red-500 text-xs mt-1">{errors.course_type.message}</p>
                  )}
                </div>

                {/* Additional Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <input
                      {...register('charla_5_minutos')}
                      type="checkbox"
                      className="h-4 w-4 text-slate-600 focus:ring-slate-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 text-sm text-slate-700">
                      Charla 5 minutos
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      {...register('reunion')}
                      type="checkbox"
                      className="h-4 w-4 text-slate-600 focus:ring-slate-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 text-sm text-slate-700">
                      Reunión
                    </label>
                  </div>
                </div>

                {/* Additional Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Cargo (Otro)
                    </label>
                    <input
                      {...register('cargo_otro')}
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                      placeholder="Especificar cargo"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Fecha *
                    </label>
                    <input
                      {...register('fecha', { required: 'La fecha es requerida' })}
                      type="date"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                    />
                    {errors.fecha && (
                      <p className="text-red-500 text-xs mt-1">{errors.fecha.message}</p>
                    )}
                  </div>
                </div>

                {/* Custom Topic */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tema (opcional - se usará el título del curso si está vacío)
                  </label>
                  <input
                    {...register('tema')}
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                    placeholder="Tema personalizado"
                  />
                </div>

                {/* Buttons */}
                <div className="flex space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false)
                      reset()
                    }}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
                  >
                    {isSubmitting ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto"></div>
                    ) : (
                      'Crear Lista'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {selectedAttendance && (
        <AttendanceListView
          attendance={selectedAttendance}
          onClose={() => setSelectedAttendance(null)}
        />
      )}
    </div>
  )
}

// Subcomponent for viewing attendance list
interface AttendanceListViewProps {
  attendance: AttendanceList & { signatures: any[] }
  onClose: () => void
}

function AttendanceListView({ attendance, onClose }: AttendanceListViewProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 md:p-4 z-50 overflow-y-auto no-scrollbar">
      <div className="bg-white md:rounded-xl shadow-xl max-w-6xl w-full max-h-screen overflow-y-auto md:my-4 modal-content">
        <div className="p-4 md:p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-lg md:text-xl font-bold text-slate-800 pr-8">
              Lista de Asistencia: {attendance.course.title}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          {/* Attendance List Preview */}
          <div className="bg-white border rounded-lg p-6 mb-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold">
                REGISTRO DE INDUCCIÓN, CAPACITACIÓN, ENTRENAMIENTO Y SIMULACROS DE EMERGENCIA
              </h3>
            </div>

            {/* Company Info Section */}
            <div className="border border-slate-400 mb-4">
              <div className="bg-slate-100 p-2 text-center font-bold text-sm">
                DATOS DEL EMPLEADOR
              </div>
              <div className="grid grid-cols-5 min-h-20 text-xs">
                <div className="border-r border-slate-400 p-2 flex items-center justify-center">
                  <div className="text-center">
                    <div className="font-medium">RAZÓN SOCIAL O</div>
                    <div className="font-medium">DENOMINACIÓN SOCIAL</div>
                  </div>
                </div>
                <div className="border-r border-slate-400 p-2 flex items-center justify-center">
                  <div className="text-center font-medium">RUC</div>
                </div>
                <div className="border-r border-slate-400 p-2 flex items-center justify-center">
                  <div className="text-center">
                    <div className="font-medium">DOMICILIO</div>
                    <div className="text-xs">(Dirección, distrito, departamento, provincia)</div>
                  </div>
                </div>
                <div className="border-r border-slate-400 p-2 flex items-center justify-center">
                  <div className="text-center">
                    <div className="font-medium">ACTIVIDAD</div>
                    <div className="font-medium">ECONÓMICA</div>
                  </div>
                </div>
                <div className="p-2 flex items-center justify-center">
                  <div className="text-center">
                    <div className="font-medium">Nº TRABAJADORES</div>
                    <div className="font-medium">EN EL CENTRO LABORAL</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Course Type Selection */}
            <div className="border border-slate-400 mb-4">
              <div className="bg-slate-100 p-2 text-center font-bold text-sm">
                MARCAR (X)
              </div>
              <div className="grid grid-cols-4 text-xs">
                <div className="border-r border-slate-400 p-2 text-center">
                  <div className="font-medium">INDUCCIÓN</div>
                  <div className="text-xl">{attendance.course_type === 'INDUCCIÓN' ? 'X' : ''}</div>
                </div>
                <div className="border-r border-slate-400 p-2 text-center">
                  <div className="font-medium">CAPACITACIÓN</div>
                  <div className="text-xl">{attendance.course_type === 'CAPACITACIÓN' ? 'X' : ''}</div>
                </div>
                <div className="border-r border-slate-400 p-2 text-center">
                  <div className="font-medium">ENTRENAMIENTO</div>
                  <div className="text-xl">{attendance.course_type === 'ENTRENAMIENTO' ? 'X' : ''}</div>
                </div>
                <div className="p-2 text-center">
                  <div className="font-medium">SIMULACRO DE EMERGENCIA</div>
                  <div className="text-xl">{attendance.course_type === 'SIMULACRO DE EMERGENCIA' ? 'X' : ''}</div>
                </div>
              </div>
            </div>

            {/* Additional Options */}
            <div className="border border-slate-400 mb-4">
              <div className="grid grid-cols-4 text-xs">
                <div className="border-r border-slate-400 p-2 text-center">
                  <div className="font-medium">CHARLA 5 MINUTOS</div>
                  <div className="text-xl">{attendance.charla_5_minutos ? 'X' : ''}</div>
                </div>
                <div className="border-r border-slate-400 p-2 text-center">
                  <div className="font-medium">REUNIÓN</div>
                  <div className="text-xl">{attendance.reunion ? 'X' : ''}</div>
                </div>
                <div className="border-r border-slate-400 p-2 text-center">
                  <div className="font-medium">CARGO</div>
                  <div className="text-xs">{attendance.cargo_otro || ''}</div>
                </div>
                <div className="p-2 text-center">
                  <div className="font-medium">OTRO</div>
                </div>
              </div>
            </div>

            {/* Topic and Hours */}
            <div className="border border-slate-400 mb-4">
              <div className="grid grid-cols-3 text-xs min-h-16">
                <div className="border-r border-slate-400 p-2">
                  <div className="font-medium mb-1">TEMA:</div>
                  <div>{attendance.tema}</div>
                </div>
                <div className="border-r border-slate-400 p-2 text-center">
                  <div className="font-medium mb-1">Nº HORAS:</div>
                  <div className="text-lg font-bold">{attendance.course.hours}</div>
                </div>
                <div className="p-2">
                  <div className="font-medium mb-1">NOMBRE DEL CAPACITADOR:</div>
                  <div>{attendance.instructor_name}</div>
                  <div className="mt-2 text-right font-medium">FIRMA:</div>
                </div>
              </div>
            </div>

            {/* Participants Table */}
            <div className="border border-slate-400 mb-4">
              <div className="bg-slate-100 p-2 text-center font-bold text-sm">
                DATOS DE LOS PARTICIPANTES
              </div>
              <div className="grid grid-cols-4 text-xs bg-slate-50">
                <div className="border-r border-slate-400 p-2 text-center font-medium">
                  APELLIDOS Y NOMBRES DE LOS CAPACITADOS
                </div>
                <div className="border-r border-slate-400 p-2 text-center font-medium">
                  Nº DNI
                </div>
                <div className="border-r border-slate-400 p-2 text-center font-medium">
                  ÁREA
                </div>
                <div className="p-2 text-center font-medium">
                  FIRMA
                </div>
              </div>

              {/* Participant Rows */}
              {attendance.signatures?.length > 0 ? (
                attendance.signatures.map((signature: any, index: number) => (
                  <div key={signature.id} className="grid grid-cols-4 text-xs border-t border-slate-400 min-h-12">
                    <div className="border-r border-slate-400 p-2 flex items-center">
                      {signature.user.first_name} {signature.user.last_name}
                    </div>
                    <div className="border-r border-slate-400 p-2 flex items-center justify-center">
                      {signature.user.dni}
                    </div>
                    <div className="border-r border-slate-400 p-2 flex items-center justify-center">
                      {signature.user.company?.razon_social}
                    </div>
                    <div className="p-2 flex items-center justify-center">
                      {signature.signature_data && (
                        <img 
                          src={`data:image/png;base64,${signature.signature_data}`}
                          alt="Firma"
                          className="max-h-8 max-w-24"
                        />
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="grid grid-cols-4 text-xs border-t border-slate-400 min-h-12">
                  <div className="border-r border-slate-400 p-2 flex items-center justify-center text-slate-400">
                    No hay participantes registrados
                  </div>
                  <div className="border-r border-slate-400 p-2"></div>
                  <div className="border-r border-slate-400 p-2"></div>
                  <div className="p-2"></div>
                </div>
              )}
            </div>

            {/* Responsible Section */}
            <div className="border border-slate-400">
              <div className="bg-slate-100 p-2 text-center font-bold text-sm">
                RESPONSABLE DEL REGISTRO
              </div>
              <div className="grid grid-cols-3 text-xs min-h-16">
                <div className="border-r border-slate-400 p-2">
                  <div className="font-medium">NOMBRE:</div>
                </div>
                <div className="border-r border-slate-400 p-2">
                  <div className="font-medium">CARGO:</div>
                </div>
                <div className="p-2 text-right">
                  <div className="font-medium">FIRMA:</div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors text-sm"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}