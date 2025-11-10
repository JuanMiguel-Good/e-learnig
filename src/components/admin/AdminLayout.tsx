import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Users, BookOpen, GraduationCap, BarChart3, UserCheck, Building2, UserCog, HelpCircle, FileText, ClipboardCheck } from 'lucide-react'

export default function AdminLayout() {
  const menuSections = [
    {
      id: 'general',
      items: [
        {
          to: '/admin',
          icon: BarChart3,
          label: 'Dashboard',
          end: true
        }
      ]
    },
    {
      id: 'personas',
      items: [
        {
          to: '/admin/participants',
          icon: Users,
          label: 'Participantes'
        },
        {
          to: '/admin/instructors',
          icon: UserCheck,
          label: 'Instructores'
        }
      ]
    },
    {
      id: 'empresas',
      items: [
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
    },
    {
      id: 'capacitacion',
      items: [
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
          to: '/admin/evaluations',
          icon: HelpCircle,
          label: 'Evaluaciones'
        }
      ]
    },
    {
      id: 'seguimiento',
      items: [
        {
          to: '/admin/attendance',
          icon: FileText,
          label: 'Asistencia'
        },
        {
          to: '/admin/reports',
          icon: ClipboardCheck,
          label: 'Reportes'
        }
      ]
    }
  ]

  const flatNavItems = menuSections.flatMap(section => section.items)

  return (
    <div className="flex flex-col lg:flex-row lg:space-x-6 space-y-4 lg:space-y-0">
      {/* Sidebar Desktop */}
      <div className="hidden lg:block w-64 bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-6">Administración</h2>
        <nav className="space-y-1">
          {menuSections.map((section, sectionIndex) => (
            <div key={section.id}>
              {sectionIndex > 0 && (
                <div className="my-3 border-t border-slate-200" />
              )}
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
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  )
}