import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { User, BookOpen, Users, GraduationCap, FileText, Building2 } from 'lucide-react'
import { NavLink } from 'react-router-dom'

export default function Dashboard() {
  const { user } = useAuth()

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
              Panel de Administración
            </p>
          </div>
        </div>
      </div>

      {/* Welcome Message */}
      <div className="bg-white rounded-xl shadow-sm p-6 border">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Gestión de Plataforma</h2>
        <p className="text-slate-600 mb-4">
          Utiliza el menú lateral para acceder a las diferentes secciones de administración.
        </p>
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <NavLink
          to="/admin/participants"
          className="bg-white rounded-xl shadow-sm p-6 border hover:border-slate-300 hover:shadow-md transition-all"
        >
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 mb-1">Participantes</h3>
              <p className="text-sm text-slate-600">Gestiona los participantes de la plataforma</p>
            </div>
          </div>
        </NavLink>

        <NavLink
          to="/admin/courses"
          className="bg-white rounded-xl shadow-sm p-6 border hover:border-slate-300 hover:shadow-md transition-all"
        >
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 mb-1">Cursos</h3>
              <p className="text-sm text-slate-600">Administra el contenido de los cursos</p>
            </div>
          </div>
        </NavLink>

        <NavLink
          to="/admin/assignments"
          className="bg-white rounded-xl shadow-sm p-6 border hover:border-slate-300 hover:shadow-md transition-all"
        >
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 mb-1">Asignaciones</h3>
              <p className="text-sm text-slate-600">Asigna cursos a participantes</p>
            </div>
          </div>
        </NavLink>

        <NavLink
          to="/admin/companies"
          className="bg-white rounded-xl shadow-sm p-6 border hover:border-slate-300 hover:shadow-md transition-all"
        >
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 mb-1">Empresas</h3>
              <p className="text-sm text-slate-600">Gestiona las empresas registradas</p>
            </div>
          </div>
        </NavLink>

        <NavLink
          to="/admin/attendance"
          className="bg-white rounded-xl shadow-sm p-6 border hover:border-slate-300 hover:shadow-md transition-all"
        >
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-sky-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-sky-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 mb-1">Asistencia</h3>
              <p className="text-sm text-slate-600">Gestiona las listas de asistencia</p>
            </div>
          </div>
        </NavLink>

        <NavLink
          to="/admin/reports"
          className="bg-white rounded-xl shadow-sm p-6 border hover:border-slate-300 hover:shadow-md transition-all"
        >
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 mb-1">Reportes</h3>
              <p className="text-sm text-slate-600">Genera reportes y estadísticas</p>
            </div>
          </div>
        </NavLink>
      </div>
    </div>
  )
}