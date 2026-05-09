// storage.js

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

  async updateAnnotation(id, patch) {
    const list = await this.getAnnotations();

    const updated = list.map(a =>
      a.id === id ? { ...a, ...patch } : a
    );

    await this.saveAnnotations(updated);
  },

  async getPeople() {
    const raw = localStorage.getItem(LOCAL_PEOPLE_KEY);
    return raw ? JSON.parse(raw) : {};
  },

  async savePeople(data) {
    localStorage.setItem(LOCAL_PEOPLE_KEY, JSON.stringify(data));
  },

  async getPerson(wtId) {
    const all = await this.getPeople();
    return all[wtId] || null;
  },

  async savePerson(wtId, data) {
    const all = await this.getPeople();
    all[wtId] = data;
    await this.savePeople(all);
  }
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

  async updateAnnotation(id, patch) {
    const list = await this.getAnnotations();

    const updated = list.map(a =>
      a.id === id ? { ...a, ...patch } : a
    );

    await this.saveAnnotations(updated);
  },

  async getPeople() {
    return new Promise(resolve => {
      chrome.storage.local.get([CHROME_PEOPLE_KEY], result => {
        resolve(result[CHROME_PEOPLE_KEY] || {});
      });
    });
  },

  async savePeople(data) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [CHROME_PEOPLE_KEY]: data }, resolve);
    });
  },

  async getPerson(wtId) {
    const all = await this.getPeople();
    return all[wtId] || null;
  },

  async savePerson(wtId, data) {
    const all = await this.getPeople();
    all[wtId] = data;
    await this.savePeople(all);
  }
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

  async updateAnnotation(id, patch) {
    await fetch(`/api/annotations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
  },

  async getPeople() {
    const res = await fetch("/api/people");
    return res.json();
  },

  async savePeople(data) {
    await fetch("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  },

  async getPerson(wtId) {
    const res = await fetch(`/api/people/${wtId}`);
    return res.ok ? res.json() : null;
  },

  async savePerson(wtId, data) {
    await fetch(`/api/people/${wtId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  }
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

const storage = {
  getAnnotations() {
    return adapter.getAnnotations();
  },

  saveAnnotations(data) {
    return adapter.saveAnnotations(data);
  },

  updateAnnotation(id, patch) {
    return adapter.updateAnnotation(id, patch);
  },

  getPeople() {
    return adapter.getPeople();
  },

  savePeople(data) {
    return adapter.savePeople(data);
  },

  getPerson(wtId) {
    return adapter.getPerson(wtId);
  },

  savePerson(wtId, data) {
    return adapter.savePerson(wtId, data);
  }
};

// expose to content scripts
window.storage = storage;
