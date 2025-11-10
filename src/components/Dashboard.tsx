import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Users, BookOpen, Award, TrendingUp, User, GraduationCap, AlertCircle, CheckCircle, Clock } from 'lucide-react'

interface DashboardStats {
  totalParticipants: number
  totalCourses: number
  totalCertificates: number
  completionRate: number
  totalAssignments: number
  inProgress: number
  completed: number
  inactiveParticipants: number
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalParticipants: 0,
    totalCourses: 0,
    totalCertificates: 0,
    completionRate: 0,
    totalAssignments: 0,
    inProgress: 0,
    completed: 0,
    inactiveParticipants: 0
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      // Total participantes
      const { count: participantsCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'participant')

      // Total cursos
      const { count: coursesCount } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })

      // Total certificados
      const { count: certificatesCount } = await supabase
        .from('certificates')
        .select('*', { count: 'exact', head: true })

      // Estadísticas de asignaciones
      const { data: assignments } = await supabase
        .from('course_assignments')
        .select('user_id, course_id, status, last_activity_at')

      const totalAssignments = assignments?.length || 0
      const inProgress = assignments?.filter(a =>
        ['in_progress', 'lessons_completed', 'evaluation_pending', 'signature_pending'].includes(a.status)
      ).length || 0
      const completed = assignments?.filter(a =>
        ['completed', 'certificate_generated'].includes(a.status)
      ).length || 0

      // Participantes inactivos (más de 15 días)
      const inactiveParticipants = assignments?.filter(a => {
        if (!a.last_activity_at) return false
        const daysSinceActivity = Math.floor(
          (Date.now() - new Date(a.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
        )
        return daysSinceActivity >= 15 && !['completed', 'certificate_generated'].includes(a.status)
      }).length || 0

      // Calcular tasa de finalización promedio
      let totalProgress = 0
      if (assignments && assignments.length > 0) {
        for (const assignment of assignments) {
          const { data } = await supabase
            .rpc('calculate_course_progress', {
              user_id_param: assignment.user_id,
              course_id_param: assignment.course_id
            })
          totalProgress += data || 0
        }
      }

      const avgCompletionRate = assignments?.length
        ? Math.round(totalProgress / assignments.length)
        : 0

      setStats({
        totalParticipants: participantsCount || 0,
        totalCourses: coursesCount || 0,
        totalCertificates: certificatesCount || 0,
        completionRate: avgCompletionRate,
        totalAssignments,
        inProgress,
        completed,
        inactiveParticipants
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setIsLoading(false)
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
      <div className="bg-white rounded-xl shadow-sm p-6 border">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-800 rounded-xl flex items-center justify-center">
            <User className="w-6 h-6 md:w-8 md:h-8 text-white" />
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-bold text-slate-800">
              ¡Bienvenido, {user?.first_name}!
            </h1>
            <p className="text-sm md:text-base text-slate-600">
              {user?.role === 'admin' ? 'Panel de Administración' : 'Mi Panel de Aprendizaje'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {user?.role === 'admin' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            {/* Total Participantes */}
            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border">
              <div className="flex items-center">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                </div>
                <div className="ml-2 md:ml-4">
                  <p className="text-lg md:text-2xl font-bold text-slate-800">{stats.totalParticipants}</p>
                  <p className="text-xs md:text-sm text-slate-600">Participantes</p>
                </div>
              </div>
            </div>

            {/* Total Cursos */}
            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border">
              <div className="flex items-center">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                </div>
                <div className="ml-2 md:ml-4">
                  <p className="text-lg md:text-2xl font-bold text-slate-800">{stats.totalCourses}</p>
                  <p className="text-xs md:text-sm text-slate-600">Cursos</p>
                </div>
              </div>
            </div>

            {/* Total Certificados */}
            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border">
              <div className="flex items-center">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Award className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
                </div>
                <div className="ml-2 md:ml-4">
                  <p className="text-lg md:text-2xl font-bold text-slate-800">{stats.totalCertificates}</p>
                  <p className="text-xs md:text-sm text-slate-600">Certificados</p>
                </div>
              </div>
            </div>

            {/* Tasa de Finalización */}
            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border">
              <div className="flex items-center">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                </div>
                <div className="ml-2 md:ml-4">
                  <p className="text-lg md:text-2xl font-bold text-slate-800">{stats.completionRate}%</p>
                  <p className="text-xs md:text-sm text-slate-600">Finalización</p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Overview Section */}
          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Resumen de Progreso</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{stats.totalAssignments}</p>
                  <p className="text-sm text-slate-600">Total Asignaciones</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
                  <p className="text-sm text-slate-600">En Progreso</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                  <p className="text-sm text-slate-600">Completados</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{stats.inactiveParticipants}</p>
                  <p className="text-sm text-slate-600">Inactivos +15 días</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Quick Actions for Participants */}
      {user?.role === 'participant' && (
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border">
          <h2 className="text-base md:text-lg font-semibold text-slate-800 mb-3 md:mb-4 flex items-center">
            <GraduationCap className="w-4 h-4 md:w-5 md:h-5 mr-2" />
            Resumen de Progreso
          </h2>
          <p className="text-sm md:text-base text-slate-600">
            Continúa con tus cursos asignados para completar tu formación y obtener certificados.
          </p>
        </div>
      )}
    </div>
  )
}