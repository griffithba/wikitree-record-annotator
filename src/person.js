(() => {
  "use strict";

  const _people = new Map();

  // load person data into cache
  async function prefetch(wtId) {
    // already cached
    if (_people.has(wtId)) {
      return true;
    }

    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "FETCH_PERSON",
          wtId
        },
        resolve
      );
    });
  
    if (!response?.ok) {
      return false;
    }
  
    _people.set(wtId, response.person);
    return true;
  }


  /**
   * Builds display name for a WikiTree ID
   * Format: "Name (birth-death)" or WikiTree ID
   * @param {Object} wtId - WikiTree ID
   * @returns {string} formatted name/dates text
   */
  function formatDisplayName(wtId) {
    let text = wtId;

    if (_people.has(wtId)) {
      const person = _people.get(wtId);

      if (person && (person.name || person.birth || person.death)) {
        const years = (person.birth || "") + "-" + (person.death || "");
        text = `${person.name || wtId} (${years})`;
      }
    } else {
      text += " not found";
    }
        
    return text; 
  }


  function getName(wtId) {
    if (_people.has(wtId)) {
      return _people.get(wtId).name;
    }
  }
  

  function getBirthDate(wtId) {
    if (_people.has(wtId)) {
      const person = _people.get(wtId);

      return person.birthDate || person.birth || null;
    }
  }

  
  function getDeathDate(wtId) {
    if (_people.has(wtId)) {
      const person = _people.get(wtId);

      return person.deathDate || person.death || null;
    }
  }

  
  window.personAPI = {
    prefetch,
    formatDisplayName,
    getName,
    getBirthDate, 
    getDeathDate
  }

})();