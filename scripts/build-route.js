#!/usr/bin/env node
/* Generate the tourist route from the cottage locations.

   Reads  data/cottages.json
   Writes <out>/route.json              (ordered stops + per-stage links)
          <out>/chatynkowo-trasa.gpx    (full route, all stops)

   <out> is argv[2], default "dist". Run via scripts/build.sh (locally through
   `npm run build`, and from .github/workflows/pages.yml on deploy) so local
   dev and the official build stay in step. Dependency-free — the route maths
   live in ../route_logic.js, shared with the browser. */
'use strict';

const fs = require('fs');
const path = require('path');
const route = require('../route_logic.js');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(ROOT, process.argv[2] || 'dist');
const GPX_NAME = 'chatynkowo-trasa.gpx';

function main() {
  const src = path.join(ROOT, 'data', 'cottages.json');
  const cottages = JSON.parse(fs.readFileSync(src, 'utf8'));

  const built = route.buildRoute(cottages);
  const gpx = route.buildGpx(built.stops, 'Chatynkowo — pełna trasa turystyczna');

  fs.mkdirSync(OUT, { recursive: true });

  const routeJson = {
    generatedAt: new Date().toISOString(),
    stopCount: built.stopCount,
    distanceKm: built.distanceKm,
    gpxPath: path.posix.join(path.basename(OUT), GPX_NAME),
    stages: built.stages,
    stops: built.stops,
  };

  fs.writeFileSync(path.join(OUT, 'route.json'), JSON.stringify(routeJson, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, GPX_NAME), gpx);

  console.log(
    `[build-route] ${built.stopCount} stops · ~${built.distanceKm} km · ` +
    `${built.stages.length} stage(s) -> ${path.relative(ROOT, OUT)}/route.json + ${GPX_NAME}`
  );
}

main();
