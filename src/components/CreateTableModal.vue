<template>
  <div v-if="modelValue" class="modal-overlay" @click.self="close">
    <div class="modal">
      <h3>Create Table</h3>
      <div class="field">
        <label>Table name</label>
        <input v-model="tableName" />
      </div>

      <div v-if="!props.conn" style="margin-top:8px;padding:8px;border-radius:6px;background:#071018;color:#9fb0c7;font-size:13px">
        <div style="font-weight:600;margin-bottom:6px">No connection available</div>
        <div style="font-size:13px;margin-bottom:6px">Open the Connect dialog or select a saved connection so credentials are available to create the table.</div>
      </div>

      <div class="columns">
        <div v-for="(c, idx) in columns" :key="idx" class="col-row">
          <input v-model="c.name" placeholder="column" />
          <select v-model="c.type">
            <option v-for="t in commonTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
          <div style="display:flex;flex-direction:column">
            <input v-if="c.type === 'OTHER'" v-model="c.typeCustom" placeholder="CUSTOM TYPE" />
            <div class="type-desc" v-if="getTypeDesc(c)" style="font-size:12px;color:#9fb0c7;margin-left:6px">{{ getTypeDesc(c) }}</div>
            <div v-if="typeErrors[idx]" style="color:#ffb4a2;font-size:12px;margin-left:6px">{{ typeErrors[idx] }}</div>
          </div>
          <label><input type="checkbox" v-model="c.primary" /> PK</label>
          <label><input type="checkbox" v-model="c.autoIncrement" /> AI</label>
          <label><input type="checkbox" v-model="c.nullable" /> NULL</label>
          <button @click="removeColumn(idx)">Remove</button>
        </div>
      </div>
      <div>
        <button @click="addColumn">Add column</button>
      </div>

      <div class="actions">
        <button @click="close" class="btn-muted">Cancel</button>
        <button @click="onCreate" class="btn-primary" :disabled="!isFormValid || !props.conn">Create</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { commonTypes } from '../data/sqlTypes'
const props = defineProps<{ modelValue: boolean; conn: any }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'created', payload: any): void
}>()

const tableName = ref('')
const columns = ref<any[]>([
  { name: 'id', type: 'INT', primary: true, autoIncrement: true, nullable: false, typeCustom: '' },
])

// no local credential inputs — credentials must come from props.conn or the store

// re-used list imported from src/data/sqlTypes
// `commonTypes` contains { value, label, desc }

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      // reset defaults when opened
      tableName.value = ''
      columns.value = [
        { name: 'id', type: 'INT', primary: true, autoIncrement: true, nullable: false },
      ]
    }
  }
)

function addColumn() {
  columns.value.push({ name: '', type: 'VARCHAR(255)', primary: false, autoIncrement: false, nullable: true, typeCustom: '' })
}

const typeMap = computed(() => {
  const m: Record<string, string> = {}
  for (const t of commonTypes) m[t.value] = t.desc
  return m
})

function getTypeDesc(c: any) {
  if (!c) return ''
  if (c.type === 'OTHER') return c.typeCustom || typeMap.value['OTHER']
  return typeMap.value[c.type] || ''
}
function removeColumn(i: number) {
  columns.value.splice(i, 1)
}

function close() {
  emit('update:modelValue', false)
}

function validateCustomType(t: string) {
  if (!t || typeof t !== 'string') return false
  const s = t.trim().toUpperCase()
  // Accept patterns like: NAME or NAME(n) or NAME(n,m), e.g. VARCHAR(255), DECIMAL(10,2), CHAR(36)
  // Only allow letters, digits and underscore for the name, with optional parens containing numbers and an optional second number
  const safePattern = /^[A-Z_][A-Z0-9_]*(\(\d+(,\d+)?\))?$/
  return safePattern.test(s)
}
// derived per-column validation messages (pure, no mutation)
const typeErrors = computed(() => {
  return columns.value.map((c: any) => {
    if (c.type === 'OTHER') {
      if (!c.typeCustom || !validateCustomType(c.typeCustom)) {
        return 'Invalid custom type. Examples: VARCHAR(255), DECIMAL(10,2), CHAR(36)'
      }
    }
    return ''
  })
})

const isFormValid = computed(() => {
  if (!tableName.value || String(tableName.value).trim() === '') return false
  for (const c of columns.value) if (!c.name || String(c.name).trim() === '') return false
  return typeErrors.value.every((e: string) => !e)
})

async function onCreate() {
  if (!tableName.value) return alert('Table name required')
  if (!props.conn) return alert('No connection information available — open Connect to provide credentials')
  if (!isFormValid.value) return alert('Please fix column errors before creating the table')
  try {
    const payload = {
      host: props.conn.host,
      user: props.conn.user,
      password: props.conn.password,
      database: props.conn.database,
      port: props.conn.port,
      tableName: tableName.value,
      columns: columns.value.map((c: any) => ({
        name: c.name,
        type: c.type === 'OTHER' ? c.typeCustom!.toUpperCase() : c.type,
        primary: !!c.primary,
        autoIncrement: !!c.autoIncrement,
        nullable: !!c.nullable,
      })),
    }
    const res = await fetch('/api/create-table', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Create failed')
    emit('created', data)
    emit('update:modelValue', false)
  } catch (err: any) {
    alert('Create table failed: ' + (err?.message || String(err)))
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; display:flex; align-items:center; justify-content:center; background: rgba(0,0,0,0.45);
}
.modal { background: #0c0f11; color: #e6eef6; padding: 12px; border-radius:8px; width:520px }
.field { margin-bottom:8px }
.col-row { display:flex; gap:8px; align-items:center; margin-bottom:6px }
.actions { display:flex; justify-content:flex-end; gap:8px; margin-top:10px }
.btn-primary { background: linear-gradient(180deg,#ff8f2f,#ff6a00); color:#111; padding:6px 10px; border-radius:6px }
.btn-muted { background:transparent; border:1px solid rgba(255,255,255,0.04); color:#cbdbe8; padding:6px 10px; border-radius:6px }
</style>
