
const people = new Map();

// load person data into cache
async function prefetchPerson(wtId) {
  // already cached
  if (people.has(wtId)) {
    return;
  }

  const person = await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "ENRICH_PERSON",
        wtId
      },

      (response) => {
        if (!response || response.error) {
          resolve(null);
          return;
        }
        resolve(response);
      }
    );
  });
  if (person) {
    people.set(wtId, person);
  }
}

// pull person data from the cache
function getCachedPerson(wtId) {
  return people.get(wtId);
}


const personAPI = {
  prefetchPerson,
  getCachedPerson
}

window.personAPI = personAPI;
