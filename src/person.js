
const people = new Map();

// Cache expiration time (in milliseconds)
const days = 14;
const PERSON_CACHE_MAX_AGE_MS = days * 24 * 60 * 60 * 1000;

const storageAPI = window.storage;


// get person data
async function prefetchPerson(wtId) {
  // fetch them from storage
  person = await storageAPI.getPerson(wtId);
  // if they were there then save them in cache
  if (person) {
    people.set(wtId, person);
  }
  
  const stale =
    !person ||
    person.status !== "verified" ||
    Date.now() - person.cachedAt > PERSON_CACHE_MAX_AGE_MS;

  if (stale) {
    const updatedPerson = await fetchPersonRecord(wtId);
    people.set(wtId, updatedPerson);
    console.log("Person cache miss or stale - fetched from API:", wtId);
  } else console.log("Person cache hit (verified & fresh):", wtId);
}

// Request that the person data be fetched from the WikiTree API
async function fetchPersonRecord(wtId) {

  return new Promise((resolve) => {

    chrome.runtime.sendMessage(
      {
        type: "ENRICH_PERSON",
        wtId
      },

      async (response) => {

        if (!response || response.error) {

          resolve(null);

          return;
        }

        response.cachedAt = Date.now();

        await storageAPI.savePerson(
          wtId,
          response
        );

        resolve(response);
      }
    );
  });
}

function getCachedPerson(wtId) {
  return people.get(wtId);
}


const personAPI = {
  prefetchPerson,
  getCachedPerson
}

window.personAPI = personAPI;