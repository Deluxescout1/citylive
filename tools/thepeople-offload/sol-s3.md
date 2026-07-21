## Verdict

The split is correct: keep the authoritative sim geometry-free and make embodiment a read-only function of `(roster snapshot, world registry, effective clock)`. That preserves freeze safety and prevents rendering details from changing citizen history.

But the current design has three P0 holes:

1. **The registry schema is wrong.** `near.blds[].type` is mostly `"tower"`/`"park"`; functional use is `b.use`. Apartments/houses are growth-stage renderings, not necessarily registry types. Jobs also request `docks` and `cityhall`, which may have no corresponding `b.use`.
2. **“Same `near.blds` on every screen” is only true when generation inputs match.** `WW`, `KSP`, region and life influence the world. KDE bezels should share canonical `WW/KSP`; web/phone may legitimately produce different bindings. If identity must match across all four shells, generate a canonical geometry-independent building registry. Otherwise promise bezel sync, not cross-form-factor address identity.
3. **Standing/destruction is dynamic.** Do not encode it only when the binding cache is built. Birth, apocalypse fronts, permanent ruins and disaster rebuilds can change occupancy while the cached array remains structurally valid.

Also: every schedule calculation must use the same effective `now`/`NOWOVR` used by the frame. No direct `Date.now()` inside embodiment, bob, speech, or hit records.

## Open questions

1. **Overlay vs replacement:** overlay initially, with anonymous `peds` thinned by a fixed quality-dependent factor. Do not cap named citizens by prominence; that makes ordinary people pop in/out and biases density. Cull spatially, then use a deterministic per-screen density cap only if profiling proves necessary. Long-term, reduce anonymous pedestrians as named coverage grows.

2. **Hit testing:** while drawing, append compact records for citizens actually rendered: `{idx,gen,sx,y,drawOrder}`. Convert pointer coordinates into logical canvas/world pixels once using the host’s canvas scale, then test the 7px sprite rectangle or a slightly expanded rectangle. Resolve overlaps by containment, then squared distance, then highest draw order, then `(idx,gen)`. Use the exact `sx = disX(worldX)` used for drawing—never independently invert `disX`.

3. **Invalidation:** see the contract below. In short, rebuild structural bindings on world identity/geometry changes; validate standing state every frame.

4. **Performance:** 175 schedule evaluations are cheap; repeated roster projection/sorting, allocation, speech pair searches, hit-card projections and unnecessary canvas state changes are the risks. Compute one roster snapshot per sim tick, one embodiment state per frame, spatially cull before drawing, reuse arrays/objects, and avoid `O(N²)` interaction scans.

5. **Feedback into sim:** keep it cosmetic in Stage 3. Feeding real building destruction into employment would make the pure sim depend on transient render/apocalypse geometry and potentially screen configuration. Stage 4 can introduce a canonical, geometry-independent city-event adapter into `P_sim`; never feed per-shell render bindings back into it.

## Exact cache contract

Separate two concepts:

- **Structural registry/binding:** immutable ranked candidate lists for each citizen.
- **Availability:** whether a candidate is usable at this exact effective time.

Rebuild structural data after:

- `buildWorld()` creates/replaces `near`;
- life or `WORLD_SEED` changes;
- `WW`, `KSP`, region, or any generation-affecting option changes;
- building-use generation/schema/version changes.

`SW`, `WOFF`, `ZOOM`, `SH` and `HORIZON` should not require rebinding unless they indirectly caused `buildWorld()` or changed `WW/KSP`. They affect projection/hit-testing, not address identity.

Do **not** rebuild the whole binding when a building is born, struck, ruined, or rebuilt. Instead, give each citizen a deterministic ranked candidate list—preferably rendezvous hashing over stable building IDs—and select the first candidate satisfying a single shared predicate each frame:

```text
standing(b, now) =
  born according to the engine’s exact boundary rule
  && not currently destroyed
  && not inside a permanent ruin
  && valid for its assigned role
```

Use the engine’s exact birth predicate consistently; the file currently contains both `<` and `<=` variants. Centralize it before embodiment.

Never store only a mutable building object as the citizen’s address. Store a stable ID/index plus the registry generation, and resolve it against the current registry. If the chosen building becomes unavailable, hide the citizen or select the next pre-ranked candidate. Do not use an underspecified “nearest existing type” fallback.

## Main KDE/QML risks and bounds

- Cache `peopleRoster()` per people tick; it allocates projections and sorts living citizens.
- Iterate 175 once per frame; compute position and cull with `disX` before `drawPerson`.
- Reuse `drawnNamed[]`; no per-frame closures, maps, JSON, or public-card construction.
- Build the inspect projection only for the selected `(idx,gen)`.
- Use spatial buckets for speech/co-location, not all-pairs comparison.
- Trigger speech from deterministic time windows and bucket adjacency—not exact floating-point equality.
- Cap bubbles to 1–2 per screen and text-measure/cache captions.
- Preserve apocalypse and road-validity gates already applied to anonymous pedestrians.
- Profile the KDE performance quality path with all 175 simultaneously visible. Set a budget such as ≤1 ms for embodiment on the target low-end machine; degrade bubbles first, anonymous density second, named citizens last.

## Sharpened Stage-3 staging

1. **Registry correctness first:** central `buildingStanding`, stable IDs, `b.use` mapping, explicit policies for houses, parks, docks, city hall, unborn plots, ruins and rebuilds. Add determinism/freeze/bezel tests before drawing.
2. **Static embodiment on KDE plus other shells:** draw named citizens at deterministic valid anchors, spatial culling, anonymous thinning, apocalypse gates, and performance instrumentation. KDE must be in the first gate—not added after desktop inspect works.
3. **Commute schedule:** shortest wrapped world displacement, staggered shifts, non-commuter behavior, effective-clock freeze tests, clothing transitions.
4. **Hit testing/inspect:** after positions are stable. Use the retained draw list and generation-safe identity. Hover should be optional; click/tap should work without requiring hover.
5. **Speech:** after stable proximity semantics; bucketed, rate-limited, deterministic, and separately quality-gated.
6. **Drag gag:** move out of Stage 3 or leave as a final optional polish item. It adds input/state complexity but does not validate embodiment.

The most important correction is to design against the engine’s actual building model—`type` is not job use—and to separate immutable binding candidates from time-varying standing state.