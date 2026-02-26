<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal">
      <header class="modal-header">
        <div class="brand">🐘</div>
        <div class="title-wrap">
          <h2>Connect to Database</h2>
          <div class="subtitle">Enter connection details to inspect the DB</div>
        </div>
      </header>

      <form class="modal-form" @submit.prevent="onConnect">
        <div class="row">
          <label
            >Name<input v-model="form.name" type="text" placeholder="MySql DB"
          /></label>
          <label
            >Note<input v-model="form.note" type="text" placeholder="(local)"
          /></label>
        </div>

        <div class="row">
          <label>Host<input v-model="form.host" type="text" required /></label>
          <label>User<input v-model="form.user" type="text" required /></label>
        </div>

        <div class="row">
          <label
            >Password<input v-model="form.password" type="password"
          /></label>
          <label
            >Database<input v-model="form.database" type="text" required
          /></label>
        </div>

        <div class="row">
          <label
            >Port<input v-model.number="form.port" type="number" required
          /></label>
          <label
            >Row limit (optional)<input
              v-model.number="form.rowLimit"
              type="number"
              min="1"
          /></label>
        </div>

        <div class="actions">
          <button type="button" class="btn-muted" @click="close">Cancel</button>
          <button type="button" class="btn-muted" @click="onSave">Save</button>
          <button type="submit" class="btn-primary" :disabled="loading">
            {{ loading ? 'Connecting…' : 'Connect' }}
          </button>
        </div>
      </form>

      <div v-if="error" class="error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'

const emit = defineEmits(['close', 'connected', 'error', 'save'])

const props = defineProps<{
  defaults?: {
    host?: string
    user?: string
    password?: string
    database?: string
    port?: number
    rowLimit?: number
    name?: string
    note?: string
  }
}>()

const form = reactive({
  host: props.defaults?.host || '',
  name: props.defaults?.name || '',
  note: props.defaults?.note || '',
  user: props.defaults?.user || '',
  password: props.defaults?.password || '',
  database: props.defaults?.database || '',
  port: props.defaults?.port ?? 3306,
  rowLimit: props.defaults?.rowLimit ?? 100,
})

// Update form when defaults change (e.g., when clicking a saved connection)
watch(
  () => props.defaults,
  (d) => {
    if (!d) return
    form.host = d.host ?? form.host
    form.user = d.user ?? form.user
    form.password = d.password ?? form.password
    form.database = d.database ?? form.database
    form.port = d.port ?? form.port
    form.rowLimit = d.rowLimit ?? form.rowLimit
  },
  { immediate: true }
)

const loading = ref(false)
const error = ref('')

function close() {
  emit('close')
}

async function onConnect() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      error.value = data?.message || JSON.stringify(data)
      emit('error', data)
    } else {
      emit('connected', data)
      close()
    }
  } catch (e: any) {
    error.value = e.message || String(e)
    emit('error', { message: error.value })
  } finally {
    loading.value = false
  }
}

function onSave() {
  // Emit current form as a saved connection (caller decides persistence)
  const payload = {
    name: form.name || form.host,
    note: form.note || '',
    host: form.host,
    user: form.user,
    password: form.password,
    database: form.database,
    port: form.port,
    rowLimit: form.rowLimit,
  }
  emit('save', payload)
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.65));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.modal {
  width: 680px;
  max-width: 100%;
  background: linear-gradient(180deg, #1f2630, #111416);
  color: #e6eef6;
  padding: 16px;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
  max-height: calc(100vh - 96px);
  overflow: auto;
}
.modal-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
}
.brand {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #ff9a00, #ff6a00);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  box-shadow: 0 6px 18px rgba(255, 106, 0, 0.18);
}
.title-wrap h2 {
  margin: 0;
  font-size: 20px;
  color: #fff;
}
.subtitle {
  font-size: 12px;
  color: #9fb0c7;
}
.modal-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.row {
  display: flex;
  gap: 10px;
}
label {
  flex: 1;
  display: flex;
  flex-direction: column;
  font-size: 13px;
  color: #bfd3e6;
}
input {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: #0f1417;
  color: #eaf3ff;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}
.btn-primary {
  background: linear-gradient(180deg, #ff8f2f, #ff6a00);
  color: #111;
  padding: 10px 14px;
  border-radius: 8px;
  border: none;
  font-weight: 600;
}
.btn-muted {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: #cbdbe8;
  padding: 8px 12px;
  border-radius: 8px;
}
.error {
  color: #ffb4a6;
  margin-top: 12px;
}

@media (max-width: 720px) {
  .modal {
    width: 100%;
    padding: 14px;
  }
  .row {
    flex-direction: column;
  }
  .brand {
    width: 44px;
    height: 44px;
    font-size: 22px;
  }
}
</style>
