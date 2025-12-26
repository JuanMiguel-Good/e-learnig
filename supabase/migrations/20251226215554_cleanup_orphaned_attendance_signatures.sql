/*
  # Limpiar firmas huérfanas de asistencia

  1. Cambios
    - Actualiza las firmas que están vinculadas a listas de asistencia eliminadas
    - Libera estas firmas para que puedan ser vinculadas a nuevas listas

  2. Notas
    - Este script es seguro de ejecutar múltiples veces
    - Solo afecta a firmas vinculadas a listas que ya no existen
*/

-- Liberar firmas que están vinculadas a listas de asistencia que ya no existen
UPDATE attendance_signatures
SET attendance_list_id = NULL
WHERE attendance_list_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM attendance_lists
    WHERE attendance_lists.id = attendance_signatures.attendance_list_id
  );