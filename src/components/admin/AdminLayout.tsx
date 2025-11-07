import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Users, BookOpen, GraduationCap, BarChart3, UserCheck, Building2, UserCog } from 'lucide-react'

export default function AdminLayout() {
  const navItems = [
    {
      to: '/admin',
      icon: BarChart3,
      label: 'Dashboard',
      end: true
    },
    {
      to: '/admin/participants',
      icon: Users,
      label: 'Participantes'
    },
    {
      to: '/admin/instructors',
      icon: UserCheck,
      label: 'Instructores'
    },
    {
      to: '/admin/courses',
      icon: BookOpen,
      label: 'Cursos'
    },
    {
      to: '/admin/assignments',
      icon: GraduationCap,
      label: 'Asignaciones'
    },
    {
      to: '/admin/companies',
      icon: Building2,
      label: 'Empresas'
    },
    {
      to: '/admin/company-responsibles',
      icon: UserCog,
      label: 'Responsables'
    }
  ]

  return (
    <div className="flex flex-col lg:flex-row lg:space-x-6 space-y-4 lg:space-y-0">
      {/* Sidebar */}
      <div className="w-full lg:w-64 bg-white rounded-xl shadow-sm border p-4 lg:p-6 sidebar-desktop">
        <h2 className="text-base lg:text-lg font-semibold text-slate-800 mb-4 lg:mb-6">Administración</h2>
        <nav className="flex lg:flex-col space-x-2 lg:space-x-0 lg:space-y-2 overflow-x-auto lg:overflow-x-visible">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center px-2 lg:px-3 py-2 rounded-lg text-xs lg:text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                }`
              }
            >
              <item.icon className="w-4 h-4 lg:w-5 lg:h-5 mr-1 lg:mr-3" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden bg-white rounded-xl shadow-sm border p-4">
        <nav className="flex space-x-2 overflow-x-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                }`
              }
            >
              <item.icon className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  )
}