import { AttendancePDFGenerator } from '../../lib/attendancePDFGenerator'
import { ExcelAttendanceExporter } from '../../lib/excelAttendanceExporter'
import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, FileText, Download, Eye, Trash2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { useAuth } from '../../contexts/AuthContext'

interface Course {
  id: string
  title: string
  hours: number
  activity_type: 'full_course' | 'topic' | 'attendance_only'
  instructor: {
    id: string
    name: string
    signature_url: string | null
  }
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
  participantCount?: number
}

interface AttendanceFormData {
  course_id: string
  attendance_type: 'INDUCCIÓN' | 'CAPACITACIÓN' | 'ENTRENAMIENTO' | 'SIMULACRO DE EMERGENCIA' | 'CHARLA 5 MINUTOS' | 'REUNIÓN' | 'CARGO' | 'OTRO'
  cargo_otro: string
  tema: string
  fecha: string
  fecha_inicio: string
  fecha_fin: string
  responsible_name: string
  responsible_position: string
}

export default function CompanyAttendanceManagement() {
  const { user } = useAuth()
  const [attendanceLists, setAttendanceLists] = useState<AttendanceList[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [companyName, setCompanyName] = useState('')
  const [responsibles, setResponsibles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
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
      fecha_inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      fecha_fin: new Date().toISOString().split('T')[0]
    }
  })

  const selectedCourseId = watch('course_id')
  const fechaInicio = watch('fecha_inicio')
  const fechaFin = watch('fecha_fin')

  useEffect(() => {
    if (user?.company_id) {
      loadData()
    }
  }, [user?.company_id])

  useEffect(() => {
    if (selectedCourseId && fechaInicio && fechaFin && user?.company_id) {
      loadPreviewParticipants()
    } else {
      setPreviewParticipants([])
      setShowPreview(false)
    }
  }, [selectedCourseId, fechaInicio, fechaFin])

  const loadPreviewParticipants = async () => {
    if (!selectedCourseId || !fechaInicio || !fechaFin || !user?.company_id) return

    try {
      setIsLoadingPreview(true)

      const selectedCourse = courses.find(c => c.id === selectedCourseId)
      if (!selectedCourse) {
        setPreviewParticipants([])
        setShowPreview(false)
        return
      }

      let participantsWithSignatures: any[] = []

      if (selectedCourse.activity_type === 'attendance_only') {
        const { data: signaturesData, error: signaturesError } = await supabase
          .from('attendance_signatures')
          .select(`
            id,
            user_id,
            signature_data,
            signed_at,
            users!inner(
              id,
              first_name,
              last_name,
              dni,
              area,
              company_id
            )
          `)
          .eq('course_id', selectedCourseId)
          .eq('users.company_id', user.company_id)
          .gte('signed_at', fechaInicio)
          .lte('signed_at', fechaFin + 'T23:59:59')
          .is('evaluation_attempt_id', null)

        if (signaturesError) throw signaturesError

        participantsWithSignatures = (signaturesData || []).map((signature: any) => ({
          id: signature.id,
          user_id: signature.user_id,
          completed_at: signature.signed_at,
          users: signature.users,
          has_signature: true,
          signature: {
            id: signature.id,
            signature_data: signature.signature_data,
            signed_at: signature.signed_at
          }
        }))
      } else {
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
          .eq('users.company_id', user.company_id)
          .gte('completed_at', fechaInicio)
          .lte('completed_at', fechaFin + 'T23:59:59')
          .eq('evaluation.course_id', selectedCourseId)

        if (participantsError) throw participantsError

        participantsWithSignatures = await Promise.all(
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
      }

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
    if (!user?.company_id) {
      toast.error('No tienes una empresa asignada')
      setIsLoading(false)
      return
    }

    try {
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_lists')
        .select(`
          *,
          course:courses!inner(title, hours),
          company:companies!inner(razon_social)
        `)
        .eq('company_id', user.company_id)
        .order('created_at', { ascending: false })

      if (attendanceError) throw attendanceError

      const listsWithCounts = await Promise.all(
        (attendanceData || []).map(async (list: any) => {
          const signatures = await getFilteredSignatures(list)
          return {
            ...list,
            participantCount: signatures.length
          }
        })
      )

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('course_assignments')
        .select(`
          course_id,
          courses!inner(
            id,
            title,
            hours,
            activity_type,
            is_active,
            instructor:instructors!inner(id, name, signature_url)
          ),
          users!inner(id, company_id, role)
        `)
        .eq('users.company_id', user.company_id)
        .eq('users.role', 'participant')
        .eq('courses.is_active', true)

      if (assignmentsError) throw assignmentsError

      const uniqueCoursesMap = new Map<string, Course>()
      assignmentsData?.forEach((assignment: any) => {
        const course = assignment.courses
        if (!uniqueCoursesMap.has(course.id)) {
          uniqueCoursesMap.set(course.id, {
            id: course.id,
            title: course.title,
            hours: course.hours,
            activity_type: course.activity_type,
            instructor: course.instructor
          })
        }
      })

      const coursesData = Array.from(uniqueCoursesMap.values()).sort((a, b) =>
        a.title.localeCompare(b.title)
      )

      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('razon_social, responsibles:company_responsibles(id, nombre, cargo, signature_url)')
        .eq('id', user.company_id)
        .single()

      if (companyError) throw companyError

      setAttendanceLists(listsWithCounts)
      setCourses(coursesData || [])
      setCompanyName(companyData?.razon_social || '')
      setResponsibles(companyData?.responsibles || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async (data: AttendanceFormData) => {
    if (!user?.company_id) {
      toast.error('No tienes una empresa asignada')
      return
    }

    try {
      const selectedCourse = courses.find(c => c.id === data.course_id)
      if (!selectedCourse) throw new Error('Curso no encontrado')

      const { data: newList, error: insertError } = await supabase
        .from('attendance_lists')
        .insert([
          {
            course_id: data.course_id,
            company_id: user.company_id,
            course_type: data.attendance_type,
            attendance_type: data.attendance_type,
            charla_5_minutos: data.attendance_type === 'CHARLA 5 MINUTOS',
            reunion: data.attendance_type === 'REUNIÓN',
            cargo_otro: data.cargo_otro || null,
            tema: data.tema || selectedCourse.title,
            instructor_name: selectedCourse.instructor.name,
            fecha: new Date(data.fecha + 'T12:00:00').toISOString(),
            responsible_name: data.responsible_name,
            responsible_position: data.responsible_position,
            responsible_date: new Date(data.fecha + 'T12:00:00').toISOString(),
            date_range_start: new Date(data.fecha_inicio + 'T00:00:00').toISOString(),
            date_range_end: new Date(data.fecha_fin + 'T23:59:59').toISOString()
          }
        ])
        .select()
        .single()

      if (insertError) throw insertError

      toast.success('Lista de asistencia creada correctamente')
      await loadData()
      setIsModalOpen(false)
      setPreviewParticipants([])
      setShowPreview(false)
      reset()
    } catch (error: any) {
      console.error('Error creating attendance list:', error)
      toast.error(error.message || 'Error al crear lista de asistencia')
    }
  }

  const handleDelete = async (attendance: AttendanceList) => {
    if (!confirm(`¿Estás seguro de eliminar esta lista de asistencia?`)) return

    try {
      const { error: deleteError } = await supabase
        .from('attendance_lists')
        .delete()
        .eq('id', attendance.id)

      if (deleteError) throw deleteError

      toast.success('Lista eliminada correctamente')
      await loadData()
    } catch (error) {
      console.error('Error deleting attendance:', error)
      toast.error('Error al eliminar lista')
    }
  }

  const getFilteredSignatures = async (attendanceList: any) => {
    if (attendanceList.date_range_start && attendanceList.date_range_end) {
      const startDate = attendanceList.date_range_start.split('T')[0]
      const endDateOnly = attendanceList.date_range_end.split('T')[0]
      const endDate = `${endDateOnly}T23:59:59.999Z`

      const { data: courseData } = await supabase
        .from('courses')
        .select('activity_type')
        .eq('id', attendanceList.course_id)
        .single()

      if (courseData && courseData.activity_type === 'attendance_only') {
        const { data: signaturesData } = await supabase
          .from('attendance_signatures')
          .select(`
            id,
            signature_data,
            signed_at,
            user:users!inner(first_name, last_name, dni, area, company_id)
          `)
          .eq('course_id', attendanceList.course_id)
          .eq('users.company_id', attendanceList.company_id)
          .gte('signed_at', startDate)
          .lte('signed_at', endDate)
          .is('evaluation_attempt_id', null)
          .order('signed_at')

        return signaturesData || []
      } else {
        const { data: evaluationData } = await supabase
          .from('evaluations')
          .select('id')
          .eq('course_id', attendanceList.course_id)
          .maybeSingle()

        if (!evaluationData) return []

        const { data: attemptsData } = await supabase
          .from('evaluation_attempts')
          .select(`
            id,
            completed_at,
            user:users!inner(
              id,
              first_name,
              last_name,
              dni,
              area,
              company_id
            )
          `)
          .eq('evaluation_id', evaluationData.id)
          .eq('passed', true)
          .eq('user.company_id', attendanceList.company_id)
          .gte('completed_at', startDate)
          .lte('completed_at', endDate)

        const participantsWithSignatures = await Promise.all(
          (attemptsData || []).map(async (attempt: any) => {
            const { data: signatureData } = await supabase
              .from('attendance_signatures')
              .select('id, signature_data, signed_at')
              .eq('evaluation_attempt_id', attempt.id)
              .maybeSingle()

            return {
              ...attempt,
              signature_data: signatureData?.signature_data,
              signed_at: signatureData?.signed_at || attempt.completed_at
            }
          })
        )

        return participantsWithSignatures
      }
    }
    return []
  }

  const handleDownload = async (attendance: AttendanceList, format: 'pdf' | 'excel') => {
    try {
      toast.loading('Generando archivo...')

      const signatures = await getFilteredSignatures(attendance)

      if (!user?.company_id) {
        toast.error('No tienes una empresa asignada')
        return
      }

      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', user.company_id)
        .single()

      if (companyError || !companyData) {
        toast.error('Error al cargar datos de la empresa')
        return
      }

      if (format === 'pdf') {
        await AttendancePDFGenerator.generate(attendance, signatures, companyData)
        toast.success('PDF generado correctamente')
      } else {
        await ExcelAttendanceExporter.exportAttendance(attendance, signatures, companyData)
        toast.success('Excel generado correctamente')
      }
    } catch (error) {
      console.error('Error generating file:', error)
      toast.error('Error al generar archivo')
    } finally {
      toast.dismiss()
    }
  }

  const filteredLists = attendanceLists.filter(list => {
    if (searchTerm === '') return true
    return list.course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           list.tema?.toLowerCase().includes(searchTerm.toLowerCase())
  })

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Listas de Asistencia</h1>
          <p className="text-slate-600">Gestiona las listas de asistencia de {companyName}</p>
        </div>
        <button
          onClick={() => {
            reset()
            setIsModalOpen(true)
          }}
          className="inline-flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nueva Lista
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por curso o tema..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredLists.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              {searchTerm ? 'No se encontraron listas' : 'No hay listas de asistencia'}
            </h3>
            <p className="text-slate-600">
              {searchTerm ? 'Intenta con otro término de búsqueda' : 'Crea tu primera lista de asistencia'}
            </p>
          </div>
        ) : (
          filteredLists.map((list) => (
            <div key={list.id} className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{list.course.title}</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {list.tema || 'Sin tema específico'}
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
                    Tipo: {list.course_type} • Fecha: {new Date(list.fecha).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-slate-500">
                    Instructor: {list.instructor_name} • Participantes: {list.participantCount || 0}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload(list, 'pdf')}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Descargar PDF"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDownload(list, 'excel')}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Descargar Excel"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(list)}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-6">Nueva Lista de Asistencia</h2>

              <form onSubmit={handleSubmit(handleCreate)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Curso *
                    </label>
                    <select
                      {...register('course_id', { required: 'El curso es requerido' })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    >
                      <option value="">Seleccionar curso</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                    {errors.course_id && (
                      <p className="mt-1 text-sm text-red-600">{errors.course_id.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Tipo de Actividad *
                    </label>
                    <select
                      {...register('attendance_type', { required: 'El tipo es requerido' })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    >
                      <option value="INDUCCIÓN">Inducción</option>
                      <option value="CAPACITACIÓN">Capacitación</option>
                      <option value="ENTRENAMIENTO">Entrenamiento</option>
                      <option value="SIMULACRO DE EMERGENCIA">Simulacro de Emergencia</option>
                      <option value="CHARLA 5 MINUTOS">Charla 5 Minutos</option>
                      <option value="REUNIÓN">Reunión</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tema (opcional)
                  </label>
                  <input
                    type="text"
                    {...register('tema')}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    placeholder="Dejar en blanco para usar título del curso"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Fecha *
                    </label>
                    <input
                      type="date"
                      {...register('fecha', { required: 'La fecha es requerida' })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Rango Inicio *
                    </label>
                    <input
                      type="date"
                      {...register('fecha_inicio', { required: 'Fecha inicio requerida' })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Rango Fin *
                    </label>
                    <input
                      type="date"
                      {...register('fecha_fin', { required: 'Fecha fin requerida' })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nombre del Responsable *
                    </label>
                    <input
                      type="text"
                      {...register('responsible_name', { required: 'Nombre requerido' })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Cargo del Responsable *
                    </label>
                    <input
                      type="text"
                      {...register('responsible_position', { required: 'Cargo requerido' })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    />
                  </div>
                </div>

                {showPreview && (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-medium text-slate-800 mb-2">
                      Participantes encontrados: {previewParticipants.length}
                    </h4>
                    {isLoadingPreview ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-800 mx-auto"></div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600">
                        Se generará una lista con {previewParticipants.length} participantes
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false)
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
                    {isSubmitting ? 'Creando...' : 'Crear Lista'}
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
