<template>
  <div class="results-shell">
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
    </aside>

    <section class="detail-pane" v-if="selectedTable">
      <div class="detail-header">
        <h3>{{ selectedTable.name }}</h3>
        <div class="meta">{{ selectedTable.columns.length }} columns</div>
      </div>

      <div class="detail-toolbar">
        <div class="count">Rows: {{ selectedTable.rows.length }}</div>
        <div class="spacer"></div>
        <label class="compact-toggle"
          ><input type="checkbox" v-model="compact" /> Compact</label
        >
      </div>

      <div class="rows" :class="{ compact: compact }">
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
                  :class="getCellClass(c)"
                >
                  <div class="cell-val">{{ formatCell(r[c.name]) }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, toRef } from 'vue'
const props = defineProps<{ dbInfo: any }>()
const dbInfo = toRef(props, 'dbInfo')

const selected = ref<string | null>(null)
const compact = ref(false)

watch(
  () => dbInfo.value,
  (v) => {
    if (v && v.tables && v.tables.length > 0) selected.value = v.tables[0].name
  },
  { immediate: true }
)

function select(name: string) {
  selected.value = name
}

const selectedTable = computed(() => {
  return (
    dbInfo.value?.tables?.find((t: any) => t.name === selected.value) || null
  )
})

function isNumericType(t: string | undefined) {
  if (!t) return false
  return /int|decimal|float|double|numeric|real/.test(t)
}

function getCellClass(col: any) {
  return isNumericType(col?.data_type) ? 'cell-numeric' : 'cell-text'
}

function formatCell(val: any) {
  if (val === null || val === undefined || val === '') return '-'
  return String(val)
}
</script>

<style scoped>
/* Compact, TablePlus-like presentation */
.results-shell {
  display: flex;
  flex: 1;
  min-height: 0;
  height: 100%;
  border-radius: 6px;
  overflow: hidden;
}
.tables-pane {
  width: 220px;
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
}
.detail-header h3 {
  margin: 0;
  font-size: 14px;
}
.detail-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.detail-toolbar .count {
  color: #9fb0c7;
  font-size: 12px;
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
.rows-table {
  overflow: auto;
  border-radius: 6px;
  flex: 1;
  background: #060607;
  min-height: 0;
  height: 100%;
}
.rows-table table {
  width: 100%;
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
  overflow: hidden;
  text-overflow: ellipsis;
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
  max-width: 360px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rows-table thead th:not(:first-child),
.rows-table tbody td:not(:first-child) {
  border-left: 1px solid rgba(255, 255, 255, 0.01);
}
</style>
