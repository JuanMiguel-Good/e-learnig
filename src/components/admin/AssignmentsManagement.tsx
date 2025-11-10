import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, User, BookOpen, X, Search, Users } from 'lucide-react'
import toast from 'react-hot-toast'

interface Participant {
  id: string
  first_name: string
  last_name: string
  email: string
  company_id: string | null
  company_name: string | null
}

interface Company {
  id: string
  name: string
}

interface Course {
  id: string
  title: string
  image_url: string | null
}

interface Assignment {
  id: string
  user_id: string
  course_id: string
  assigned_at: string
  user: {
    first_name: string
    last_name: string
    email: string
  }
  course: {
    title: string
    image_url: string | null
  }
}

export default function AssignmentsManagement() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [participantsWithCourses, setParticipantsWithCourses] = useState<Map<string, number>>(new Map())
  const [courses, setCourses] = useState<Course[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState('')
  const [selectedCourse, setSelectedCourse] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [bulkCourse, setBulkCourse] = useState('')
  const [assignToAll, setAssignToAll] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<string>('all')
  const [bulkSearchTerm, setBulkSearchTerm] = useState('')

  useEffect(() => {
    loadData()
    loadParticipantCourseCount()
  }, [])

  const loadData = async () => {
    try {
      // Load assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('course_assignments')
        .select(`
          *,
          user:users!inner(first_name, last_name, email),
          course:courses!inner(title, image_url)
        `)
        .order('assigned_at', { ascending: false })

      if (assignmentsError) throw assignmentsError

      // Load companies first
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name')
        .order('name')

      if (companiesError) throw companiesError

      // Create a map for quick company lookup
      const companiesMap = new Map(companiesData?.map(c => [c.id, c.name]) || [])

      // Load participants
      const { data: participantsData, error: participantsError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, company_id')
        .eq('role', 'participant')
        .order('first_name')

      if (participantsError) throw participantsError

      // Load courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, title, image_url')
        .eq('is_active', true)
        .order('title')

      if (coursesError) throw coursesError

      setAssignments(assignmentsData || [])
      setParticipants(participantsData?.map(p => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        company_id: p.company_id,
        company_name: p.company_id ? companiesMap.get(p.company_id) || null : null
      })) || [])
      setCourses(coursesData || [])
      setCompanies(companiesData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setIsLoading(false)
    }
  }

  const loadParticipantCourseCount = async () => {
    try {
      const { data, error } = await supabase
        .from('course_assignments')
        .select('user_id')

      if (error) throw error

      const courseCount = new Map<string, number>()
      data?.forEach(assignment => {
        const current = courseCount.get(assignment.user_id) || 0
        courseCount.set(assignment.user_id, current + 1)
      })

      setParticipantsWithCourses(courseCount)
    } catch (error) {
      console.error('Error loading participant course counts:', error)
    }
  }
  const handleAssignCourse = async () => {
    if (!selectedParticipant || !selectedCourse) {
      toast.error('Selecciona un participante y un curso')
      return
    }

    try {
      setIsSubmitting(true)

      // Check if assignment already exists
      const { data: existing } = await supabase
        .from('course_assignments')
        .select('id')
        .eq('user_id', selectedParticipant)
        .eq('course_id', selectedCourse)
        .maybeSingle()

      if (existing) {
        toast.error('Este participante ya tiene asignado este curso')
        return
      }

      const { error } = await supabase
        .from('course_assignments')
        .insert([
          {
            user_id: selectedParticipant,
            course_id: selectedCourse
          }
        ])

      if (error) throw error
      
      toast.success('Curso asignado correctamente')
      await loadData()
      setIsModalOpen(false)
      setSelectedParticipant('')
      setSelectedCourse('')
    } catch (error) {
      console.error('Error assigning course:', error)
      toast.error('Error al asignar curso')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveAssignment = async (assignment: Assignment) => {
    if (!confirm(`¿Remover la asignación de "${assignment.course.title}" para ${assignment.user.first_name} ${assignment.user.last_name}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('course_assignments')
        .delete()
        .eq('id', assignment.id)

      if (error) throw error
      
      toast.success('Asignación removida correctamente')
      await loadData()
    } catch (error) {
      console.error('Error removing assignment:', error)
      toast.error('Error al remover asignación')
    }
  }

  const handleBulkAssign = async () => {
    const participantsToAssign = assignToAll
      ? getFilteredParticipants().map(p => p.id)
      : selectedParticipants

    if (!bulkCourse || participantsToAssign.length === 0) {
      toast.error('Selecciona un curso y al menos un participante')
      return
    }

    try {
      setIsSubmitting(true)
      
      // Check existing assignments
      const { data: existingAssignments } = await supabase
        .from('course_assignments')
        .select('user_id')
        .eq('course_id', bulkCourse)
        .in('user_id', participantsToAssign)

      const existingUserIds = new Set(existingAssignments?.map(a => a.user_id) || [])
      const newAssignments = participantsToAssign
        .filter(userId => !existingUserIds.has(userId))
        .map(userId => ({
          user_id: userId,
          course_id: bulkCourse
        }))

      if (newAssignments.length === 0) {
        toast.error('Todos los participantes ya tienen asignado este curso')
        return
      }

      const { error } = await supabase
        .from('course_assignments')
        .insert(newAssignments)

      if (error) throw error
      
      const skipped = participantsToAssign.length - newAssignments.length
      toast.success(`✅ ${newAssignments.length} asignaciones creadas${skipped > 0 ? ` (${skipped} ya existían)` : ''}`)
      
      await loadData()
      await loadParticipantCourseCount()
      setIsBulkModalOpen(false)
      setSelectedParticipants([])
      setBulkCourse('')
      setAssignToAll(false)
      setSelectedCompany('all')
      setBulkSearchTerm('')
    } catch (error) {
      console.error('Error in bulk assignment:', error)
      toast.error('Error en la asignación masiva')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleParticipantSelection = (participantId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(participantId)
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    )
  }

  const selectAllParticipants = () => {
    const filteredParticipants = getFilteredParticipants()
    setSelectedParticipants(filteredParticipants.map(p => p.id))
  }

  const getFilteredParticipants = () => {
    return participants.filter(p => {
      const matchesSearch = `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(bulkSearchTerm.toLowerCase())
      const matchesCompany = selectedCompany === 'all' || p.company_id === selectedCompany
      return matchesSearch && matchesCompany
    })
  }

  const filteredAssignments = assignments.filter(assignment => 
    assignment.user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.course.title.toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Asignación de Cursos</h1>
          <p className="text-slate-600">Asigna cursos a los participantes</p>
        </div>
        <button
          onClick={() => setIsBulkModalOpen(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Users className="w-5 h-5 mr-2" />
          Asignación Masiva
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar asignaciones..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
          />
        </div>
      </div>

      {/* Assignments Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Participante
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Curso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Fecha de Asignación
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredAssignments.map((assignment) => (
                <tr key={assignment.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-slate-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-slate-900">
                          {assignment.user.first_name} {assignment.user.last_name}
                        </div>
                        <div className="text-sm text-slate-500">{assignment.user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {assignment.course.image_url ? (
                        <img 
                          src={assignment.course.image_url} 
                          alt={assignment.course.title}
                          className="w-10 h-10 object-cover rounded"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-slate-600" />
                        </div>
                      )}
                      <div className="ml-4">
                        <div className="text-sm font-medium text-slate-900">
                          {assignment.course.title}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {new Date(assignment.assigned_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleRemoveAssignment(assignment)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredAssignments.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-2 text-sm font-medium text-slate-900">No hay asignaciones</h3>
            <p className="mt-1 text-sm text-slate-500">
              {searchTerm ? 'No hay resultados para tu búsqueda.' : 'Comienza asignando cursos a participantes.'}
            </p>
          </div>
        )}
      </div>


      {/* Bulk Assignment Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-6">
              Asignación Masiva de Cursos
            </h2>

            <div className="space-y-6">
              {/* Course Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Seleccionar Curso
                </label>
                <select
                  value={bulkCourse}
                  onChange={(e) => setBulkCourse(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                >
                  <option value="">Seleccionar curso</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Company Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Filtrar por Empresa
                </label>
                <select
                  value={selectedCompany}
                  onChange={(e) => {
                    setSelectedCompany(e.target.value)
                    setSelectedParticipants([])
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                >
                  <option value="all">Todas las empresas</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assign to All Option */}
              <div className="flex items-center p-4 bg-blue-50 rounded-lg">
                <input
                  type="checkbox"
                  id="assignToAll"
                  checked={assignToAll}
                  onChange={(e) => setAssignToAll(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                />
                <label htmlFor="assignToAll" className="ml-3 text-sm font-medium text-blue-900">
                  🚀 Asignar a TODOS los participantes filtrados ({getFilteredParticipants().length} total)
                </label>
              </div>

              {/* Individual Selection */}
              {!assignToAll && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-sm font-medium text-slate-700">
                      Seleccionar Participantes ({selectedParticipants.length} seleccionados)
                    </label>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={selectAllParticipants}
                        className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
                      >
                        Seleccionar Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedParticipants([])}
                        className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>

                  {/* Search */}
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Buscar participantes..."
                      value={bulkSearchTerm}
                      onChange={(e) => setBulkSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    />
                  </div>

                  {/* Participants List */}
                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                    {getFilteredParticipants().map((participant) => (
                        <div key={participant.id} className={`flex items-center p-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 ${
                          participantsWithCourses.get(participant.id) ? 'bg-green-50' : 'bg-orange-50'
                        }`}>
                          <input
                            type="checkbox"
                            checked={selectedParticipants.includes(participant.id)}
                            onChange={() => toggleParticipantSelection(participant.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                          />
                          <div className="ml-3 flex-1">
                            <div className="text-sm font-medium text-slate-900">
                              {participant.first_name} {participant.last_name}
                            </div>
                            <div className="text-sm text-slate-500">{participant.email}</div>
                            <div className="flex items-center space-x-2 mt-1">
                              {participant.company_name && (
                                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
                                  {participant.company_name}
                                </span>
                              )}
                              {participantsWithCourses.get(participant.id) ? (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                                  {participantsWithCourses.get(participant.id)} curso{participantsWithCourses.get(participant.id) !== 1 ? 's' : ''}
                                </span>
                              ) : (
                                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full font-medium">
                                  Sin cursos
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-6 border-t mt-6">
              <button
                type="button"
                onClick={() => {
                  setIsBulkModalOpen(false)
                  setSelectedParticipants([])
                  setBulkCourse('')
                  setAssignToAll(false)
                  setSelectedCompany('all')
                  setBulkSearchTerm('')
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkAssign}
                disabled={isSubmitting || !bulkCourse || (!assignToAll && selectedParticipants.length === 0)}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto"></div>
                ) : (
                  `Asignar${assignToAll ? ` a ${getFilteredParticipants().length}` : selectedParticipants.length > 0 ? ` a ${selectedParticipants.length}` : ''} Participante${(assignToAll ? getFilteredParticipants().length : selectedParticipants.length) !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}