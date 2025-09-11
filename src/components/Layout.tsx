import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, User, BookOpen } from 'lucide-react'
import toast from 'react-hot-toast'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Sesión cerrada correctamente')
    } catch (error) {
      toast.error('Error al cerrar sesión')
    }
  }

  if (!user) {
    return <>{children}</>
  }

  return (
    <>
      {/* Desktop Layout */}
      <div className="min-h-screen bg-gray-50 overflow-x-hidden lg:block hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="container-responsive">
            <div className="flex justify-between items-center h-14 md:h-16">
              {/* Logo */}
              <div className="flex items-center space-x-2 md:space-x-3">
                <img 
                  src="/logo horizontal copy.png" 
                  alt="Good Solutions Logo" 
                  className="h-8 md:h-10 w-auto"
                />
                <div className="hidden sm:block">
                  <p className="text-xs md:text-sm text-slate-500">e-Learning</p>
                </div>
              </div>

              {/* User Menu */}
              <div className="flex items-center space-x-2 md:space-x-4">
                <div className="flex items-center space-x-1 md:space-x-2">
                  <User className="w-4 h-4 md:w-5 md:h-5 text-slate-600" />
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-slate-800">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-xs text-slate-500 capitalize">{user.role}</p>
                  </div>
                  <div className="text-right sm:hidden">
                    <p className="text-xs font-medium text-slate-800">
                      {user.first_name}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center px-3 py-1 text-sm rounded-md text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Cerrar Sesión</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container-responsive py-4 md:py-6">
          {children}
        </main>
      </div>
      
      {/* Mobile Layout */}
      <div className="lg:hidden mobile-scroll-container no-scrollbar bg-gray-50">
        {/* Mobile Header - Fixed */}
        <header className="bg-white shadow-sm border-b sticky top-0 z-50">
          <div className="px-4">
            <div className="flex justify-between items-center h-14">
              {/* Logo */}
              <div className="flex items-center space-x-2">
                <img 
                  src="/logo horizontal copy.png" 
                  alt="Good Solutions Logo" 
                  className="h-8 w-auto"
                />
              </div>

              {/* User Menu */}
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <User className="w-4 h-4 text-slate-600" />
                  <div>
                    <p className="text-xs font-medium text-slate-800">
                      {user.first_name}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center px-2 py-1 text-xs rounded-md text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Main Content */}
        <main className="px-4 py-4 mobile-no-overflow">
          {children}
        </main>
      </div>
    </>
  )
}