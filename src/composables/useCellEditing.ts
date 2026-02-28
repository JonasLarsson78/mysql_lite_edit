import { ref } from 'vue'

export function useCellEditing(
  selectedTable: any,
  emit: any,
  lastSavedCell: any,
  dbInfo: any
) {
  const editingCell = ref<{ row: number; col: string } | null>(null)
  const editingValue = ref<any>('')

  function startEdit(rowIdx: number, colName: string) {
    editingCell.value = { row: rowIdx, col: colName }
    const val = selectedTable.value?.rows?.[rowIdx]?.[colName]
    editingValue.value = val === null || val === undefined ? '' : String(val)
  }

  function commitEdit() {
    if (!editingCell.value) return
    const { row: rowIdx, col: colName } = editingCell.value
    const oldVal = selectedTable.value?.rows?.[rowIdx]?.[colName]
    const newVal = editingValue.value
    if (
      selectedTable.value &&
      selectedTable.value.rows &&
      selectedTable.value.rows[rowIdx]
    ) {
      selectedTable.value.rows[rowIdx][colName] = newVal
    }
    emit('cell-updated', {
      database: dbInfo.value?.database,
      table: selectedTable.value!.name,
      rowIndex: rowIdx,
      column: colName,
      row: selectedTable.value?.rows?.[rowIdx],
      oldValue: oldVal,
      newValue: newVal,
    })
    editingCell.value = null
    editingValue.value = ''
  }

  function cancelEdit() {
    editingCell.value = null
    editingValue.value = ''
  }

  function isNumericType(t: string | undefined) {
    if (!t) return false
    return /int|decimal|float|double|numeric|real/.test(t)
  }

  function getCellClass(col: any) {
    return isNumericType(col?.data_type) ? 'cell-numeric' : 'cell-text'
  }

  function isCellRecentlySaved(rowIdx: number, colName: string) {
    const s = lastSavedCell.value
    if (!s) return false
    if (!dbInfo.value) return false
    const tblName = selectedTable.value?.name
    return (
      s.database === dbInfo.value.database &&
      s.table === tblName &&
      s.rowIndex === rowIdx &&
      s.column === colName
    )
  }

  function formatCell(val: any) {
    if (val === null || val === undefined || val === '') return '-'
    return String(val)
  }

  return {
    editingCell,
    editingValue,
    startEdit,
    commitEdit,
    cancelEdit,
    getCellClass,
    isCellRecentlySaved,
    formatCell,
  }
}
