import { AttendancePDFGenerator } from '../../lib/attendancePDFGenerator'
import { ExcelAttendanceExporter } from '../../lib/excelAttendanceExporter'
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
    id: string
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
  responsible_id: string
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
  const [previewParticipants, setPreviewParticipants] = useState<any[]>([])
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue
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
  const fechaInicio = watch('fecha_inicio')
  const fechaFin = watch('fecha_fin')

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedCourseId && selectedCompanyId && fechaInicio && fechaFin) {
      loadPreviewParticipants()
    } else {
      setPreviewParticipants([])
      setShowPreview(false)
    }
  }, [selectedCourseId, selectedCompanyId, fechaInicio, fechaFin])

  const loadPreviewParticipants = async () => {
    if (!selectedCourseId || !selectedCompanyId || !fechaInicio || !fechaFin) return

    try {
      setIsLoadingPreview(true)

      // Get participants who passed evaluation in the date range
      const { data: participantsData, error: participantsError } = await supabase
        .from('evaluation_attempts')
        .select(`
          id,
          user_id,
          completed_at,
          passed,
          users!inner(
            id,
            first_name,
            last_name,
            dni,
            area,
            company_id
          ),
          evaluation:evaluations!inner(course_id)
        `)
        .eq('passed', true)
        .eq('users.company_id', selectedCompanyId)
        .gte('completed_at', fechaInicio)
        .lte('completed_at', fechaFin + 'T23:59:59')
        .eq('evaluation.course_id', selectedCourseId)

      if (participantsError) throw participantsError

      // For each participant, check if they have a signature
      const participantsWithSignatures = await Promise.all(
        (participantsData || []).map(async (participant: any) => {
          const { data: signatureData } = await supabase
            .from('attendance_signatures')
            .select('id, signature_data, signed_at')
            .eq('evaluation_attempt_id', participant.id)
            .maybeSingle()

          return {
            ...participant,
            has_signature: !!signatureData,
            signature: signatureData
          }
        })
      )

      setPreviewParticipants(participantsWithSignatures)
      setShowPreview(true)
    } catch (error) {
      console.error('Error loading preview:', error)
      toast.error('Error al cargar vista previa de participantes')
    } finally {
      setIsLoadingPreview(false)
    }
  }

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
            id,
            signature_data,
            signed_at,
            user:users!inner(first_name, last_name, dni, area)
          )
        `)
        .order('created_at', { ascending: false })

      if (attendanceError) throw attendanceError

      const listsWithCounts = (attendanceData || []).map((list: any) => ({
        ...list,
        participantCount: list.signatures?.length || 0
      }))

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
          responsibles:company_responsibles(id, nombre, cargo, signature_url)
        `)
        .order('razon_social')

      if (companiesError) throw companiesError

      setAttendanceLists(listsWithCounts)
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

      // Create attendance list first
      const { data: newList, error: insertError } = await supabase
        .from('attendance_lists')
        .insert([
          {
            course_id: data.course_id,
            company_id: data.company_id,
            course_type: data.attendance_type,
            attendance_type: data.attendance_type,
            charla_5_minutos: data.attendance_type === 'CHARLA 5 MINUTOS',
            reunion: data.attendance_type === 'REUNIÓN',
            cargo_otro: data.cargo_otro || null,
            tema: data.tema || selectedCourse.title,
            instructor_name: selectedCourse.instructor.name,
            fecha: new Date(data.fecha).toISOString(),
            responsible_name: data.responsible_name,
            responsible_position: data.responsible_position,
            responsible_date: new Date(data.fecha).toISOString(),
            date_range_start: new Date(data.fecha_inicio).toISOString(),
            date_range_end: new Date(data.fecha_fin).toISOString()
          }
        ])
        .select()
        .single()

      if (insertError) throw insertError
      if (!newList) throw new Error('No se pudo crear la lista')

      // Find signatures that should be linked - only those with signatures and within the date range
      const { data: signaturesData, error: signaturesError } = await supabase
        .from('attendance_signatures')
        .select(`
          id,
          evaluation_attempt_id,
          evaluation_attempt:evaluation_attempts!inner(
            completed_at,
            passed,
            user_id,
            evaluation:evaluations!inner(course_id),
            user:users!inner(company_id)
          )
        `)
        .is('attendance_list_id', null)
        .eq('evaluation_attempt.passed', true)
        .eq('evaluation_attempt.user.company_id', data.company_id)
        .eq('evaluation_attempt.evaluation.course_id', data.course_id)
        .gte('evaluation_attempt.completed_at', data.fecha_inicio)
        .lte('evaluation_attempt.completed_at', data.fecha_fin + 'T23:59:59')

      if (signaturesError) {
        console.error('Error fetching signatures:', signaturesError)
        throw new Error('Error al buscar firmas')
      }

      let linkedCount = 0
      if (signaturesData && signaturesData.length > 0) {
        const signatureIds = signaturesData.map((s: any) => s.id)

        // Update signatures to link them to this attendance list
        const { error: updateError, count } = await supabase
          .from('attendance_signatures')
          .update({ attendance_list_id: newList.id })
          .in('id', signatureIds)

        if (updateError) {
          console.error('Error linking signatures:', updateError)
          toast.error('Lista creada pero hubo un error al vincular las firmas')
        } else {
          linkedCount = count || 0
        }
      }

      toast.success(`Lista de asistencia creada con ${linkedCount} participante(s)`)
      await loadData()
      setIsModalOpen(false)
      setPreviewParticipants([])
      setShowPreview(false)
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

  const getFilteredSignatures = async (attendanceList: any) => {
    if (attendanceList.date_range_start && attendanceList.date_range_end) {
      // Extract date from ISO string to get YYYY-MM-DD format
      const startDate = attendanceList.date_range_start.split('T')[0]
      const endDateOnly = attendanceList.date_range_end.split('T')[0]
      const endDate = `${endDateOnly}T23:59:59.999Z`

      const { data: attempts, error: attemptsError } = await supabase
        .from('evaluation_attempts')
        .select(`
          id,
          user_id,
          completed_at,
          users!inner(first_name, last_name, dni, area, company_id),
          evaluations!inner(course_id)
        `)
        .eq('passed', true)
        .eq('users.company_id', attendanceList.company_id)
        .eq('evaluations.course_id', attendanceList.course_id)
        .gte('completed_at', startDate)
        .lte('completed_at', endDate)

      if (attemptsError) {
        console.error('Error fetching attempts:', attemptsError)
        throw attemptsError
      }

      if (!attempts || attempts.length === 0) {
        return []
      }

      const attemptIds = attempts.map((a: any) => a.id)

      const { data: signaturesData, error: signaturesError } = await supabase
        .from('attendance_signatures')
        .select(`
          id,
          signature_data,
          signed_at,
          evaluation_attempt_id,
          user:users!inner(first_name, last_name, dni, area)
        `)
        .in('evaluation_attempt_id', attemptIds)
        .order('signed_at')

      if (signaturesError) {
        console.error('Error fetching signatures:', signaturesError)
        throw signaturesError
      }

      return signaturesData || []
    } else {
      const { data: signaturesData, error } = await supabase
        .from('attendance_signatures')
        .select(`
          *,
          user:users!inner(first_name, last_name, dni, area)
        `)
        .eq('attendance_list_id', attendanceList.id)
        .order('signed_at')

      if (error) throw error
      return signaturesData || []
    }
  }

  const viewAttendanceList = async (attendance: AttendanceList) => {
    try {
      const signaturesData = await getFilteredSignatures(attendance)

      setSelectedAttendance({
        ...attendance,
        signatures: signaturesData
      })
    } catch (error) {
      console.error('Error loading signatures:', error)
      toast.error('Error al cargar firmas')
    }
  }

  const exportToPDF = async (attendance: AttendanceList) => {
    try {
      toast.loading('Generando PDF...', { id: 'pdf-generation' })

      // Load full attendance data with signatures (only approved evaluations)
      const { data: fullData, error } = await supabase
        .from('attendance_lists')
        .select(`
          *,
          course:courses!inner(title, hours, instructor:instructors(name, signature_url)),
          company:companies!inner(*)
        `)
        .eq('id', attendance.id)
        .single()

      if (error) throw error

      // Get signatures using filtered method (by date range)
      const signaturesData = await getFilteredSignatures(fullData)

      // Get responsible signature
      const { data: responsibleData } = await supabase
        .from('company_responsibles')
        .select('signature_url')
        .eq('nombre', fullData.responsible_name)
        .eq('company_id', fullData.company_id)
        .maybeSingle()

      const dataWithSignatures = {
        ...fullData,
        signatures: signaturesData,
        responsible_signature_url: responsibleData?.signature_url || null,
        instructor_signature_url: fullData.course?.instructor?.signature_url || null
      }

      await AttendancePDFGenerator.generatePDF(dataWithSignatures)

      toast.success('PDF generado y descargado', { id: 'pdf-generation' })
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Error al generar PDF', { id: 'pdf-generation' })
    }
  }

  const exportToExcel = async (attendance: AttendanceList) => {
    try {
      toast.loading('Generando Excel...', { id: 'excel-generation' })

      // Load full attendance data with instructor signature
      const { data: fullData, error } = await supabase
        .from('attendance_lists')
        .select(`
          *,
          course:courses!inner(title, hours, instructor:instructors(name, signature_url)),
          company:companies!inner(*)
        `)
        .eq('id', attendance.id)
        .single()

      if (error) throw error

      // Get signatures using filtered method (by date range)
      const signaturesData = await getFilteredSignatures(fullData)

      // Get responsible signature
      const { data: responsibleData } = await supabase
        .from('company_responsibles')
        .select('signature_url')
        .eq('nombre', fullData.responsible_name)
        .eq('company_id', fullData.company_id)
        .maybeSingle()

      const dataWithSignatures = {
        ...fullData,
        signatures: signaturesData,
        responsible_signature_url: responsibleData?.signature_url || null,
        instructor_signature_url: fullData.course?.instructor?.signature_url || null
      }

      await ExcelAttendanceExporter.exportAttendanceToExcel(dataWithSignatures)
      toast.success('Excel generado y descargado', { id: 'excel-generation' })
    } catch (error) {
      console.error('Error generating Excel:', error)
      toast.error('Error al generar Excel', { id: 'excel-generation' })
    }
  }

  const exportAllToExcel = async () => {
    try {
      toast.loading('Generando resumen en Excel...', { id: 'summary-generation' })

      // Load all attendance data
      const { data: allData, error } = await supabase
        .from('attendance_lists')
        .select(`
          *,
          course:courses!inner(title, hours),
          company:companies!inner(razon_social),
          signatures:attendance_signatures(
            *,
            user:users!inner(first_name, last_name, dni, area)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      await ExcelAttendanceExporter.exportParticipantsSummary(allData || [])
      toast.success('Resumen completo exportado a Excel', { id: 'summary-generation' })
    } catch (error) {
      console.error('Error exporting summary:', error)
      toast.error('Error al exportar resumen', { id: 'summary-generation' })
    }
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
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={exportAllToExcel}
            className="inline-flex items-center px-3 md:px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors text-sm md:text-base"
          >
            <Download className="w-4 h-4 md:w-5 md:h-5 mr-2" />
            Exportar Todo
          </button>
          <button
            onClick={() => {
              reset()
              setPreviewParticipants([])
              setShowPreview(false)
              setIsModalOpen(true)
            }}
            className="inline-flex items-center px-3 md:px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors text-sm md:text-base"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5 mr-2" />
            Nueva Lista
          </button>
        </div>
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
                      {attendance.participantCount || 0} participantes
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
              <div className="flex flex-wrap gap-2 lg:flex-col lg:gap-2">
                <button
                  onClick={() => viewAttendanceList(attendance)}
                  className="flex-1 lg:flex-none px-3 py-2 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-lg transition-colors text-sm min-w-0"
                >
                  <Eye className="w-4 h-4 mx-auto lg:mx-0 lg:mr-2" />
                  <span className="hidden lg:inline">Ver Lista</span>
                </button>
                <button
                  onClick={() => exportToPDF(attendance)}
                  className="flex-1 lg:flex-none px-3 py-2 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-lg transition-colors text-sm min-w-0"
                >
                  <FileText className="w-4 h-4 mx-auto lg:mx-0 lg:mr-2" />
                  <span className="hidden lg:inline">PDF</span>
                </button>
                <button
                  onClick={() => exportToExcel(attendance)}
                  className="flex-1 lg:flex-none px-3 py-2 text-green-600 hover:text-green-900 hover:bg-green-100 rounded-lg transition-colors text-sm min-w-0"
                >
                  <Download className="w-4 h-4 mx-auto lg:mx-0 lg:mr-2" />
                  <span className="hidden lg:inline">Excel</span>
                </button>
                <button
                  onClick={() => handleDelete(attendance)}
                  className="flex-1 lg:flex-none px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors text-sm min-w-0"
                >
                  <Trash2 className="w-4 h-4 mx-auto lg:mx-0 lg:mr-2" />
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

                {/* Tipo de Curso - 8 opciones */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tipo de Curso *
                  </label>
                  <div className="space-y-3">
                    {/* Primera fila */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {['INDUCCIÓN', 'CAPACITACIÓN', 'ENTRENAMIENTO', 'SIMULACRO DE EMERGENCIA'].map((type) => (
                        <label key={type} className="flex items-center">
                          <input
                            {...register('attendance_type', { required: 'Selecciona un tipo' })}
                            type="radio"
                            value={type}
                            className="h-4 w-4 text-slate-600 focus:ring-slate-500 border-gray-300"
                          />
                          <span className="ml-2 text-sm text-slate-700">{type}</span>
                        </label>
                      ))}
                    </div>
                    
                    {/* Segunda fila */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {['CHARLA 5 MINUTOS', 'REUNIÓN', 'CARGO', 'OTRO'].map((type) => (
                        <label key={type} className="flex items-center">
                          <input
                            {...register('attendance_type', { required: 'Selecciona un tipo' })}
                            type="radio"
                            value={type}
                            className="h-4 w-4 text-slate-600 focus:ring-slate-500 border-gray-300"
                          />
                          <span className="ml-2 text-sm text-slate-700">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {errors.attendance_type && (
                    <p className="text-red-500 text-xs mt-1">{errors.attendance_type.message}</p>
                  )}
                </div>

                {/* Campo de especificación para CARGO u OTRO */}
                {(watch('attendance_type') === 'CARGO' || watch('attendance_type') === 'OTRO') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {watch('attendance_type') === 'CARGO' ? 'Especificar Cargo' : 'Especificar Otro'}
                    </label>
                    <input
                      {...register('cargo_otro', { 
                        required: (watch('attendance_type') === 'CARGO' || watch('attendance_type') === 'OTRO') 
                          ? 'Este campo es requerido' 
                          : false 
                      })}
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                      placeholder={watch('attendance_type') === 'CARGO' ? 'Especificar cargo' : 'Especificar otro'}
                    />
                    {errors.cargo_otro && (
                      <p className="text-red-500 text-xs mt-1">{errors.cargo_otro.message}</p>
                    )}
                  </div>
                )}

                {/* Rango de fechas para filtrar participantes */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">
                    Filtro de Participantes por Fecha de Aprobación
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Desde *
                      </label>
                      <input
                        {...register('fecha_inicio', { required: 'La fecha de inicio es requerida' })}
                        type="date"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                      />
                      {errors.fecha_inicio && (
                        <p className="text-red-500 text-xs mt-1">{errors.fecha_inicio.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Hasta *
                      </label>
                      <input
                        {...register('fecha_fin', { required: 'La fecha de fin es requerida' })}
                        type="date"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                      />
                      {errors.fecha_fin && (
                        <p className="text-red-500 text-xs mt-1">{errors.fecha_fin.message}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Solo se incluirán participantes que aprobaron la evaluación en este rango de fechas
                  </p>
                </div>

                {/* Responsable del Registro */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">
                    Responsable del Registro
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Responsable *
                      </label>
                      <select
                        {...register('responsible_id', { required: 'Selecciona un responsable' })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                        onChange={(e) => {
                          const selectedCompany = companies.find(c => c.id === selectedCompanyId)
                          const selectedResponsible = selectedCompany?.responsibles?.find(r => r.id === e.target.value)
                          if (selectedResponsible) {
                            setValue('responsible_name', selectedResponsible.nombre)
                            setValue('responsible_position', selectedResponsible.cargo)
                          }
                        }}
                      >
                        <option value="">Seleccionar responsable</option>
                        {selectedCompanyId && 
                          companies
                            .find(c => c.id === selectedCompanyId)
                            ?.responsibles?.map((responsible) => (
                              <option key={responsible.id} value={responsible.id}>
                                {responsible.nombre} - {responsible.cargo}
                              </option>
                            ))
                        }
                      </select>
                      {errors.responsible_id && (
                        <p className="text-red-500 text-xs mt-1">{errors.responsible_id.message}</p>
                      )}
                      {!selectedCompanyId && (
                        <p className="text-slate-500 text-xs mt-1">Primero selecciona una empresa</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Vista previa
                      </label>
                      <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
                        {watch('responsible_name') && watch('responsible_position') ? (
                          <div>
                            <div><strong>Nombre:</strong> {watch('responsible_name')}</div>
                            <div><strong>Cargo:</strong> {watch('responsible_position')}</div>
                          </div>
                        ) : (
                          'Selecciona un responsable para ver los datos'
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Fecha de la Lista de Asistencia *
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

                  {/* Hidden fields to store the actual name and position */}
                  <input type="hidden" {...register('responsible_name')} />
                  <input type="hidden" {...register('responsible_position')} />
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

                {/* Preview Participants Section */}
                {showPreview && (
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">
                      Vista Previa de Participantes ({previewParticipants.length})
                    </h3>

                    {isLoadingPreview ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
                      </div>
                    ) : previewParticipants.length > 0 ? (
                      <div className="max-h-96 overflow-y-auto border rounded-lg">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-100 sticky top-0">
                            <tr>
                              <th className="p-2 text-left border-b">Apellidos y Nombres</th>
                              <th className="p-2 text-left border-b">DNI</th>
                              <th className="p-2 text-left border-b">Área</th>
                              <th className="p-2 text-left border-b">Fecha Aprobación</th>
                              <th className="p-2 text-center border-b">Firmó</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewParticipants.map((participant) => (
                              <tr key={participant.id} className="border-b hover:bg-slate-50">
                                <td className="p-2">
                                  {participant.users.first_name} {participant.users.last_name}
                                </td>
                                <td className="p-2">{participant.users.dni}</td>
                                <td className="p-2">{participant.users.area || '-'}</td>
                                <td className="p-2">
                                  {new Date(participant.completed_at).toLocaleDateString('es-ES')}
                                </td>
                                <td className="p-2 text-center">
                                  {participant.has_signature ? (
                                    <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                                      ✓ Sí
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                                      ✗ No
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-slate-50 rounded-lg">
                        <p className="text-slate-600">
                          No se encontraron participantes que cumplan los criterios de filtrado.
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                          Verifica que haya participantes que hayan aprobado la evaluación en el rango de fechas seleccionado.
                        </p>
                      </div>
                    )}

                    {previewParticipants.some(p => !p.has_signature) && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-xs text-yellow-800">
                          <strong>⚠️ Advertencia:</strong> Algunos participantes no han firmado aún. Solo se incluirán en la lista los que tengan firma.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false)
                      setPreviewParticipants([])
                      setShowPreview(false)
                      reset()
                    }}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || previewParticipants.filter(p => p.has_signature).length === 0}
                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    title={previewParticipants.filter(p => p.has_signature).length === 0 ? 'No hay participantes con firma para incluir en la lista' : ''}
                  >
                    {isSubmitting ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto"></div>
                    ) : (
                      `Crear Lista (${previewParticipants.filter(p => p.has_signature).length} participantes)`
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
              <div className="grid grid-cols-5 text-xs bg-slate-50">
                <div className="border-r border-slate-400 p-2 text-center font-medium">
                  APELLIDOS Y NOMBRES DE LOS CAPACITADOS
                </div>
                <div className="border-r border-slate-400 p-2 text-center font-medium">
                  Nº DNI
                </div>
                <div className="border-r border-slate-400 p-2 text-center font-medium">
                  ÁREA
                </div>
                <div className="border-r border-slate-400 p-2 text-center font-medium">
                  FECHA
                </div>
                <div className="p-2 text-center font-medium">
                  FIRMA
                </div>
              </div>

              {/* Participant Rows */}
              {attendance.signatures?.length > 0 ? (
                attendance.signatures.map((signature: any, index: number) => (
                  <div key={signature.id} className="grid grid-cols-5 text-xs border-t border-slate-400 min-h-12">
                    <div className="border-r border-slate-400 p-2 flex items-center">
                      {signature.user.first_name} {signature.user.last_name}
                    </div>
                    <div className="border-r border-slate-400 p-2 flex items-center justify-center">
                      {signature.user.dni}
                    </div>
                    <div className="border-r border-slate-400 p-2 flex items-center justify-center">
                      {signature.user.area || '-'}
                    </div>
                    <div className="border-r border-slate-400 p-2 flex items-center justify-center">
                      {new Date(signature.signed_at).toLocaleDateString('es-ES')}
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
                <div className="grid grid-cols-5 text-xs border-t border-slate-400 min-h-12">
                  <div className="border-r border-slate-400 p-2 flex items-center justify-center text-slate-400">
                    No hay participantes registrados
                  </div>
                  <div className="border-r border-slate-400 p-2"></div>
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
                   <div className="mt-1">{attendance.responsible_name || ''}</div>
                </div>
                <div className="border-r border-slate-400 p-2">
                  <div className="font-medium">CARGO:</div>
                   <div className="mt-1">{attendance.responsible_position || ''}</div>
                </div>
                <div className="p-2">
                  <div className="font-medium">FECHA:</div>
                  <div className="mt-1">{attendance.responsible_date ? new Date(attendance.responsible_date).toLocaleDateString('es-ES') : ''}</div>
                  <div className="text-right mt-2">
                    <div className="font-medium">FIRMA:</div>
                  </div>
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