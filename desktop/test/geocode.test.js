'use strict';
// Unit tests for geocode.js. Zero real network calls — every test injects a mock
// fetchImpl, matching config-store.test.js's synthetic-data discipline.

const test = require('node:test');
const assert = require('node:assert');
const { lookup } = require('../geocode');

function jsonRes(body, ok) {
  return Promise.resolve({ ok: ok !== false, json: () => Promise.resolve(body) });
}

test('empty query returns a friendly error, no fetch call', async () => {
  let called = false;
  const out = await lookup('   ', () => { called = true; return jsonRes({}); });
  assert.strictEqual(called, false);
  assert.strictEqual(out.error, 'Type a city, ZIP code, or address');
});

test('ZIP happy path hits zippopotam and returns one result', async () => {
  const calls = [];
  const fetchImpl = (url) => {
    calls.push(url);
    return jsonRes({
      places: [{
        'place name': 'Norwich', 'state': 'Connecticut', 'state abbreviation': 'CT',
        latitude: '41.5243', longitude: '-72.0759'
      }]
    });
  };
  const out = await lookup('06360', fetchImpl);
  assert.strictEqual(calls.length, 1);
  assert.ok(calls[0].indexOf('zippopotam') >= 0);
  assert.deepStrictEqual(out, {
    results: [{ label: 'Norwich, Connecticut 06360', lat: 41.5243, lon: -72.0759, name: 'Norwich, CT' }]
  });
});

test('ZIP falls through to Open-Meteo on a non-200 zippopotam response', async () => {
  const calls = [];
  const fetchImpl = (url) => {
    calls.push(url);
    if (url.indexOf('zippopotam') >= 0) return jsonRes({}, false); // 404-like
    return jsonRes({
      results: [{ name: 'Norwich', admin1: 'Connecticut', country: 'United States', latitude: 41.5243, longitude: -72.0759 }]
    });
  };
  const out = await lookup('99999', fetchImpl);
  assert.strictEqual(calls.length, 2);
  assert.ok(calls[1].indexOf('geocoding-api.open-meteo.com') >= 0);
  assert.strictEqual(out.results.length, 1);
  assert.strictEqual(out.results[0].name, 'Norwich, Connecticut');
});

test('city query maps multiple Open-Meteo candidates', async () => {
  const fetchImpl = () => jsonRes({
    results: [
      { name: 'Springfield', admin1: 'Massachusetts', country: 'United States', latitude: 42.1015, longitude: -72.5898 },
      { name: 'Springfield', admin1: 'Illinois', country: 'United States', latitude: 39.7817, longitude: -89.6501 },
      { name: 'Springfield', admin1: 'Missouri', country: 'United States', latitude: 37.2090, longitude: -93.2923 }
    ]
  });
  const out = await lookup('Springfield', fetchImpl);
  assert.strictEqual(out.results.length, 3);
  assert.strictEqual(out.results[0].label, 'Springfield, Massachusetts, United States');
  assert.strictEqual(out.results[0].name, 'Springfield, Massachusetts');
  assert.strictEqual(out.results[1].lat, 39.7817);
});

test('network error on both providers returns a friendly error', async () => {
  const fetchImpl = () => Promise.reject(new Error('ENOTFOUND'));
  const out = await lookup('Nowhereville', fetchImpl);
  assert.strictEqual(out.error, 'Lookup failed — check your internet connection and try again');
});

test('zero Open-Meteo matches returns a "no matches" error', async () => {
  const fetchImpl = () => jsonRes({ results: [] });
  const out = await lookup('Xyzzyplugh', fetchImpl);
  assert.strictEqual(out.error, 'No matches — try a nearby city name');
});

test('a fetch that rejects with AbortError (timeout) surfaces the friendly network error', async () => {
  const fetchImpl = () => {
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    return Promise.reject(err);
  };
  const out = await lookup('Somewhere', fetchImpl);
  assert.strictEqual(out.error, 'Lookup failed — check your internet connection and try again');
});

test('lookup never throws even if fetchImpl throws synchronously', async () => {
  const fetchImpl = () => { throw new Error('boom'); };
  const out = await lookup('Anywhere', fetchImpl);
  assert.strictEqual(out.error, 'Lookup failed — check your internet connection and try again');
});
