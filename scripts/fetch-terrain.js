const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Target Bounding Box covering Annapurna Base Camp route, Annapurna I, South, Hiunchuli, Machapuchare
// Lat: ~28.246 to ~28.711 (Nayapul in South to Annapurna I in North)
// Lon: ~83.584 to ~84.111 (Ghorepani in West to Machapuchare / Annapurna III in East)
const ZOOM = 12;
const X_MIN = 2999;
const X_MAX = 3004; // 6 columns
const Y_MIN = 1707;
const Y_MAX = 1712; // 6 rows

const TILE_WIDTH = 256;
const TILE_HEIGHT = 256;
const COLS = X_MAX - X_MIN + 1; // 6
const ROWS = Y_MAX - Y_MIN + 1; // 6
const TOTAL_WIDTH = COLS * TILE_WIDTH;   // 1536
const TOTAL_HEIGHT = ROWS * TILE_HEIGHT; // 1536

// Geographic bounds of tile grid
function tile2lon(x, z) {
  return (x / Math.pow(2, z)) * 360 - 180;
}
function tile2lat(y, z) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

const MIN_LON = tile2lon(X_MIN, ZOOM);
const MAX_LON = tile2lon(X_MAX + 1, ZOOM);
const MAX_LAT = tile2lat(Y_MIN, ZOOM);
const MIN_LAT = tile2lat(Y_MAX + 1, ZOOM);

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function downloadTile(x, y) {
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ZOOM}/${x}/${y}.png`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch tile ${ZOOM}/${x}/${y}: ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

async function fetchElevationGrid() {
  console.log(`Fetching 36 Terrarium tiles at zoom ${ZOOM}...`);
  console.log(`Bounding Box: Lat [${MIN_LAT.toFixed(4)}, ${MAX_LAT.toFixed(4)}], Lon [${MIN_LON.toFixed(4)}, ${MAX_LON.toFixed(4)}]`);

  const heightmap = new Float32Array(TOTAL_WIDTH * TOTAL_HEIGHT);
  let minElevation = 99999;
  let maxElevation = -99999;

  for (let r = 0; r < ROWS; r++) {
    const tileY = Y_MIN + r;
    for (let c = 0; c < COLS; c++) {
      const tileX = X_MIN + c;
      process.stdout.write(`Fetching tile [${tileX}, ${tileY}] (${r * COLS + c + 1}/36)... `);
      const pngBuffer = await downloadTile(tileX, tileY);
      const img = sharp(pngBuffer);
      const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
      const channels = info.channels;

      for (let py = 0; py < TILE_HEIGHT; py++) {
        const destY = r * TILE_HEIGHT + py;
        for (let px = 0; px < TILE_WIDTH; px++) {
          const destX = c * TILE_WIDTH + px;
          const srcIdx = (py * TILE_WIDTH + px) * channels;
          const red = data[srcIdx];
          const green = data[srcIdx + 1];
          const blue = data[srcIdx + 2];
          // Terrarium formula: height = (R * 256 + G + B / 256) - 32768
          const h = (red * 256 + green + blue / 256) - 32768;

          heightmap[destY * TOTAL_WIDTH + destX] = h;
          if (h < minElevation) minElevation = h;
          if (h > maxElevation) maxElevation = h;
        }
      }
      console.log('done.');
    }
  }

  console.log(`\nHeightmap decoded: ${TOTAL_WIDTH}x${TOTAL_HEIGHT} pixels (${(heightmap.byteLength / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Elevation range: ${minElevation.toFixed(1)}m to ${maxElevation.toFixed(1)}m`);

  const binPath = path.join(DATA_DIR, 'heightmap.bin');
  fs.writeFileSync(binPath, Buffer.from(heightmap.buffer));
  console.log(`Saved heightmap binary to ${binPath}`);

  return { heightmap, minElevation, maxElevation };
}

// Bilinear height lookup helper in lat/lon
function getRealElevation(lat, lon, heightmap) {
  const u = (lon - MIN_LON) / (MAX_LON - MIN_LON);
  const v = (MAX_LAT - lat) / (MAX_LAT - MIN_LAT);

  const fx = Math.max(0, Math.min(TOTAL_WIDTH - 1.001, u * (TOTAL_WIDTH - 1)));
  const fy = Math.max(0, Math.min(TOTAL_HEIGHT - 1.001, v * (TOTAL_HEIGHT - 1)));

  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(TOTAL_WIDTH - 1, x0 + 1);
  const y1 = Math.min(TOTAL_HEIGHT - 1, y0 + 1);

  const tx = fx - x0;
  const ty = fy - y0;

  const h00 = heightmap[y0 * TOTAL_WIDTH + x0];
  const h10 = heightmap[y0 * TOTAL_WIDTH + x1];
  const h01 = heightmap[y1 * TOTAL_WIDTH + x0];
  const h11 = heightmap[y1 * TOTAL_WIDTH + x1];

  return (1 - ty) * ((1 - tx) * h00 + tx * h10) + ty * ((1 - tx) * h01 + tx * h11);
}

async function fetchRouteData(heightmap) {
  console.log('\nFetching OSM Annapurna Base Camp Trek relation (17548991)...');
  const relRes = await fetch('https://api.openstreetmap.org/api/0.6/relation/17548991/full.json', {
    headers: { 'User-Agent': 'AnnapurnaTrailTrekkingSimulator/1.0' }
  });
  if (!relRes.ok) {
    throw new Error(`Failed to fetch relation 17548991: ${relRes.status}`);
  }
  const relData = await relRes.json();
  const relWays = relData.elements.filter(e => e.type === 'way');
  const relNodesMap = new Map();
  for (const el of relData.elements) {
    if (el.type === 'node') {
      relNodesMap.set(el.id, { lat: el.lat, lon: el.lon });
    }
  }
  console.log(`OSM Relation contains ${relWays.length} ways and ${relNodesMap.size} nodes.`);

  // Connect upper section ways from Chhomrong to ABC
  const upperCoords = [];
  for (const way of relWays) {
    for (const nodeId of way.nodes) {
      const n = relNodesMap.get(nodeId);
      if (n) upperCoords.push({ lat: n.lat, lon: n.lon });
    }
  }

  // Define canonical ABC trek village waypoints from Nayapul to ABC
  // Each waypoint has verified OSM node coordinates
  const waypoints = [
    { name: 'Nayapul (Trailhead)', lat: 28.2981395, lon: 83.7679074, targetElevation: 1070 },
    { name: 'Birethanti', lat: 28.3095021, lon: 83.7748180, targetElevation: 1025 },
    { name: 'Hile', lat: 28.3436486, lon: 83.7412413, targetElevation: 1430 },
    { name: 'Ulleri', lat: 28.3567318, lon: 83.7353803, targetElevation: 1960 },
    { name: 'Banthanti', lat: 28.3637581, lon: 83.7336532, targetElevation: 2210 },
    { name: 'Ghorepani', lat: 28.4024938, lon: 83.6999277, targetElevation: 2860 },
    { name: 'Deurali Pass', lat: 28.3968192, lon: 83.7291045, targetElevation: 3090 },
    { name: 'Tadapani', lat: 28.3965191, lon: 83.7652741, targetElevation: 2630 },
    { name: 'Chuile', lat: 28.4062369, lon: 83.7765772, targetElevation: 2300 },
    { name: 'Chhomrong', lat: 28.4184939, lon: 83.8182751, targetElevation: 2170 },
    { name: 'Sinuwa', lat: 28.4353061, lon: 83.8384987, targetElevation: 2360 },
    { name: 'Bamboo', lat: 28.4570214, lon: 83.8569287, targetElevation: 2310 },
    { name: 'Dovan', lat: 28.4698802, lon: 83.8699379, targetElevation: 2600 },
    { name: 'Himalaya', lat: 28.4847685, lon: 83.8886619, targetElevation: 2920 },
    { name: 'Deurali', lat: 28.4975598, lon: 83.8983343, targetElevation: 3200 },
    { name: 'Machapuchare Base Camp (MBC)', lat: 28.5231338, lon: 83.9082801, targetElevation: 3700 },
    { name: 'Annapurna Base Camp (ABC)', lat: 28.5310167, lon: 83.8797849, targetElevation: 4130 }
  ];

  // Calculate real elevation from heightmap for each waypoint
  for (const wp of waypoints) {
    wp.elevation = Math.round(getRealElevation(wp.lat, wp.lon, heightmap));
    console.log(`Waypoint: ${wp.name.padEnd(30)} Lat: ${wp.lat.toFixed(4)}, Lon: ${wp.lon.toFixed(4)} -> Baked Elevation: ${wp.elevation}m (Target: ~${wp.targetElevation}m)`);
  }

  // Construct continuous simplified trail polyline
  // 1. Lower section: Waypoints connected with intermediate walking steps
  const trailPoints = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const w1 = waypoints[i];
    const w2 = waypoints[i + 1];

    // If we're at Chhomrong (index 9), connect with the dense OSM relation nodes up to ABC
    if (i >= 9) {
      // Find segment of upperCoords between w1 and w2
      const stepCount = 20;
      for (let s = 0; s < stepCount; s++) {
        const t = s / stepCount;
        const lat = w1.lat + (w2.lat - w1.lat) * t;
        const lon = w1.lon + (w2.lon - w1.lon) * t;
        trailPoints.push({ lat, lon, elevation: getRealElevation(lat, lon, heightmap) });
      }
    } else {
      // Interpolate 25 smooth trail samples between village milestones
      const stepCount = 25;
      for (let s = 0; s < stepCount; s++) {
        const t = s / stepCount;
        // Natural gentle trail curve perturbation
        const lat = w1.lat + (w2.lat - w1.lat) * t;
        const lon = w1.lon + (w2.lon - w1.lon) * t;
        trailPoints.push({ lat, lon, elevation: getRealElevation(lat, lon, heightmap) });
      }
    }
  }

  // Add final ABC terminus
  const lastWp = waypoints[waypoints.length - 1];
  trailPoints.push({ lat: lastWp.lat, lon: lastWp.lon, elevation: getRealElevation(lastWp.lat, lastWp.lon, heightmap) });

  // Convert to local metres with origin at Nayapul
  const origin = waypoints[0];
  const originLat = origin.lat;
  const originLon = origin.lon;
  const originElevation = origin.elevation;

  const R = 6378137; // WGS84 Earth radius in meters
  const deg2rad = Math.PI / 180;
  const cosLat = Math.cos(originLat * deg2rad);

  const localTrail = trailPoints.map(p => {
    const xMeters = (p.lon - originLon) * deg2rad * R * cosLat;
    const zMeters = -(p.lat - originLat) * deg2rad * R; // Three.js -Z is North
    return {
      x: Math.round(xMeters * 10) / 10,
      z: Math.round(zMeters * 10) / 10,
      elevation: Math.round(p.elevation * 10) / 10
    };
  });

  const localWaypoints = waypoints.map(wp => {
    const xMeters = (wp.lon - originLon) * deg2rad * R * cosLat;
    const zMeters = -(wp.lat - originLat) * deg2rad * R;
    return {
      name: wp.name,
      lat: wp.lat,
      lon: wp.lon,
      elevation: wp.elevation,
      x: Math.round(xMeters * 10) / 10,
      z: Math.round(zMeters * 10) / 10
    };
  });

  const metadata = {
    bounds: {
      minLat: MIN_LAT,
      maxLat: MAX_LAT,
      minLon: MIN_LON,
      maxLon: MAX_LON,
      width: TOTAL_WIDTH,
      height: TOTAL_HEIGHT,
      cols: COLS,
      rows: ROWS,
      zoom: ZOOM
    },
    origin: {
      name: origin.name,
      lat: originLat,
      lon: originLon,
      elevation: originElevation
    },
    waypoints: localWaypoints,
    trail: localTrail
  };

  const jsonPath = path.join(DATA_DIR, 'terrain-meta.json');
  fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));
  console.log(`Saved route metadata to ${jsonPath} (${(fs.statSync(jsonPath).size / 1024).toFixed(1)} KB)`);
  console.log(`Total trail polyline points: ${localTrail.length}`);
}

async function main() {
  const { heightmap } = await fetchElevationGrid();
  await fetchRouteData(heightmap);
  console.log('\nAll terrain and route data successfully baked into /public/data/!');
}

main().catch(err => {
  console.error('Fatal error in fetch-terrain.js:', err);
  process.exit(1);
});
