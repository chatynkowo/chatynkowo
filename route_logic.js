/* ---------- Chatynkowo — tourist-route logic (shared) ----------
   Pure, dependency-free helpers for turning the cottage list into an
   optimised tourist route plus the map-service links and GPX file.

   Single source of truth used in TWO places:
     • the deploy/build step  (scripts/build-route.js, via Node `require`)
       computes the whole route once and writes it to dist/route.json.
     • the browser            (window.chatynkowo.route, loaded in index.html)
       uses the per-cottage point links + distance for the pin window's
       navigation block and the "neighbouring cottages" suggestions.

   The route ORDER, stages and GPX are produced at build time only — the
   browser just renders dist/route.json. The point/distance helpers run at
   runtime because they depend on which cottage is open / what the visitor
   has already found.

   UMD wrapper: module.exports under Node, window.chatynkowo.route in a
   browser. No external dependencies. */
(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    (global.chatynkowo = global.chatynkowo || {}).route = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* Great-circle distance in kilometres between two {lat,lng} points. */
  function haversineKm(a, b) {
    const R = 6371;
    const t = Math.PI / 180;
    const dLat = (b.lat - a.lat) * t;
    const dLng = (b.lng - a.lng) * t;
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  /* Keep entries with a finite lat/lng and drop exact-duplicate coordinates
     (e.g. the placeholder pair jedrzej == waciak at 50.32,19.6). First
     occurrence wins. Returns slim {slug,title,lat,lng} records. */
  function dedupe(cottages) {
    const seen = new Set();
    const out = [];
    for (const c of cottages || []) {
      const lat = Number(c.lat);
      const lng = Number(c.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const key = lat.toFixed(5) + ',' + lng.toFixed(5);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ slug: c.slug, title: c.title, lat, lng });
    }
    return out;
  }

  /* Total length of an open path (sum of consecutive legs), in km. */
  function routeLengthKm(stops) {
    let total = 0;
    for (let i = 1; i < stops.length; i++) total += haversineKm(stops[i - 1], stops[i]);
    return total;
  }

  /* Order the stops into a sensible visiting sequence: nearest-neighbour
     starting from the southern-most cottage, then a 2-opt pass to untangle
     crossings. Treats it as an OPEN path (no return to start). */
  function optimizeOrder(stops) {
    if (stops.length <= 2) return stops.slice();

    // --- Nearest-neighbour ---
    let start = stops[0];
    for (const c of stops) if (c.lat < start.lat) start = c;
    const remaining = stops.filter((c) => c !== start);
    const route = [start];
    let cur = start;
    while (remaining.length) {
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversineKm(cur, remaining[i]);
        if (d < bd) { bd = d; bi = i; }
      }
      cur = remaining.splice(bi, 1)[0];
      route.push(cur);
    }

    // --- 2-opt (open path) ---
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 1; i < route.length - 1; i++) {
        for (let k = i + 1; k < route.length; k++) {
          const a = route[i - 1];
          const b = route[i];
          const c = route[k];
          const d = route[k + 1]; // may be undefined (end of open path)
          const before = haversineKm(a, b) + (d ? haversineKm(c, d) : 0);
          const after = haversineKm(a, c) + (d ? haversineKm(b, d) : 0);
          if (after + 1e-9 < before) {
            let lo = i;
            let hi = k;
            while (lo < hi) { const t = route[lo]; route[lo] = route[hi]; route[hi] = t; lo++; hi--; }
            improved = true;
          }
        }
      }
    }
    return route;
  }

  /* Split an ordered list into stages of at most `max` stops, OVERLAPPING by
     one stop so consecutive stages chain into a continuous route. `max`
     defaults to 10 — the binding limit is Google's ~10-stop directions URL
     (Mapy.cz allows more), so 10 keeps both services happy.
       20 stops, max 10  ->  [0..9], [9..18], [18..19]  (10 / 10 / 2). */
  function splitStages(stops, max) {
    max = max || 10;
    if (stops.length <= max) return [stops.slice()];
    const stages = [];
    let i = 0;
    while (i < stops.length - 1) {
      const end = Math.min(i + max, stops.length);
      stages.push(stops.slice(i, end));
      if (end >= stops.length) break;
      i = end - 1; // overlap by one so the next stage starts where this ended
    }
    return stages;
  }

  /* ---- Map-service links ---- */

  // Google Maps directions, path via the api=1 scheme (lat,lng order).
  function googleRouteUrl(stops) {
    const o = stops[0];
    const d = stops[stops.length - 1];
    const mid = stops.slice(1, -1).map((c) => `${c.lat},${c.lng}`).join('|');
    let u =
      'https://www.google.com/maps/dir/?api=1' +
      `&origin=${o.lat},${o.lng}` +
      `&destination=${d.lat},${d.lng}` +
      '&travelmode=walking';
    if (mid) u += `&waypoints=${encodeURIComponent(mid)}`;
    return u;
  }

  // Mapy.cz (mapy.com) route — NOTE: lon,lat order, ';'-separated waypoints.
  function mapyRouteUrl(stops) {
    const o = stops[0];
    const d = stops[stops.length - 1];
    const mid = stops.slice(1, -1).map((c) => `${c.lng},${c.lat}`).join(';');
    let u =
      'https://mapy.com/fnc/v1/route?mapset=outdoor' +
      `&start=${o.lng},${o.lat}` +
      `&end=${d.lng},${d.lat}` +
      '&routeType=foot_hiking';
    if (mid) u += `&waypoints=${mid}`;
    return u;
  }

  // Single-location links (used by the pin window's nav block).
  function googlePointUrl(c) {
    return `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=walking`;
  }
  function mapyPointUrl(c) {
    return `https://mapy.com/fnc/v1/showmap?mapset=outdoor&center=${c.lng},${c.lat}&zoom=16&marker=true`;
  }

  /* ---- GPX ---- */
  function escapeXml(s) {
    return String(s).replace(/[&<>"']/g, (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]));
  }

  // GPX 1.1: one <wpt> per cottage (POIs) + one <rte> with the full order.
  function buildGpx(stops, name) {
    const title = escapeXml(name || 'Chatynkowo — trasa turystyczna');
    const wpts = stops
      .map((c) => `  <wpt lat="${c.lat}" lon="${c.lng}"><name>${escapeXml(c.title)}</name></wpt>`)
      .join('\n');
    const rtepts = stops
      .map((c) => `    <rtept lat="${c.lat}" lon="${c.lng}"><name>${escapeXml(c.title)}</name></rtept>`)
      .join('\n');
    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<gpx version="1.1" creator="Chatynkowo" xmlns="http://www.topografix.com/GPX/1/1">\n' +
      `  <metadata><name>${title}</name></metadata>\n` +
      wpts + '\n' +
      '  <rte>\n' +
      `    <name>${title}</name>\n` +
      rtepts + '\n' +
      '  </rte>\n' +
      '</gpx>\n'
    );
  }

  /* Convenience: dedupe -> optimise -> split into stages. Returns the data
     shape written to dist/route.json (minus generatedAt / gpxPath, which the
     build script stamps on). */
  function buildRoute(cottages, max) {
    const ordered = optimizeOrder(dedupe(cottages));
    const stages = splitStages(ordered, max || 10).map((s, i) => ({
      index: i + 1,
      count: s.length,
      from: s[0].title,
      to: s[s.length - 1].title,
      slugs: s.map((c) => c.slug),
      google: googleRouteUrl(s),
      mapy: mapyRouteUrl(s),
    }));
    return {
      stopCount: ordered.length,
      distanceKm: Math.round(routeLengthKm(ordered)),
      stops: ordered,
      stages,
    };
  }

  return {
    haversineKm,
    dedupe,
    routeLengthKm,
    optimizeOrder,
    splitStages,
    googleRouteUrl,
    mapyRouteUrl,
    googlePointUrl,
    mapyPointUrl,
    buildGpx,
    buildRoute,
  };
});
