// storage.js

(() => {
  "use strict";
// ============================================================
// ADAPTERS (define FIRST)
// ============================================================

  const LOCAL_KEY = "wt-annotations";
  const LOCAL_PEOPLE_KEY = "wt-people";

  const localAdapter = {
    async getAnnotations() {
      const raw = localStorage.getItem(LOCAL_KEY);
      return raw ? JSON.parse(raw) : [];
    },

    async saveAnnotations(data) {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    },

    /*
    async updateAnnotation(id, patch) {
      const list = await this.getAnnotations();

      const updated = list.map(a =>
        a.id === id ? { ...a, ...patch } : a
      );

      await this.saveAnnotations(updated);
    },
    */
  };

  const CHROME_KEY = "wt-annotations";
  const CHROME_PEOPLE_KEY = "wt-people";

  const chromeAdapter = {
    async getAnnotations() {
      return new Promise(resolve => {
        chrome.storage.local.get([CHROME_KEY], result => {
          resolve(result[CHROME_KEY] || []);
        });
      });
    },

    async saveAnnotations(data) {
      return new Promise(resolve => {
        chrome.storage.local.set({ [CHROME_KEY]: data }, resolve);
      });
    },

    /*
    async updateAnnotation(id, patch) {
      const list = await this.getAnnotations();

      const updated = list.map(a =>
        a.id === id ? { ...a, ...patch } : a
      );

      await this.saveAnnotations(updated);
    },
    */
  };

  const serverAdapter = {
    async getAnnotations() {
      const res = await fetch("/api/annotations");
      return res.json();
    },

    async saveAnnotations(data) {
      await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
    },

    /*
    async updateAnnotation(id, patch) {
      await fetch(`/api/annotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
    },
    */
  };

// ============================================================
// SELECT ACTIVE ADAPTER (AFTER definitions exist)
// ============================================================

  //const adapter = localAdapter; 
  const adapter = chromeAdapter; 
  //const adapter = serverAdapter; 

// ============================================================
// PUBLIC API
// ============================================================

  const storageAPI = {
    getAnnotations() {
      return adapter.getAnnotations();
    },

    saveAnnotations(data) {
      return adapter.saveAnnotations(data);
    },

    /*
    updateAnnotation(id, patch) {
      return adapter.updateAnnotation(id, patch);
    },
    */
  };

  // expose to content scripts
  window.storageAPI = storageAPI;

})();
