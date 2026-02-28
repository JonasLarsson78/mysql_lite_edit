<template>
  <div class="results-shell">
    <div v-if="isLoading" class="loader-overlay">
      <div class="loader">
        <div class="spinner"></div>
        <div class="loader-text">Loading…</div>
      </div>
    </div>
    <aside class="tables-pane">
      <div class="pane-header">Tables</div>
      <ul class="tables-list">
        <li
          v-for="t in dbInfo.tables"
          :key="t.name"
          :class="['tables-item', { selected: t.name === selected }]"
          @click="select(t.name)"
        >
          <span class="icon">▦</span>
          <span class="name">{{ t.name }}</span>
        </li>
      </ul>
      <div class="tables-actions">
        <button class="sql-btn" @click="createTableOpen = true">
          Create Table
        </button>
        <button
          class="sql-btn"
          @click="insertRowOpen = true"
          :disabled="!selectedTable || selectedTable.name === 'Query Result'"
          style="margin-left: 8px"
        >
          Insert Row
        </button>
        <button
          class="sql-btn"
          @click="dropTable"
          :disabled="!selectedTable || selectedTable.name === 'Query Result'"
          style="margin-left: 8px"
        >
          Drop Table
        </button>
      </div>
    </aside>

    <section class="detail-pane" v-if="selectedTable">
      <div class="detail-header">
        <h3>{{ selectedTable.name }}</h3>
        <div class="spacer"></div>
        <label class="compact-toggle"
          ><input type="checkbox" v-model="compact" /> Compact</label
        >
      </div>

      <div class="rows" :class="{ compact: compact }">
        <button
          :class="[
            'sql-btn',
            selectedTable && selectedTable.name === 'Query Result'
              ? 'sql-btn--active'
              : '',
          ]"
          style="width: 120px"
          @click="openSqlModal"
        >
          <span v-if="selectedTable && selectedTable.name === 'Query Result'"
            >Edit SQL</span
          >
          <span v-else>SQL</span>
        </button>

        <h4>Rows (sample)</h4>
        <div class="rows-table">
          <table>
            <thead>
              <tr>
                <th class="rownum">#</th>
                <th v-for="c in selectedTable.columns" :key="c.name">
                  <div class="col-header">
                    <div class="col-name">{{ c.name }}</div>
                    <div class="col-type">{{ c.data_type }}</div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, idx) in selectedTable.rows" :key="idx">
                <td class="rownum">{{ Number(idx) + 1 }}</td>
                <td
                  v-for="c in selectedTable.columns"
                  :key="c.name"
                  :class="[
                    getCellClass(c),
                    { 'cell-saved': isCellRecentlySaved(Number(idx), c.name) },
                  ]"
                >
                  <div class="cell-val">
                    <template
                      v-if="
                        editingCell &&
                        editingCell.row === Number(idx) &&
                        editingCell.col === c.name
                      "
                    >
                      <input
                        v-model="editingValue"
                        @keydown.enter.prevent="commitEdit"
                        @keydown.esc.prevent="cancelEdit"
                        @blur="commitEdit"
                        class="cell-input"
                        autofocus
                      />
                    </template>
                    <template v-else>
                      <div @dblclick="() => startEdit(Number(idx), c.name)">
                        {{ formatCell(r[c.name]) }}
                      </div>
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Fallback when database has no tables -->
    <section class="detail-pane" v-else>
      <div class="detail-header">
        <h3>No tables found</h3>
        <div class="spacer"></div>
      </div>
      <div class="rows">
        <p style="color: #9fb0c7">
          This database doesn't contain any tables yet.
        </p>
      </div>
    </section>

    <CreateTableModal
      v-model:modelValue="createTableOpen"
      :conn="dbInfo?._conn || dbInfo"
      @created="onTableCreated"
    />
    <InsertRowModal
      v-model:modelValue="insertRowOpen"
      :conn="dbInfo?._conn || dbInfo"
      :tableName="selectedTable?.name || ''"
      :columns="selectedTable?.columns || []"
      @inserted="onRowInserted"
    />

    <!-- SQL Editor Modal -->
    <div
      v-if="sqlModalOpen"
      class="sql-modal-overlay"
      @click.self="closeSqlModal"
    >
      <div class="sql-modal">
        <header class="sql-modal-header">
          <h3>Run SQL on {{ dbInfo.value?.database || 'current DB' }}</h3>
        </header>
        <div class="sql-body">
          <textarea
            v-model="sqlText"
            placeholder="SELECT * FROM users LIMIT 10"
          />
        </div>
        <div class="sql-actions">
          <button class="btn-muted" @click="closeSqlModal">Cancel</button>
          <button class="btn-primary" @click="runSql">Run (Ctrl↵)</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, toRef } from 'vue'
import { useDbStore } from '../stores/useDbStore'
import { storeToRefs } from 'pinia'
import { useSqlModal } from '../composables/useSqlModal'
import { useCellEditing } from '../composables/useCellEditing'
import CreateTableModal from './CreateTableModal.vue'
import InsertRowModal from './InsertRowModal.vue'
const props = defineProps<{ dbInfo: any }>()
const dbInfo = toRef(props, 'dbInfo')

const selected = ref<string | null>(null)
const compact = ref(false)

// (Modal and cell-editing state moved to composables)

// Listen for store-driven SQL editor requests (e.g., edit query from tab)
const store = useDbStore()
const { selectedSql, lastSavedCell } = storeToRefs(store)

const isLoading = computed(() => {
  const db = dbInfo.value?.database
  if (!db) return false
  return !!store.loadingMap?.[db]
})

// (moved to composable)

const emit = defineEmits<{
  (e: 'execute-sql', payload: { sql: string; database?: string }): void
  (
    e: 'cell-updated',
    payload: {
      database?: string
      table: string
      rowIndex: number
      column: string
      row: any
      oldValue: any
      newValue: any
    }
  ): void
  (e: 'refresh-db', payload: { database: string }): void
}>()

watch(
  () => dbInfo.value,
  (v) => {
    if (v && v.tables && v.tables.length > 0) selected.value = v.tables[0].name
  },
  { immediate: true }
)

/* no pointer listeners */

function select(name: string) {
  selected.value = name
}

const createTableOpen = ref(false)
const insertRowOpen = ref(false)

async function dropTable() {
  if (!selectedTable.value) return
  const ok = confirm(
    `Drop table ${selectedTable.value.name}? This cannot be undone.`
  )
  if (!ok) return
  try {
    const conn = dbInfo.value?._conn
    if (!conn) throw new Error('No connection info')
    const payload = {
      host: conn.host,
      user: conn.user,
      password: conn.password,
      database: conn.database,
      port: conn.port,
      tableName: selectedTable.value.name,
    }
    const res = await fetch('/api/drop-table', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Drop failed')
    // signal parent/store to refresh the DB info
    emit('refresh-db', { database: conn.database })
  } catch (err: any) {
    alert('Drop table failed: ' + (err?.message || String(err)))
  }
}

function onTableCreated(_res: any) {
  const conn = dbInfo.value?._conn
  if (conn) emit('refresh-db', { database: conn.database })
}

function onRowInserted(_res: any) {
  const conn = dbInfo.value?._conn
  if (conn) emit('refresh-db', { database: conn.database })
}

// modal logic moved to composable

const selectedTable = computed(() => {
  return (
    dbInfo.value?.tables?.find((t: any) => t.name === selected.value) || null
  )
})

const { sqlModalOpen, sqlText, openSqlModal, closeSqlModal, runSql } =
  useSqlModal(dbInfo, selectedTable, selectedSql, emit)

const {
  editingCell,
  editingValue,
  startEdit,
  commitEdit,
  cancelEdit,
  getCellClass,
  isCellRecentlySaved,
  formatCell,
} = useCellEditing(selectedTable, emit, lastSavedCell, dbInfo)
</script>

<style scoped lang="scss">
/* Compact, TablePlus-like presentation */
.results-shell {
  display: flex;
  flex: 1;
  min-height: 0;
  height: 100%;
  position: relative;
  border-radius: 6px;
  overflow: hidden;
}
.tables-pane {
  width: 280px;
  background: #0b0b0c;
  padding: 8px;
  color: #bcdff6;
  border-right: 1px solid rgba(255, 255, 255, 0.03);
}
.pane-header {
  font-weight: 700;
  margin-bottom: 8px;
  color: #98b1c6;
  font-size: 13px;
}
.tables-list {
  list-style: none;
  padding: 4px 0;
  margin: 0;
}

/* make sidebar layout vertical and allow table list to scroll while actions stay pinned */
.tables-pane {
  display: flex;
  flex-direction: column;
}
.tables-list {
  flex: 1 1 auto;
  overflow: auto;
}

.tables-actions {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.03);
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;
}
.tables-actions .sql-btn {
  padding: 8px 10px;
  font-size: 13px;
}
.tables-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  color: #d9f0ff;
  font-size: 13px;
}
.tables-item.selected {
  background: rgba(255, 255, 255, 0.02);
}
.icon {
  color: #7fb8ff;
}
.detail-pane {
  flex: 1;
  padding: 10px;
  background: #070808;
  color: #e6eef6;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
}
.detail-header h3 {
  margin: 0;
  font-size: 14px;
}
.compact-toggle {
  color: #9fb0c7;
  font-size: 12px;
}
/* columns list removed */
.rows {
  margin-top: 8px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* SQL modal styles */
.sql-modal-overlay {
  position: fixed;
  inset: 0;
  background: linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.6));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.sql-modal {
  width: 780px;
  max-width: 96%;
  background: #0c0f11;
  color: #e6eef6;
  padding: 12px;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
}
.sql-modal-header h3 {
  margin: 0 0 8px 0;
}
.sql-body textarea {
  width: 100%;
  min-height: 160px;
  background: #071014;
  color: #cfe8ff;
  border: 1px solid rgba(255, 255, 255, 0.04);
  padding: 10px;
  border-radius: 6px;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace;
  font-size: 13px;
}
.sql-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
.btn-primary {
  background: linear-gradient(180deg, #ff8f2f, #ff6a00);
  color: #111;
  padding: 8px 12px;
  border-radius: 6px;
  border: none;
}
.btn-muted {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.04);
  color: #cbdbe8;
  padding: 8px 12px;
  border-radius: 6px;
}
.sql-btn {
  background: rgba(255, 255, 255, 0.03);
  color: #cfe8ff;
  padding: 8px 10px;
  border-radius: 8px;
  border: none;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 80ms ease,
    background 100ms ease;
}
.sql-btn:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.06);
}
.sql-btn--active {
  background: linear-gradient(180deg, #ff8f2f, #ff6a00);
  color: #111;
  box-shadow: 0 8px 20px rgba(255, 106, 0, 0.12);
}
.rows-table {
  overflow: auto;
  border-radius: 6px;
  flex: 1;
  background: #060607;
  min-height: 0;
  height: 100%;
  position: relative;
}
.rows-table table {
  display: inline-block;
  width: max-content;
  border-collapse: separate;
  border-spacing: 0;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Courier New',
    monospace;
  font-size: 12px;
}
.rows-table thead th {
  position: sticky;
  top: 0;
  background: #0b0b0c;
  color: #d9f0ff;
  z-index: 60;
  padding: 6px 8px;
  font-size: 11px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}
/* Prevent wrapping so horizontal scroll is triggered when needed */
.rows-table thead th,
.rows-table tbody td {
  white-space: nowrap;
}

/* dragging and scroll-hint removed */
.rows-table thead th::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 6px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.15));
  pointer-events: none;
}
.rows-table tbody td {
  padding: 5px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.01);
  font-size: 12px;
  color: #d9f0ff;
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;
}
.rows-table tbody tr:nth-child(odd) {
  background: rgba(255, 255, 255, 0.01);
}
.rows-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.02);
}
.rows.compact .rows-table thead th {
  padding: 4px 6px;
  font-size: 10px;
}
.rows.compact .rows-table tbody td {
  padding: 3px 6px;
  font-size: 11px;
}
/* sticky first column */
.rows-table thead th.rownum,
.rows-table tbody td.rownum {
  position: sticky;
  left: 0;
  background: #0b0b0c;
  z-index: 7;
  width: 52px;
  text-align: right;
  padding-right: 10px;
  border-right: 1px solid rgba(255, 255, 255, 0.02);
}
.col-header {
  display: flex;
  flex-direction: column;
}
.col-name {
  font-weight: 700;
}
.col-type {
  font-size: 10px;
  color: #7f9fb8;
  margin-top: 3px;
}
.cell-numeric {
  text-align: right;
}
.cell-text {
  text-align: left;
}
.cell-val {
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;
}
.cell-input {
  width: 100%;
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: #071014;
  color: #cfe8ff;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace;
}
.cell-saved {
  animation: savedFlash 1.6s ease forwards;
}

/* loader overlay (moved out from inside .cell-saved so it applies correctly) */
.loader-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(rgba(2, 6, 9, 0.25), rgba(2, 6, 9, 0.35));
  z-index: 200;
}
.loader {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(10, 12, 14, 0.9);
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
}
.spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.12);
  border-top-color: #ff8f2f;
  animation: spin 900ms linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.loader-text {
  color: #dfefff;
  font-size: 13px;
}
@keyframes savedFlash {
  0% {
    background: rgba(34, 197, 94, 0.28);
  }
  40% {
    background: rgba(34, 197, 94, 0.22);
  }
  100% {
    background: transparent;
  }
}
.rows-table thead th:not(:first-child),
.rows-table tbody td:not(:first-child) {
  border-left: 1px solid rgba(255, 255, 255, 0.01);
}

/* tables-pane fixed width enforced; responsive shrink removed */
</style>
