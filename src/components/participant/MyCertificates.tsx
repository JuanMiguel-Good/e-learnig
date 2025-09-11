import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Award, Download, Calendar, User } from 'lucide-react'
import toast from 'react-hot-toast'

interface Certificate {
  id: string
  course_id: string
  completion_date: string
  certificate_url: string | null
  course: {
    title: string
    image_url: string | null
    instructor: {
      name: string
      signature_url: string | null
    }
  }
}

export default function MyCertificates() {
  const { user } = useAuth()
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadCertificates()
    }
  }, [user])

  const loadCertificates = async () => {
    try {
      const { data, error } = await supabase
        .from('certificates')
        .select(`
          *,
          course:courses!inner (
            title,
            image_url,
            instructor:instructors (
              name,
              signature_url
            )
          )
        `)
        .eq('user_id', user?.id)
        .order('completion_date', { ascending: false })

      if (error) throw error
      setCertificates(data || [])
    } catch (error) {
      console.error('Error loading certificates:', error)
      toast.error('Error al cargar certificados')
    } finally {
      setIsLoading(false)
    }
  }

  const downloadCertificate = async (certificate: Certificate) => {
    try {
      if (certificate.certificate_url) {
        // Open certificate in new window
        window.open(certificate.certificate_url, '_blank')
      } else {
        toast.error('Certificado no disponible')
      }
    } catch (error) {
      console.error('Error downloading certificate:', error)
      toast.error('Error al descargar certificado')
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
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Mis Certificados</h1>
        <p className="text-slate-600">Descarga y comparte tus certificados de finalización</p>
      </div>

      {/* Certificates List */}
      <div className="space-y-4">
        {certificates.map((certificate) => (
          <div key={certificate.id} className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Certificate Info */}
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <Award className="w-5 h-5 text-yellow-600 mr-2" />
                  <h3 className="text-lg font-semibold text-slate-800">Certificado de Finalización</h3>
                </div>

                <p className="text-slate-800 font-medium text-lg mb-3">{certificate.course.title}</p>
                
                <div className="flex flex-col space-y-1 text-sm text-slate-600">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>Completado el {new Date(certificate.completion_date).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long', 
                      day: 'numeric'
                    })}</span>
                  </div>
                  
                  {certificate.course.instructor && (
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-2" />
                      <span>Instructor: {certificate.course.instructor.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Download Button */}
              <div className="flex-shrink-0">
                <button
                  onClick={() => downloadCertificate(certificate)}
                  className="w-full md:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors flex items-center justify-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {certificates.length === 0 && (
        <div className="text-center py-12">
          <Award className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">No tienes certificados</h3>
          <p className="mt-1 text-sm text-slate-500">Completa cursos para obtener certificados.</p>
        </div>
      )}
    </div>
  )
}