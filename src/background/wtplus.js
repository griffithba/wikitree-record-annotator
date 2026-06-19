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

export async function getFramesByWtId(site, wtId) {
  const key = `${site}|${wtId}`;
  if (_fetchInProgress.has(key)) {
    // return the earlier promise so all requests for the same wtId are awaiting the same promise
    return _fetchInProgress.get(key);
  }

  const promise = (async () => {
    try {
      const response = await _wtplusImageFramesGet({
        site,
        wikitreeid: wtId
      });
    
      return response;
    } finally {
      _fetchInProgress.delete(key);
    }
  })();

  _fetchInProgress.set(key, promise);
  return promise;
}

async function _wtplusImageFramesGet(params) {
  const url = new URL("https://plus.wikitree.com/function/wtImageFramesGet/WT_Annotator.json");

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, v);
    }
  });
  const response = await fetch(url);
  
console.log("WT+ URL:", url.toString());
console.log("status:", response.status);

  const json = await response.json();
console.log("WT+ wtImageFramesGet response:", json);
  return json;
}


export async function addFrame(site, book, page, info, wikitreeid, frame) {
  try {
    const url = new URL("https://plus.wikitree.com/function/wtImageFramesAdd/WT_Annotator.json");

    const form = new URLSearchParams();
    form.append("site", site);
    form.append("book", book);
    form.append("page", page);
    if (info) form.append("info", info);
    form.append("wikitreeid", wikitreeid);
    form.append("x", frame.x);
    form.append("y", frame.y);
    form.append("w", frame.w);
    form.append("h", frame.h);
    if (frame.note) form.append("note", frame.note);

    const res = await fetch(url, {
      method: "POST",
      body: form
    });
    
    const data = await res.json();
console.log("addFrame result:", data);
    const frameId = data?.response?.frameid;
console.log("frameid:", frameId);
    return (data);

  } catch (e) {
    console.error("WT+ add error:", e);
    throw e;
  }
}


export async function deleteFrame(site, book, page, wtId, frameId) {
  console.log("background wtplus.deleteFrame:", wtId, frameId);
  try {
    const url = new URL("https://plus.wikitree.com/function/wtImageFramesDelete/WT_Annotator.json");

    const form = new URLSearchParams();
    form.append("site", site);
    form.append("book", book);
    form.append("page", page);
    form.append("wikitreeid", wtId);
    form.append("frameid", frameId);

    const res = await fetch(url, {
      method: "POST",
      body: form
    });

    const data = await res.json();
console.log("deleteFrame result:", data);
//    const success = data?.response?.success;
//console.log("Success:", success);
    return (data);

  } catch (e) {
    console.error("WT+ delete error:", e);
    throw e;
  }
}
