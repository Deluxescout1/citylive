// CityLive — location lookup for the Settings panel (city/ZIP/address → lat/lon).
//
// Deliberately has NO Electron dependency: it takes a fetch implementation as an
// argument (defaulting to global fetch), so the real lookup logic can be
// unit-tested under plain node with a mock — matching config-store.js's
// no-dependency-injection-free discipline (fetchImpl mirrors the pathToFile
// parameter there). Never throws: every failure resolves to {error}.

'use strict';

const ZIP_RE = /^\d{5}$/;
const TIMEOUT_MS = 8000;

// Build a two-line human label + short display name from an Open-Meteo result.
function labelFor(r) {
  return [r.name, r.admin1, r.country].filter(Boolean).join(', ');
}
function shortNameFor(r) {
  return r.admin1 ? (r.name + ', ' + r.admin1) : r.name;
}

// Run fetchImpl(url) with an 8s abort timeout. Resolves the parsed JSON, or throws
// (caller catches). Non-200 responses throw too, so callers can fall through.
async function fetchJSON(fetchImpl, url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res || !res.ok) throw new Error('bad status');
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function lookupZip(fetchImpl, zip) {
  const data = await fetchJSON(fetchImpl, 'https://api.zippopotam.us/us/' + zip);
  const place = data && Array.isArray(data.places) && data.places[0];
  if (!place) throw new Error('no places');
  const state = place.state || '';
  const name = place['place name'] || '';
  return {
    results: [{
      label: name + ', ' + state + ' ' + zip,
      lat: +place.latitude,
      lon: +place.longitude,
      name: name + ', ' + (place['state abbreviation'] || state)
    }]
  };
}

async function lookupOpenMeteo(fetchImpl, query) {
  const url = 'https://geocoding-api.open-meteo.com/v1/search?name=' +
    encodeURIComponent(query) + '&count=5&language=en&format=json';
  const data = await fetchJSON(fetchImpl, url);
  const list = (data && Array.isArray(data.results)) ? data.results : [];
  return list.slice(0, 5).map(function (r) {
    return { label: labelFor(r), lat: r.latitude, lon: r.longitude, name: shortNameFor(r) };
  });
}

// lookup(query, fetchImpl) → Promise<{results:[{label,lat,lon,name}]} | {error:string}>.
// Never throws. fetchImpl defaults to global fetch (Electron/Node 18+ renderer/main both
// have it); tests inject a mock so no real network call is ever made in CI.
async function lookup(query, fetchImpl) {
  const fetcher = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  const q = String(query == null ? '' : query).trim();
  if (!q) return { error: 'Type a city, ZIP code, or address' };
  if (!fetcher) return { error: 'Lookup failed — check your internet connection and try again' };

  try {
    if (ZIP_RE.test(q)) {
      try {
        const zipResult = await lookupZip(fetcher, q);
        return zipResult;
      } catch (e) {
        // Fall through to Open-Meteo below (bad ZIP / network hiccup on zippopotam).
      }
    }
    const results = await lookupOpenMeteo(fetcher, q);
    if (!results.length) return { error: 'No matches — try a nearby city name' };
    return { results: results };
  } catch (e) {
    return { error: 'Lookup failed — check your internet connection and try again' };
  }
}

module.exports = { lookup };
