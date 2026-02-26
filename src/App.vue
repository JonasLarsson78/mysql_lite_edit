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
        <div v-if="currentResult" class="result">
          <div class="result-header">
            <h3>Database: {{ currentResult.database }}</h3>
            <button class="btn-debug" @click="showRaw = !showRaw">
              {{ showRaw ? 'Hide JSON' : 'Show JSON' }}
            </button>
          </div>
          <ResultsView
            :dbInfo="currentResult"
            @execute-sql="handleExecuteSql"
          />
          <pre v-if="showRaw" class="debug-json">{{
            JSON.stringify(currentResult, null, 2)
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
        <div class="fs-tabs">
          <button
            class="btn-primary"
            @click="open = true"
            style="margin-right: 8px"
          >
            Connect
          </button>
          <template v-for="(r, idx) in openResults" :key="idx">
            <button
              :class="['fs-tab', { active: idx === activeResult }]"
              @click="store.setActiveResult(idx)"
            >
              <span class="tab-fav">🐘</span>
              <span v-if="r && r._query" class="tab-sql-badge">SQL</span>
              {{ r.database || r.name || 'DB ' + (idx + 1) }}
              <span class="tab-close" @click.stop="store.closeResult(idx)"
                >✕</span
              >
            </button>
          </template>
        </div>
      </div>
      <div class="fs-body">
        <ResultsView
          :dbInfo="openResults[activeResult]"
          @execute-sql="handleExecuteSql"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import DbConnectModal from './components/DbConnectModal.vue'
import ResultsView from './components/ResultsView.vue'
import { useDbStore } from './stores/useDbStore'
import { storeToRefs } from 'pinia'

const store = useDbStore()
const {
  savedDbs,
  open,
  dbInfo,
  selectedDefaults,
  resultsFullscreen,
  openResults,
  activeResult,
} = storeToRefs(store)
const currentResult = computed(() =>
  openResults.value && openResults.value.length
    ? openResults.value[activeResult.value]
    : dbInfo.value
)
const showRaw = ref(false)

// load saved connections from localStorage
onMounted(() => {
  store.loadSaved()
})

async function openSaved(db: any) {
  // if a result for this database is already open, switch to that tab
  const idx = store.openResults.findIndex(
    (r: any) => r?.database === db.database
  )
  if (idx !== -1) {
    store.setActiveResult(idx)
    store.setResultsFullscreen(true)
    return
  }

  // Try to connect immediately and open a new tab. If it fails, open the modal with defaults.
  try {
    const res = await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: db.host,
        user: db.user,
        password: db.password,
        database: db.database,
        port: db.port,
        rowLimit: db.rowLimit,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      const withConn = {
        ...data,
        _conn: {
          host: db.host,
          user: db.user,
          password: db.password,
          database: db.database,
          port: db.port,
          name: db.name,
          note: db.note,
        },
      }
      store.addResult(withConn)
      return
    }
    // fallback to modal on error
    console.warn('Saved connect failed:', data)
  } catch (e) {
    console.warn('Saved connect error', e)
  }

  store.openModalWithDefaults({
    host: db.host,
    user: db.user,
    password: db.password,
    database: db.database,
    port: db.port,
    rowLimit: db.rowLimit,
    name: db.name,
    note: db.note,
  })
}

function saveConnection(payload: any) {
  store.saveConnection(payload)
}

function deleteSaved(id: number) {
  const ok = confirm('Delete this saved connection?')
  if (!ok) return
  store.deleteSaved(id)
}

function onConnected(payload: any) {
  // payload may be { data, creds }
  if (payload && payload.data) {
    const merged = { ...payload.data }
    if (payload.creds) merged._conn = payload.creds
    store.addResult(merged)
  } else {
    store.addResult(payload)
  }
}

async function handleExecuteSql(payload: any) {
  const sql = payload?.sql
  const database = payload?.database
  if (!sql) return

  // try find connection creds from openResults or current dbInfo
  let conn: any = null
  const found = store.openResults.find((r: any) => r?.database === database)
  if (found && found._conn) conn = found._conn
  else if (
    store.dbInfo &&
    store.dbInfo.database === database &&
    store.dbInfo._conn
  )
    conn = store.dbInfo._conn

  if (!conn) {
    alert(
      'No connection credentials available for this DB. Open the DB via Connect to enable queries.'
    )
    return
  }

  try {
    const res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql,
        host: conn.host,
        user: conn.user,
        password: conn.password,
        database: conn.database,
        port: conn.port,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      alert('Query failed: ' + (data?.message || JSON.stringify(data)))
      return
    }

    const rows = data.rows || []
    const cols =
      data.columns ||
      (rows[0] ? Object.keys(rows[0]).map((n: any) => ({ name: n })) : [])
    const queryResult = {
      database: conn.database,
      name: `Query: ${sql.slice(0, 24).replace(/\s+/g, ' ')}${sql.length > 24 ? '…' : ''}`,
      tables: [
        {
          name: 'Query Result',
          columns: cols.map((c: any) => ({ name: c.name || c })),
          rows,
        },
      ],
      _query: { sql },
      _conn: conn,
    }

    // If the active tab is a Query Result (has _query) for same tab, replace it
    const activeIdx = store.activeResult
    const activeTab = store.openResults[activeIdx]
    let replaced = false
    if (
      activeTab &&
      (activeTab._query || activeTab.name?.startsWith('Query:'))
    ) {
      // update in-place
      store.updateResultAt(activeIdx, queryResult)
      replaced = true
    } else {
      // check for an existing Query Result for same database
      const existingIdx = store.openResults.findIndex(
        (r: any) => r && r._query && r.database === conn.database
      )
      if (existingIdx !== -1) {
        store.updateResultAt(existingIdx, queryResult)
        store.setActiveResult(existingIdx)
        replaced = true
      }
    }

    if (!replaced) store.addResult(queryResult)
    // close any store-driven sql editor state
    if (store.selectedSql && store.selectedSql.open) store.closeSqlEditor()
  } catch (e) {
    alert('Query error: ' + String(e))
  }
}

function onError(e: any) {
  console.warn('Connect error', e)
}

// Prevent body/page scrolling while fullscreen results are shown
watch(
  () => store.resultsFullscreen,
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
  display: none;
  width: 340px;
  padding: 20px;
  background: linear-gradient(180deg, #161a1f, #101215);
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  height: 100vh;
  z-index: 90;
  overflow: auto;
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
  margin-left: 340px;
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
  left: 380px;
  top: 0;
  right: 0;
  bottom: 0;
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
/* Tabs styling */
.fs-tabs {
  display: flex;
  align-items: center;
  gap: 12px;
}
.fs-tab {
  background: rgba(255, 255, 255, 0.03);
  color: #cfe8ff;
  border: none;
  padding: 8px 12px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  cursor: pointer;
  transition:
    background 120ms ease,
    transform 60ms ease;
}
.fs-tab:hover {
  background: rgba(255, 255, 255, 0.06);
  transform: translateY(-1px);
}
.fs-tab.active {
  background: linear-gradient(180deg, #ff8f2f, #ff6a00);
  color: #111;
  box-shadow: 0 8px 20px rgba(255, 106, 0, 0.12);
}
.tab-close {
  margin-left: 8px;
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 12px;
  opacity: 0.95;
  color: inherit;
}
.tab-edit {
  margin-left: 8px;
  background: rgba(255, 255, 255, 0.04);
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.tab-edit:hover {
  background: rgba(255, 255, 255, 0.08);
}
.tab-close:hover {
  background: rgba(255, 255, 255, 0.12);
}
.tab-fav {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  margin-right: 8px;
  background: linear-gradient(135deg, #ff9a00, #ff6a00);
  font-size: 12px;
  line-height: 1;
}
.tab-sql-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  color: #ffd8b3;
  padding: 2px 6px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 12px;
  margin-right: 8px;
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
  /* On small screens reduce left panel width */
  .left-panel {
    width: 220px;
  }
  .main-area {
    margin-left: 220px;
  }
  .results-fullscreen {
    left: 220px;
    padding: 12px;
  }
  .card {
    width: calc(100% - 40px);
  }
}
</style>
