/*
  # Cambiar comportamiento de eliminación de listas de asistencia

  1. Problema
    - Actualmente cuando se elimina una lista de asistencia, las firmas vinculadas se eliminan permanentemente (ON DELETE CASCADE)
    - Esto causa pérdida de datos - las firmas deben preservarse para poder crear nuevas listas

  2. Solución
    - Cambiar la relación de ON DELETE CASCADE a ON DELETE SET NULL
    - Cuando se elimine una lista, las firmas permanecerán pero se liberará el vínculo (attendance_list_id = NULL)
    - Las firmas liberadas podrán ser vinculadas a nuevas listas de asistencia

  3. Cambios
    - Eliminar constraint existente con CASCADE
    - Crear nuevo constraint con SET NULL
    - Las firmas nunca se perderán al eliminar listas de asistencia

  4. Notas Importantes
    - Esta migración es segura y no afecta datos existentes
    - Las firmas ya eliminadas NO se pueden recuperar
    - Los participantes afectados deberán firmar nuevamente
*/

-- Primero, eliminar el constraint existente
ALTER TABLE attendance_signatures
DROP CONSTRAINT IF EXISTS attendance_signatures_attendance_list_id_fkey;

-- Crear el nuevo constraint con ON DELETE SET NULL
-- Esto preservará las firmas cuando se elimine una lista de asistencia
ALTER TABLE attendance_signatures
ADD CONSTRAINT attendance_signatures_attendance_list_id_fkey
FOREIGN KEY (attendance_list_id)
REFERENCES attendance_lists(id)
ON DELETE SET NULL;
