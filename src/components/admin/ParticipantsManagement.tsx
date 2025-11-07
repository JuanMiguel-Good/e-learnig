import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit2, Trash2, Phone, Mail, User, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'

interface Company {
  id: string
  razon_social: string
  ruc: string
}

interface Participant {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  country_code: string
  company_id: string | null
  dni: string | null
  created_at: string
  company?: {
    razon_social: string
    ruc: string
  }
}

interface ParticipantFormData {
  email: string
  first_name: string
  last_name: string
  phone: string
  country_code: string
  company_id: string
  dni: string
  password?: string
  role: string
}

export default function ParticipantsManagement() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue
  } = useForm<ParticipantFormData>({
    defaultValues: {
      country_code: '+52',
      role: 'participant'
    }
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Load participants with company info
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          company:companies(razon_social, ruc)
        `)
        .eq('role', 'participant')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Load companies for select
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, razon_social, ruc')
        .order('razon_social')

      if (companiesError) throw companiesError

      setParticipants(data || [])
      setCompanies(companiesData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateOrUpdate = async (data: ParticipantFormData) => {
    try {
      if (editingParticipant) {
        // Update existing participant
        const updateData: any = {
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone || null,
          country_code: data.country_code,
          company_id: data.company_id || null,
          dni: data.dni || null,
          role: data.role,
          updated_at: new Date().toISOString()
        }

        if (data.password) {
          const bcrypt = await import('bcryptjs')
          updateData.password_hash = await bcrypt.hash(data.password, 10)
        }

        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', editingParticipant.id)

        if (error) throw error
        toast.success('Participante actualizado correctamente')
      } else {
        // Create new participant
        if (!data.password) {
          toast.error('La contraseña es requerida para nuevos participantes')
          return
        }

        const bcrypt = await import('bcryptjs')
        const passwordHash = await bcrypt.hash(data.password, 10)

        const { error } = await supabase
          .from('users')
          .insert([
            {
              email: data.email,
              password_hash: passwordHash,
              first_name: data.first_name,
              last_name: data.last_name,
              phone: data.phone || null,
              country_code: data.country_code,
              company_id: data.company_id || null,
              dni: data.dni || null,
              role: data.role
            }
          ])

        if (error) throw error
        toast.success('Participante creado correctamente')
      }

      await loadData()
      setIsModalOpen(false)
      setEditingParticipant(null)
      reset()
    } catch (error: any) {
      console.error('Error saving participant:', error)
      toast.error(error.message || 'Error al guardar participante')
    }
  }

  const handleEdit = (participant: Participant) => {
    setEditingParticipant(participant)
    setValue('email', participant.email)
    setValue('first_name', participant.first_name)
    setValue('last_name', participant.last_name)
    setValue('phone', participant.phone || '')
    setValue('country_code', participant.country_code)
    setValue('company_id', participant.company_id || '')
    setValue('dni', participant.dni || '')
    setIsModalOpen(true)
  }

  const handleDelete = async (participant: Participant) => {
    if (!confirm(`¿Estás seguro de eliminar a ${participant.first_name} ${participant.last_name}?`