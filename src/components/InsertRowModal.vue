<template>
  <div v-if="modelValue" class="modal-overlay" @click.self="close">
    <div class="modal">
      <h3>Insert Row into {{ tableName }}</h3>
      <div v-for="(col, idx) in columns" :key="idx" class="field">
        <label>{{ col.name }} ({{ col.data_type }})</label>
        <input v-model="form[col.name]" :placeholder="col.data_type" />
      </div>

      <div class="actions">
        <button @click="close" class="btn-muted">Cancel</button>
        <button @click="onInsert" class="btn-primary">Insert</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
const props = defineProps<{
  modelValue: boolean
  conn: any
  tableName: string
  columns: any[]
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'inserted', payload: any): void
}>()

const form = ref<any>({})

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      form.value = {}
      for (const c of props.columns || []) form.value[c.name] = ''
    }
  }
)

function close() {
  emit('update:modelValue', false)
}

async function onInsert() {
  try {
    const payload = {
      host: props.conn.host,
      user: props.conn.user,
      password: props.conn.password,
      database: props.conn.database,
      port: props.conn.port,
      tableName: props.tableName,
      row: form.value,
    }
    const res = await fetch('/api/insert-row', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Insert failed')
    emit('inserted', data)
    close()
  } catch (err: any) {
    alert('Insert failed: ' + (err?.message || String(err)))
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}
.modal {
  background: #0c0f11;
  color: #e6eef6;
  padding: 12px;
  border-radius: 8px;
  width: 520px;
}
.field {
  margin-bottom: 8px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
.btn-primary {
  background: linear-gradient(180deg, #ff8f2f, #ff6a00);
  color: #111;
  padding: 6px 10px;
  border-radius: 6px;
}
.btn-muted {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.04);
  color: #cbdbe8;
  padding: 6px 10px;
  border-radius: 6px;
}
</style>
