
"use strict";

const _fetchInProgress = new Map();


export async function handleWtFetch(wtId) {
  if (_fetchInProgress.has(wtId)) {
    // return the earlier promise so all requests for the same wtId are awaiting the same promise
    return _fetchInProgress.get(wtId);
  }

  const promise = (async () => {
    try {
      const profile = await _fetchWikiTreeProfile(wtId);

      if (!profile) {
        return {
          ok: false, 
          reason: "not_found"
        };
      }

      return {
        ok: true, 
        person: {
          wtId,
          name: profile.name || null,
          birthDate: profile.birthDate || null,
          birth: profile.birthYear || null,
          death: profile.deathYear || null
        }
      };
    } finally {
      _fetchInProgress.delete(wtId);
    }
  })();
  
  _fetchInProgress.set(wtId, promise);
  return promise;
}


async function _fetchWikiTreeProfile(wtId) {
  try {
    const form = new URLSearchParams();
    form.append("action", "getPerson");
    form.append("key", wtId);
    form.append("fields", "FirstName,MiddleName,LastNameAtBirth,BirthDate,DeathDate");
    form.append("appId", "wikitree-record-annotator");

    const res = await fetch("https://api.wikitree.com/api.php", {
      method: "POST",
      body: form
    });
    
    const data = await res.json();

    const person = data?.[0]?.person;
    if (!person) return null;

    return {
      name: _buildDisplayName(person) || null,
      birthDate: _formatDate(person.BirthDate), 
      birthYear: _extractYear(person.BirthDate),
      deathYear: _extractYear(person.DeathDate)
    };
  } catch (e) {
    console.error("WT fetch error:", e);
    throw e;
  }
}


function _buildDisplayName(person) {
  const first = person.FirstName || "";
  const middle = person.MiddleName || "";
  const last = person.LastNameAtBirth || "";

  return `${first} ${middle} ${last}`.trim();
}


function _extractYear(dateStr) {
  if (!dateStr) return null;

  const match = dateStr.match(/\d{4}/);
  if (!match) return null;

  const year = match[0];

  return year === "0000" ? null : year;
}

function _formatDate(dateStr) {
  if (!dateStr) return null;

  const [year, month, day] = dateStr.split("-");

  if (year === "0000" || month === "00" || day === "00") return null;
  return dateStr;
}