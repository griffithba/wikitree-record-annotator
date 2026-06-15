"use strict";

const _fetchInProgress = new Map();

export async function getFramesByPage(site, book, page) {
  const key = `${site}|${book}|${page}`;

  if (_fetchInProgress.has(key)) {
    // return the earlier promise so all requests for the same page are awaiting the same promise
    return _fetchInProgress.get(key);
  }

  const promise = (async () => {
    try {
      const response = await _wtplusImageFramesGet({
        site,
        book,
        page
      });

      return response;

    } finally {
      _fetchInProgress.delete(key);
    }
  })();

  _fetchInProgress.set(key, promise);
  return promise;
}

async function getFramesByWtId(site, wtId) {
  if (_fetchInProgress.has(wtId)) {
    // return the earlier promise so all requests for the same wtId are awaiting the same promise
    return _fetchInProgress.get(wtId);
  }

  const promise = (async () => {
    try {
      const response = await _wtplusImageFramesGet({
        site,
        wikitreeid: wtId
      });
    
      return response;
    } finally {
      _fetchInProgress.delete(wtId);
    }
  })();

  _fetchInProgress.set(wtId, promise);
  return promise;
}

async function _wtplusImageFramesGet(params) {
  const url = new URL(
      "https://plus.wikitree.com/function/wtImageFramesGet/WT_Annotator.json"
  );

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, v);
    }
  });

  const response = await fetch(url);
  const json = await response.json();
console.log("WT+ wtImageFramesGet response:", json);
  return json;
}