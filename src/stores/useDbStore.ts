import { defineStore } from 'pinia'

export const useDbStore = defineStore('db', {
  state: () => ({
    savedDbs: [] as any[],
    dbInfo: null as any | null,
    openResults: [] as any[],
    activeResult: 0 as number,
    selectedDefaults: null as any | null,
    resultsFullscreen: false,
    selectedSql: { open: false, sql: '', database: null } as any,
    open: false,
    lastSavedCell: null as any | null,
  }),
  actions: {
    markCellSaved(payload: any) {
      this.lastSavedCell = { ...payload, ts: Date.now() }
      // clear after a brief period
      setTimeout(() => {
        try {
          this.lastSavedCell = null
        } catch (e) {
          /* ignore */
        }
      }, 2200)
      this.persist()
    },
    updateResultAt(idx: number, data: any) {
      if (idx < 0 || idx >= this.openResults.length) return
      // replace in place
      this.openResults.splice(idx, 1, data)
      this.activeResult = idx
      this.persist()
    },
    openSqlEditor(database: string | null, sql: string) {
      this.selectedSql = { open: true, sql: sql || '', database }
    },
    closeSqlEditor() {
      this.selectedSql = { open: false, sql: '', database: null }
    },
    addResult(data: any) {
      // add to end and select the new tab
      this.openResults.push(data)
      this.activeResult = Math.max(0, this.openResults.length - 1)
      this.setResultsFullscreen(true)
      this.persist()
    },
    closeResult(idx: number) {
      if (idx < 0 || idx >= this.openResults.length) return
      this.openResults.splice(idx, 1)
      // adjust activeResult when necessary
      if (this.openResults.length === 0) {
        // last tab closed -> return to start
        this.resultsFullscreen = false
        this.dbInfo = null
        this.selectedDefaults = null
        this.open = false
        this.activeResult = 0
        return
      }
      if (idx < this.activeResult) {
        this.activeResult = this.activeResult - 1
      }
      if (this.activeResult >= this.openResults.length) {
        this.activeResult = Math.max(0, this.openResults.length - 1)
      }
      this.persist()
    },
    setActiveResult(i: number) {
      if (i < 0 || i >= this.openResults.length) return
      this.activeResult = i
      this.persist()
    },
    loadSaved() {
      try {
        const raw = localStorage.getItem('savedDbs')
        if (raw) this.savedDbs = JSON.parse(raw)
        if (!this.savedDbs || !Array.isArray(this.savedDbs)) this.savedDbs = []
      } catch (e) {
        this.savedDbs = []
      }

      // load open results and active tab
      try {
        const rawOpen = localStorage.getItem('openResults')
        if (rawOpen) this.openResults = JSON.parse(rawOpen)
        if (!this.openResults || !Array.isArray(this.openResults))
          this.openResults = []
      } catch (e) {
        this.openResults = []
      }
      try {
        const ar = localStorage.getItem('activeResult')
        if (ar) this.activeResult = Number(ar) || 0
      } catch (e) {
        this.activeResult = 0
      }
      try {
        const rf = localStorage.getItem('resultsFullscreen')
        if (rf) this.resultsFullscreen = rf === 'true'
      } catch (e) {
        this.resultsFullscreen = false
      }
    },
    persist() {
      try {
        localStorage.setItem('savedDbs', JSON.stringify(this.savedDbs))
        localStorage.setItem('openResults', JSON.stringify(this.openResults))
        localStorage.setItem('activeResult', String(this.activeResult))
        localStorage.setItem(
          'resultsFullscreen',
          String(this.resultsFullscreen)
        )
      } catch (e) {
        console.warn('Failed persisting store', e)
      }
    },
    saveConnection(payload: any) {
      const id = Date.now()
      const entry = { id, ...payload }
      this.savedDbs.unshift(entry)
      this.persist()
    },
    deleteSaved(id: number) {
      const idx = this.savedDbs.findIndex((s) => s.id === id)
      if (idx === -1) return
      this.savedDbs.splice(idx, 1)
      this.persist()
    },
    setDbInfo(data: any) {
      this.dbInfo = data
    },
    clearDbInfo() {
      this.dbInfo = null
      this.selectedDefaults = null
      this.open = false
      this.resultsFullscreen = false
    },
    setResultsFullscreen(v: boolean) {
      this.resultsFullscreen = v
      this.persist()
    },
    openModalWithDefaults(d: any) {
      this.selectedDefaults = d
      this.open = true
    },
  },
})
