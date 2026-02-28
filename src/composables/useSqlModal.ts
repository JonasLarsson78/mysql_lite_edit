import { ref, watch } from 'vue'

export function useSqlModal(
  dbInfo: any,
  selectedTable: any,
  selectedSql: any,
  emit: any
) {
  const sqlModalOpen = ref(false)
  const sqlText = ref('')

  watch(selectedSql, (s: any) => {
    if (s && s.open && s.database && s.database === dbInfo.value?.database) {
      sqlText.value = s.sql || ''
      sqlModalOpen.value = true
    }
  })

  function openSqlModal() {
    const existing = dbInfo.value?._query?.sql
    if (!sqlText.value || sqlText.value.trim() === '') {
      if (selectedTable.value && selectedTable.value.name === 'Query Result') {
        sqlText.value = existing || ''
      } else {
        const tbl = selectedTable.value?.name || ''
        sqlText.value = tbl ? `SELECT * FROM ${tbl} LIMIT 100` : ''
      }
    }
    sqlModalOpen.value = true
  }

  function closeSqlModal() {
    sqlModalOpen.value = false
  }

  function runSql() {
    const sql = (sqlText.value || '').trim()
    if (!sql) return
    emit('execute-sql', { sql, database: dbInfo.value?.database })
    closeSqlModal()
  }

  function onKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runSql()
  }

  watch(sqlModalOpen, (v) => {
    if (v) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  })

  return {
    sqlModalOpen,
    sqlText,
    openSqlModal,
    closeSqlModal,
    runSql,
  }
}
