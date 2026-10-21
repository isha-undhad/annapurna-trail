const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Ensure target directories exist
const publicDir = path.join(__dirname, '..', 'public');
const hdriDir = path.join(publicDir, 'hdri');
const texturesDir = path.join(publicDir, 'textures');

const textureTypes = ['grass', 'dirt', 'rock', 'snow'];
[hdriDir, texturesDir, ...textureTypes.map(t => path.join(texturesDir, t))].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Helper for Simplex / Perlin like noise
function createNoise2D(seed = 42) {
  const perm = new Uint8Array(512);
  let s = seed;
  for (let i = 0; i < 256; i++) {
    s = (s * 16807 + 7) % 2147483647;
    perm[i] = s % 256;
    perm[i + 256] = perm[i];
  }

  function grad(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
  }

  return function (x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = xf * xf * (3.0 - 2.0 * xf);
    const v = yf * yf * (3.0 - 2.0 * yf);

    const g00 = grad(perm[X + perm[Y]], xf, yf);
    const g10 = grad(perm[X + 1 + perm[Y]], xf - 1, yf);
    const g01 = grad(perm[X + perm[Y + 1]], xf, yf - 1);
    const g11 = grad(perm[X + 1 + perm[Y + 1]], xf - 1, yf - 1);

    const x1 = g00 * (1 - u) + g10 * u;
    const x2 = g01 * (1 - u) + g11 * u;
    return (x1 * (1 - v) + x2 * v) * 0.5 + 0.5;
  };
}

const noise = createNoise2D(1234);

function fbm(x, y, octaves = 4) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  let max = 0;
  for (let i = 0; i < octaves; i++) {
    val += noise(x * freq, y * freq) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2.0;
  }
  return val / max;
}

// 1. Generate PBR Textures (512x512 tileable maps)
const SIZE = 512;

async function generateTextures() {
  for (const type of textureTypes) {
    console.log(`Generating realistic PBR maps for ${type}...`);
    const colorBuf = Buffer.alloc(SIZE * SIZE * 3);
    const normalBuf = Buffer.alloc(SIZE * SIZE * 3);
    const roughnessBuf = Buffer.alloc(SIZE * SIZE * 3);

    // Height map for calculating normals
    const heightMap = new Float32Array(SIZE * SIZE);

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const u = x / SIZE;
        const v = y / SIZE;
        // Tileable coordinate mapping
        const nx = Math.cos(u * Math.PI * 2) * 2;
        const ny = Math.sin(u * Math.PI * 2) * 2;
        const nz = Math.cos(v * Math.PI * 2) * 2;
        const nw = Math.sin(v * Math.PI * 2) * 2;

        let h = 0;
        let r = 0, g = 0, b = 0, rough = 0;

        if (type === 'grass') {
          // Lush alpine grass
          const n1 = fbm(nx * 3 + nz * 2, ny * 3 + nw * 2, 4);
          const fine = noise(x * 0.25, y * 0.25);
          h = n1 * 0.7 + fine * 0.3;

          r = Math.floor(45 + n1 * 35 + fine * 10);
          g = Math.floor(85 + n1 * 55 + fine * 25);
          b = Math.floor(30 + n1 * 25);
          rough = Math.floor(190 + fine * 40);
        } else if (type === 'dirt') {
          // Compacted mountain dirt & pebbles
          const n1 = fbm(nx * 4, ny * 4, 4);
          const pebble = Math.pow(noise(x * 0.15, y * 0.15), 3);
          h = n1 * 0.6 + pebble * 0.4;

          r = Math.floor(115 + n1 * 40 + pebble * 20);
          g = Math.floor(85 + n1 * 30 + pebble * 15);
          b = Math.floor(55 + n1 * 25 + pebble * 10);
          rough = Math.floor(210 + (1 - pebble) * 35);
        } else if (type === 'rock') {
          // Himalayan granite / slate
          const n1 = fbm(nx * 2.5, ny * 2.5, 5);
          const vein = Math.abs(noise(nx * 6, ny * 6) - 0.5) * 2;
          h = n1 * 0.8 + (1 - vein) * 0.2;

          const base = 80 + n1 * 55;
          r = Math.floor(base + vein * 15);
          g = Math.floor(base + 5 + vein * 10);
          b = Math.floor(base + 12 + vein * 5);
          rough = Math.floor(160 + vein * 70);
        } else if (type === 'snow') {
          // Wind-blown snow sastrugi
          const wind = Math.sin((x * 0.05 + y * 0.02) * Math.PI) * 0.5 + 0.5;
          const n1 = fbm(nx * 2, ny * 2, 3);
          h = wind * 0.6 + n1 * 0.4;

          r = Math.floor(235 + n1 * 20);
          g = Math.floor(242 + n1 * 13);
          b = Math.floor(250 + (1 - wind) * 5);
          rough = Math.floor(110 + wind * 45);
        }

        const idx = y * SIZE + x;
        heightMap[idx] = h;

        colorBuf[idx * 3] = Math.min(255, Math.max(0, r));
        colorBuf[idx * 3 + 1] = Math.min(255, Math.max(0, g));
        colorBuf[idx * 3 + 2] = Math.min(255, Math.max(0, b));

        roughnessBuf[idx * 3] = rough;
        roughnessBuf[idx * 3 + 1] = rough;
        roughnessBuf[idx * 3 + 2] = rough;
      }
    }

    // Compute Normal map using Sobel filter on heightMap
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const xPrev = (x - 1 + SIZE) % SIZE;
        const xNext = (x + 1) % SIZE;
        const yPrev = (y - 1 + SIZE) % SIZE;
        const yNext = (y + 1) % SIZE;

        const dX = (heightMap[y * SIZE + xNext] - heightMap[y * SIZE + xPrev]) * 2.5;
        const dY = (heightMap[yNext * SIZE + x] - heightMap[yPrev * SIZE + x]) * 2.5;

        // Normal vector = normalize(-dX, -dY, 1)
        const len = Math.sqrt(dX * dX + dY * dY + 1.0);
        const nx = -dX / len;
        const ny = -dY / len;
        const nz = 1.0 / len;

        const idx = (y * SIZE + x) * 3;
        normalBuf[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
        normalBuf[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
        normalBuf[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
      }
    }

    const typeDir = path.join(texturesDir, type);
    await sharp(colorBuf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
      .jpeg({ quality: 90 })
      .toFile(path.join(typeDir, 'color.jpg'));

    await sharp(normalBuf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
      .jpeg({ quality: 92 })
      .toFile(path.join(typeDir, 'normal.jpg'));

    await sharp(roughnessBuf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
      .jpeg({ quality: 88 })
      .toFile(path.join(typeDir, 'roughness.jpg'));
  }
}

// 2. Generate /public/hdri/sky.hdr (Radiance RGBE standard format)
function generateHdrSky() {
  console.log('Generating Himalayan sunrise / morning HDRI...');
  const w = 512;
  const h = 256;

  const header = `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`;
  const headerBuf = Buffer.from(header, 'ascii');

  // Sun direction in equirectangular spherical coordinates:
  // Azimuth ~45 deg, Elevation ~28 deg
  const sunAzimuth = Math.PI * 0.25;
  const sunElevation = (28 * Math.PI) / 180;
  const sunDir = {
    x: Math.cos(sunElevation) * Math.sin(sunAzimuth),
    y: Math.sin(sunElevation),
    z: Math.cos(sunElevation) * Math.cos(sunAzimuth)
  };

  const pixelData = Buffer.alloc(w * h * 4);
  let p = 0;

  for (let j = 0; j < h; j++) {
    // V coordinate from 0 (top/zenith) to 1 (bottom/nadir)
    const v = j / (h - 1);
    const theta = v * Math.PI; // Polar angle from +Y down to -Y

    for (let i = 0; i < w; i++) {
      const u = i / (w - 1);
      const phi = (u * 2 - 1) * Math.PI; // Azimuth angle

      // Ray direction for pixel
      const rx = Math.sin(theta) * Math.sin(phi);
      const ry = Math.cos(theta);
      const rz = Math.sin(theta) * Math.cos(phi);

      // Dot product with sun
      const sunDot = Math.max(0, rx * sunDir.x + ry * sunDir.y + rz * sunDir.z);

      // Base Himalayan sky colors
      let r, g, b;
      if (ry > 0) {
        // Sky hemisphere (zenith azure down to golden horizon)
        const t = Math.pow(ry, 0.45);
        // Zenith: [0.15, 0.35, 0.75]
        // Horizon: [0.85, 0.88, 0.95] with warm sunrise glow [1.2, 0.9, 0.65] near sun
        const zenithR = 0.18, zenithG = 0.38, zenithB = 0.72;
        const horizonR = 0.88, horizonG = 0.84, horizonB = 0.80;

        r = zenithR * t + horizonR * (1 - t);
        g = zenithG * t + horizonG * (1 - t);
        b = zenithB * t + horizonB * (1 - t);

        // Sun disc and high-radiance atmospheric corona
        if (sunDot > 0.9992) {
          // Sun disc core: HDR intensity 18.0
          r += 18.0; g += 16.5; b += 14.0;
        } else if (sunDot > 0.96) {
          // Sun glow
          const glow = Math.pow((sunDot - 0.96) / 0.04, 3) * 6.0;
          r += glow * 1.2; g += glow * 0.9; b += glow * 0.5;
        }
      } else {
        // Ground bounce hemisphere
        const t = Math.pow(-ry, 0.5);
        r = 0.18 * (1 - t) + 0.08 * t;
        g = 0.24 * (1 - t) + 0.11 * t;
        b = 0.18 * (1 - t) + 0.09 * t;
      }

      // Convert RGB float to Radiance RGBE
      const maxVal = Math.max(r, Math.max(g, b));
      if (maxVal < 1e-32) {
        pixelData[p++] = 0;
        pixelData[p++] = 0;
        pixelData[p++] = 0;
        pixelData[p++] = 0;
      } else {
        const exponent = Math.ceil(Math.log2(maxVal));
        const factor = Math.pow(2, -exponent) * 256.0;
        pixelData[p++] = Math.min(255, Math.floor(r * factor));
        pixelData[p++] = Math.min(255, Math.floor(g * factor));
        pixelData[p++] = Math.min(255, Math.floor(b * factor));
        pixelData[p++] = Math.min(255, exponent + 128);
      }
    }
  }

  const finalBuf = Buffer.concat([headerBuf, pixelData]);
  fs.writeFileSync(path.join(hdriDir, 'sky.hdr'), finalBuf);
  console.log(`Saved /public/hdri/sky.hdr (${finalBuf.length} bytes)`);
}

async function main() {
  await generateTextures();
  generateHdrSky();
  console.log('All textures and HDRI generated successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
