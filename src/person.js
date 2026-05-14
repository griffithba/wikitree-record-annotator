
const people = new Map();

// load person data into cache
async function prefetchPerson(wtId) {
  // already cached
  if (people.has(wtId)) {
    return true;
  }

  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "FETCH_PERSON",
        wtId
      },
      resolve
      }
    );
  });
  
  if (!response?.ok) {
    return false;
  }
  
  people.set(wtId, response.person);
  return true;
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
