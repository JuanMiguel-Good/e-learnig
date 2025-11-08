import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { PenTool, RotateCcw, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface SignAttendanceProps {
  courseId: string
  evaluationAttemptId?: string
  onComplete: () => void
  onCancel: () => void
}

interface AttendanceList {
  id: string
  course_type: string
  tema: string
  instructor_name: string
  fecha: string
  course: {
    title: string
    hours: number
  }
  company: {
    razon_social: string
    ruc: string
    direccion: string
    distrito: string
    departamento: string
    provincia: string
    actividad_economica: string
    num_trabajadores: number
  }
}

export default function SignAttendance({ courseId, evaluationAttemptId, onComplete, onCancel }: SignAttendanceProps) {
  const { user } = useAuth()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [attendanceList, setAttendanceList] = useState<AttendanceList | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSigning, setIsSigning] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  useEffect(() => {
    if (user && courseId) {
      loadAttendanceList()
    }
  }, [user, courseId])

  const loadAttendanceList = async () => {
    try {
      // Get attendance list for this course and user's company
      let { data, error } = await supabase
        .from('attendance_lists')
        .select(`
          *,
          course:courses!inner(title, hours),
          company:companies!inner(*)
        `)
        .eq('course_id', courseId)
        .eq('company_id', user?.company_id)
        .single()

      // If no attendance list exists, create one automatically
      if (error && error.code === 'PGRST116') {
        // Get course and company data
        const { data: courseData } = await supabase
          .from('courses')
          .select('title, hours, instructor:instructors(id, name)')
          .eq('id', courseId)
          .single()

        if (!courseData) {
          toast.error('No se pudo obtener información del curso')
          onCancel()
          return
        }

        // Create new attendance list
        const { data: newList, error: createError } = await supabase
          .from('attendance_lists')
          .insert({
            course_id: courseId,
            company_id: user?.company_id,
            course_type: 'CAPACITACIÓN',
            tema: courseData.title,
            instructor_name: courseData.instructor?.name || 'Instructor',
            fecha: new Date().toISOString().split('T')[0],
            responsible_name: '',
            responsible_position: '',
            responsible_date: new Date().toISOString().split('T')[0]
          })
          .select(`
            *,
            course:courses!inner(title, hours),
            company:companies!inner(*)
          `)
          .single()

        if (createError) throw createError

        data = newList
      } else if (error) {
        throw error
      }

      setAttendanceList(data)

      // Check if user already signed
      const { data: existingSignature } = await supabase
        .from('attendance_signatures')
        .select('id')
        .eq('attendance_list_id', data.id)
        .eq('user_id', user?.id)
        .maybeSingle()

      if (existingSignature) {
        toast.info('Ya has firmado la lista de asistencia para este curso')
        onComplete()
        return
      }

    } catch (error) {
      console.error('Error loading attendance list:', error)
      toast.error('Error al cargar la lista de asistencia')
      onCancel()
    } finally {
      setIsLoading(false)
    }
  }

  const initCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2 // High DPI
    canvas.height = rect.height * 2
    
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(2, 2) // Scale for high DPI
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }
  }

  useEffect(() => {
    if (!isLoading) {
      setTimeout(initCanvas, 100)
    }
  }, [isLoading])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    setHasSignature(true)
    draw(e)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.beginPath()
    }
  }

  // Touch events for mobile
  const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setIsDrawing(true)
    setHasSignature(true)
    drawTouch(e)
  }

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    e.preventDefault()

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top

    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const stopDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setIsDrawing(false)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.beginPath()
    }
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const saveSignature = async () => {
    if (!hasSignature || !attendanceList || !user) {
      toast.error('Por favor, realiza tu firma antes de continuar')
      return
    }

    try {
      setIsSigning(true)

      // Get signature as base64
      const canvas = canvasRef.current
      if (!canvas) throw new Error('No se pudo capturar la firma')

      const signatureData = canvas.toDataURL('image/png').split(',')[1] // Remove data:image/png;base64,

      // Save signature to database
      const { error } = await supabase
        .from('attendance_signatures')
        .insert([
          {
            attendance_list_id: attendanceList.id,
            user_id: user.id,
            signature_data: signatureData,
            evaluation_attempt_id: evaluationAttemptId || null
          }
        ])

      if (error) throw error

      toast.success('¡Firma guardada exitosamente!')
      onComplete()
    } catch (error) {
      console.error('Error saving signature:', error)
      toast.error('Error al guardar la firma')
    } finally {
      setIsSigning(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    )
  }

  if (!attendanceList) {
    return (
      <div className="text-center py-12">
        <PenTool className="mx-auto h-12 w-12 text-slate-400" />
        <h3 className="mt-2 text-lg font-medium text-slate-900">Lista no disponible</h3>
        <p className="mt-1 text-sm text-slate-500">No se pudo cargar la lista de asistencia.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 text-center">
        <h1 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">
          Firma de Lista de Asistencia
        </h1>
        <h2 className="text-base md:text-lg font-semibold text-slate-600 mb-4">
          {attendanceList.course.title}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
          <div>
            <p><span className="font-medium">Empresa:</span> {attendanceList.company.razon_social}</p>
            <p><span className="font-medium">Tipo:</span> {attendanceList.course_type}</p>
          </div>
          <div>
            <p><span className="font-medium">Instructor:</span> {attendanceList.instructor_name}</p>
            <p><span className="font-medium">Duración:</span> {attendanceList.course.hours} horas</p>
          </div>
        </div>
      </div>

      {/* Signature Section */}
      <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-2">
            Tu Firma Digital
          </h3>
          <p className="text-sm text-slate-600">
            Firma dentro del recuadro para confirmar tu asistencia al curso
          </p>
        </div>

        {/* Signature Canvas */}
        <div className="relative mx-auto max-w-md">
          <canvas
            ref={canvasRef}
            className="w-full h-48 border-2 border-dashed border-slate-300 rounded-lg cursor-crosshair bg-slate-50 touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawingTouch}
            onTouchMove={drawTouch}
            onTouchEnd={stopDrawingTouch}
          />
          
          {/* Canvas Overlay Instructions */}
          {!hasSignature && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-slate-400">
                <PenTool className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Firma aquí</p>
              </div>
            </div>
          )}
        </div>

        {/* Signature Controls */}
        <div className="flex justify-center gap-3 mt-4">
          <button
            onClick={clearSignature}
            className="flex items-center px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors text-sm"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Limpiar
          </button>
        </div>

        {/* Participant Info */}
        <div className="mt-6 p-4 bg-slate-50 rounded-lg">
          <h4 className="font-medium text-slate-800 mb-2">Información del Participante:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <p><span className="font-medium">Nombre:</span> {user?.first_name} {user?.last_name}</p>
            <p><span className="font-medium">DNI:</span> {user?.dni || 'No especificado'}</p>
            <p><span className="font-medium">Email:</span> {user?.email}</p>
            <p><span className="font-medium">Empresa:</span> {attendanceList.company.razon_social}</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onCancel}
          className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors flex items-center justify-center"
        >
          <X className="w-4 h-4 mr-2" />
          Cancelar
        </button>
        
        <button
          onClick={saveSignature}
          disabled={!hasSignature || isSigning}
          className="px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isSigning ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          {isSigning ? 'Guardando...' : 'Confirmar Firma'}
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">📋 Instrucciones:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Firma con tu dedo o stylus si usas dispositivo móvil</li>
          <li>• Usa el mouse si estás en computadora</li>
          <li>• Asegúrate que tu firma sea legible</li>
          <li>• Puedes limpiar y volver a firmar si es necesario</li>
          <li>• Una vez confirmada, no podrás modificar tu firma</li>
        </ul>
      </div>
    </div>
  )
}