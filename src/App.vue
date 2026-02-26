<template>
  <div class="app-shell">
    <div class="left-panel">
      <div class="logo">🐘</div>
      <div class="connections">
        <div
          v-for="db in savedDbs"
          :key="db.id"
          class="connection-item"
          @click="openSaved(db)"
        >
          <div class="connection-meta">
            <div class="connection-title">
              {{ db.name }} <span class="muted">{{ db.note }}</span>
            </div>
            <div class="connection-host">{{ db.host }}</div>
          </div>
          <button
            class="connection-delete"
            @click.stop="deleteSaved(db.id)"
            title="Delete connection"
          >
            ✕
          </button>
        </div>
      </div>
    </div>

    <div class="main-area">
      <div class="card">
        <h1>MySQL Lite Edit</h1>
        <p class="lead">Quickly connect and inspect your MySQL databases.</p>
        <div class="controls">
          <button class="btn-primary" @click="open = true">
            Connect to DB
          </button>
        </div>
        <div v-if="dbInfo" class="result">
          <div class="result-header">
            <h3>Database: {{ dbInfo.database }}</h3>
            <button class="btn-debug" @click="showRaw = !showRaw">
              {{ showRaw ? 'Hide JSON' : 'Show JSON' }}
            </button>
          </div>
          <ResultsView :dbInfo="dbInfo" />
          <pre v-if="showRaw" class="debug-json">{{
            JSON.stringify(dbInfo, null, 2)
          }}</pre>
        </div>
      </div>
    </div>

    <DbConnectModal
      v-if="open"
      :defaults="selectedDefaults"
      @close="open = false"
      @connected="onConnected"
      @error="onError"
      @save="saveConnection"
    />

    <div v-if="resultsFullscreen" class="results-fullscreen">
      <div class="fs-header">
        <button class="btn-close" @click="closeResults">← Back</button>
        <div class="fs-title">Database: {{ dbInfo?.database }}</div>
        <div class="fs-actions">
          <button class="btn-close" @click="closeResults">Close</button>
        </div>
      </div>
      <div class="fs-body">
        <ResultsView :dbInfo="dbInfo" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import DbConnectModal from './components/DbConnectModal.vue'
import ResultsView from './components/ResultsView.vue'

const open = ref(false)
const dbInfo = ref<any | null>(null)
const selectedDefaults = ref<any | null>(null)
const resultsFullscreen = ref(false)
const showRaw = ref(false)

const savedDbs = ref<any[]>([])

// load saved connections from localStorage
onMounted(() => {
  try {
    const raw = localStorage.getItem('savedDbs')
    if (raw) savedDbs.value = JSON.parse(raw)
    if (!savedDbs.value || !Array.isArray(savedDbs.value)) savedDbs.value = []
  } catch (e) {
    savedDbs.value = []
  }
})

function openSaved(db: any) {
  selectedDefaults.value = {
    host: db.host,
    user: db.user,
    password: db.password,
    database: db.database,
    port: db.port,
    rowLimit: db.rowLimit,
    name: db.name,
    note: db.note,
  }
  open.value = true
}

function saveConnection(payload: any) {
  const id = Date.now()
  const entry = { id, ...payload }
  savedDbs.value.unshift(entry)
  try {
    localStorage.setItem('savedDbs', JSON.stringify(savedDbs.value))
  } catch (e) {
    console.warn('Failed saving connection', e)
  }
}

function deleteSaved(id: number) {
  const idx = savedDbs.value.findIndex((s) => s.id === id)
  if (idx === -1) return
  const ok = confirm('Delete this saved connection?')
  if (!ok) return
  savedDbs.value.splice(idx, 1)
  try {
    localStorage.setItem('savedDbs', JSON.stringify(savedDbs.value))
  } catch (e) {
    console.warn('Failed persisting savedDbs after delete', e)
  }
}

function onConnected(data: any) {
  dbInfo.value = data
  resultsFullscreen.value = true
}

function onError(e: any) {
  console.warn('Connect error', e)
}

function closeResults() {
  resultsFullscreen.value = false
  dbInfo.value = null
  selectedDefaults.value = null
  open.value = false
}

// Prevent body/page scrolling while fullscreen results are shown
watch(
  () => resultsFullscreen.value,
  (isOpen) => {
    try {
      document.body.style.overflow = isOpen ? 'hidden' : ''
    } catch (e) {
      /* ignore when document not available */
    }
  }
)
</script>

<style lang="scss" scoped>
.app-shell {
  display: flex;
  height: 100vh;
  font-family:
    system-ui,
    Segoe UI,
    Roboto,
    'Helvetica Neue',
    Arial;
  color: #e6eef6;
}
.left-panel {
  width: 220px;
  padding: 20px;
  background: linear-gradient(180deg, #161a1f, #101215);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.left-panel .logo {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: linear-gradient(135deg, #ff9a00, #ff6a00);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  box-shadow: 0 6px 18px rgba(255, 106, 0, 0.18);
}
.left-panel .app-name {
  font-weight: 700;
  font-size: 16px;
  margin-top: 6px;
}
.left-panel .muted {
  color: #6f8aa0;
  font-weight: 600;
  font-size: 13px;
  margin-left: 6px;
}
.left-panel .host {
  color: #9fb0c7;
  font-size: 13px;
  margin-top: 6px;
}
.connections {
  margin-top: 8px;
}
.connection-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
}
.connection-meta {
  flex: 1;
  min-width: 0;
}
.connection-delete {
  background: transparent;
  border: none;
  color: #9fb0c7;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.connection-delete:hover {
  background: rgba(255, 255, 255, 0.03);
  color: #fff;
}
.main-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
  background: linear-gradient(180deg, #131417, #0b0c0e);
}
.card {
  width: 640px;
  padding: 20px;
  border-radius: 10px;
  background: linear-gradient(180deg, #111519, #0c0f11);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
}
.results-fullscreen .results-shell {
  height: 100%;
}
.results-fullscreen .rows {
  min-height: 0;
}
.results-fullscreen .rows-table {
  max-height: calc(100vh - 160px);
  overflow: auto;
}
.card h1 {
  margin: 0;
  color: #fff;
}
.lead {
  color: #9fb0c7;
  margin-top: 8px;
}
.controls {
  margin-top: 18px;
}
.btn-primary {
  background: linear-gradient(180deg, #ff8f2f, #ff6a00);
  color: #111;
  padding: 10px 14px;
  border-radius: 8px;
  border: none;
  font-weight: 600;
}
.result {
  margin-top: 18px;
}
.result-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.btn-debug {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.04);
  color: #9fb0c7;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
}
.debug-json {
  max-height: 320px;
  overflow: auto;
  margin-top: 12px;
  background: #071014;
  padding: 12px;
  border-radius: 8px;
  color: #cfe8ff;
}

/* Fullscreen results overlay */
.results-fullscreen {
  position: fixed;
  inset: 0;
  background: linear-gradient(180deg, #070707, #0b0b0d);
  z-index: 80;
  padding: 18px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.fs-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.btn-close {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.04);
  color: #cfe8ff;
  padding: 6px 10px;
  border-radius: 6px;
}
.fs-title {
  flex: 1;
  color: #e6eef6;
  font-weight: 700;
}
.fs-body {
  flex: 1;
  display: flex;
}
.fs-body {
  min-height: 0;
}
.fs-body > * {
  flex: 1;
}
pre {
  background: #071014;
  padding: 12px;
  border-radius: 8px;
  overflow: auto;
  color: #cfe8ff;
}

@media (max-width: 800px) {
  .left-panel {
    display: none;
  }
  .card {
    width: 100%;
  }
}
</style>
