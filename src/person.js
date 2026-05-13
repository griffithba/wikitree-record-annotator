
const people = new Map();

// Cache expiration time (in milliseconds)
const days = 14;
const PERSON_CACHE_MAX_AGE_MS = days * 24 * 60 * 60 * 1000;

async function initialize() {
  // this should probably be done differently if we're using server based vs. local storage

  // Fetch ALL of the people, not just ones with annotations on this page
  const storedPeople = await storageAPI.getPeople();
  people = new Map(Object.entries(storedPeople));
}

// get person data
async function getPersonData(wtId) {
  // retrieve person from in-memory cache
  let person = people.get(wtId);

  // if they aren't there
  if (!person) {
    // grab them from storage
    person = await storageAPI.getPerson(wtId);
    // if they were there then save them in cache
    if (person) {
      people.set(wtId, person);
    }
  }

  const stale =
    !person ||
    person.status !== "verified" ||
    Date.now() - person.cachedAt > PERSON_CACHE_MAX_AGE_MS;

  if (!stale) {
    return person;
  }

  const updatedPerson = await fetchPersonRecord(wtId);

  people.set(wtId, updatedPerson);
  
  return updatedPerson;
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
