import { defineStore } from 'pinia'

export const useDbStore = defineStore('db', {
  state: () => ({
    savedDbs: [] as any[],
    dbInfo: null as any | null,
    selectedDefaults: null as any | null,
    resultsFullscreen: false,
    open: false,
  }),
  actions: {
    loadSaved() {
      try {
        const raw = localStorage.getItem('savedDbs')
        if (raw) this.savedDbs = JSON.parse(raw)
        if (!this.savedDbs || !Array.isArray(this.savedDbs)) this.savedDbs = []
      } catch (e) {
        this.savedDbs = []
      }
    },
    persist() {
      try {
        localStorage.setItem('savedDbs', JSON.stringify(this.savedDbs))
      } catch (e) {
        console.warn('Failed persisting savedDbs', e)
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
    },
    openModalWithDefaults(d: any) {
      this.selectedDefaults = d
      this.open = true
    },
  },
})
