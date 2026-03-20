import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BookOpen, Award, Users, FileText, ClipboardCheck, Building2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function CompanyManagerLayout() {
  const { user } = useAuth()

  const menuSections = [
    {
      id: 'aprendizaje',
      title: 'Mi Aprendizaje',
      items: [
        {
          to: '/company-manager',
          icon: BookOpen,
          label: 'Mis Cursos',
          end: true
        },
        {
          to: '/company-manager/certificates',
          icon: Award,
          label: 'Certificados'
        }
      ]
    },
    {
      id: 'gestion',
      title: 'Gestión de Empresa',
      items: [
        {
          to: '/company-manager/participants',
          icon: Users,
          label: 'Participantes'
        },
        {
          to: '/company-manager/attendance',
          icon: FileText,
          label: 'Asistencia'
        },
        {
          to: '/company-manager/reports',
          icon: ClipboardCheck,
          label: 'Reportes'
        }
      ]
    }
  ]

  const flatNavItems = menuSections.flatMap(section => section.items)

  return (
    <div className="flex flex-col lg:flex-row lg:space-x-4 space-y-4 lg:space-y-0">
      {/* Sidebar Desktop */}
      <div className="hidden lg:block w-64 flex-shrink-0 bg-white rounded-xl shadow-sm border p-5">
        <div className="mb-6">
          <div className="flex items-center mb-2">
            <Building2 className="w-5 h-5 text-slate-600 mr-2" />
            <h2 className="text-lg font-semibold text-slate-800">Gestor de Empresa</h2>
          </div>
          {user?.company_id && (
            <p className="text-xs text-slate-500 ml-7">Administrando mi empresa</p>
          )}
        </div>

        <nav className="space-y-1">
          {menuSections.map((section, sectionIndex) => (
            <div key={section.id}>
              {sectionIndex > 0 && (
                <div className="my-3 border-t border-slate-200" />
              )}
              <div className="mb-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3">
                  {section.title}
                </h3>
              </div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden bg-white rounded-xl shadow-sm border p-4">
        <nav className="flex space-x-2 overflow-x-auto">
          {flatNavItems.map((item) => (
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
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
