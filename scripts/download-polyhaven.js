const fs = require('fs');
const path = require('path');
const https = require('https');

const publicDir = path.join(__dirname, '..', 'public');
const hdriDir = path.join(publicDir, 'hdri');
const texturesDir = path.join(publicDir, 'textures');
const modelsDir = path.join(publicDir, 'models');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(destPath));
    const file = fs.createWriteStream(destPath);
    
    function get(u) {
      https.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          return reject(new Error(`Failed to download ${u}: status code ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve(destPath));
        });
      }).on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }

    get(url);
  });
}

async function main() {
  console.log('🚀 Starting Poly Haven CC0 Asset Download (2K Quality)...');

  // 1. HDRI Sky (Clear mountain morning sky)
  console.log('\n[1/6] Downloading 2K Mountain HDRI (drakensberg_solitary_mountain_puresky)...');
  const hdriUrl = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/drakensberg_solitary_mountain_puresky_2k.hdr';
  await downloadFile(hdriUrl, path.join(hdriDir, 'sky.hdr'));
  console.log('✓ Saved /public/hdri/sky.hdr');

  // 2. Textures: Grass, Dirt, Rock, Snow
  const textureSets = [
    {
      dir: 'grass',
      name: 'sparse_grass',
      diff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/sparse_grass/sparse_grass_diff_2k.jpg',
      nor: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/sparse_grass/sparse_grass_nor_gl_2k.jpg',
      rough: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/sparse_grass/sparse_grass_rough_2k.jpg',
      ao: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/sparse_grass/sparse_grass_ao_2k.jpg'
    },
    {
      dir: 'dirt',
      name: 'rocky_trail',
      diff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/rocky_trail/rocky_trail_diff_2k.jpg',
      nor: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/rocky_trail/rocky_trail_nor_gl_2k.jpg',
      rough: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/rocky_trail/rocky_trail_rough_2k.jpg',
      ao: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/rocky_trail/rocky_trail_ao_2k.jpg'
    },
    {
      dir: 'rock',
      name: 'cliff_side',
      diff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/cliff_side/cliff_side_diff_2k.jpg',
      nor: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/cliff_side/cliff_side_nor_gl_2k.jpg',
      rough: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/cliff_side/cliff_side_rough_2k.jpg',
      ao: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/cliff_side/cliff_side_ao_2k.jpg'
    },
    {
      dir: 'snow',
      name: 'snow_02',
      diff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/snow_02/snow_02_diff_2k.jpg',
      nor: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/snow_02/snow_02_nor_gl_2k.jpg',
      rough: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/snow_02/snow_02_rough_2k.jpg',
      ao: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/snow_02/snow_02_ao_2k.jpg'
    }
  ];

  for (const t of textureSets) {
    console.log(`\n[Textures] Downloading 2K PBR maps for ${t.dir} (${t.name})...`);
    const targetFolder = path.join(texturesDir, t.dir);
    ensureDir(targetFolder);

    await Promise.all([
      downloadFile(t.diff, path.join(targetFolder, 'color.jpg')),
      downloadFile(t.nor, path.join(targetFolder, 'normal.jpg')),
      downloadFile(t.rough, path.join(targetFolder, 'roughness.jpg')),
      downloadFile(t.ao, path.join(targetFolder, 'ao.jpg'))
    ]);
    console.log(`✓ Saved /public/textures/${t.dir}/ (color, normal, roughness, ao)`);
  }

  // 3. Bark & Foliage Textures for realistic conifer trees
  console.log('\n[Foliage & Bark] Downloading pine bark and twig needle textures...');
  const barkFolder = path.join(texturesDir, 'bark');
  ensureDir(barkFolder);
  await Promise.all([
    downloadFile('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/pine_bark/pine_bark_diff_2k.jpg', path.join(barkFolder, 'color.jpg')),
    downloadFile('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/pine_bark/pine_bark_nor_gl_2k.jpg', path.join(barkFolder, 'normal.jpg')),
    downloadFile('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/pine_bark/pine_bark_rough_2k.jpg', path.join(barkFolder, 'roughness.jpg'))
  ]);
  console.log('✓ Saved /public/textures/bark/');

  const foliageFolder = path.join(texturesDir, 'foliage');
  ensureDir(foliageFolder);
  await Promise.all([
    downloadFile('https://dl.polyhaven.org/file/ph-assets/Models/png/1k/pine_tree_01/pine_tree_01_twig_diff_1k.png', path.join(foliageFolder, 'pine_branch.png')),
    downloadFile('https://dl.polyhaven.org/file/ph-assets/Models/png/1k/pine_tree_01/pine_tree_01_twig_nor_gl_1k.png', path.join(foliageFolder, 'pine_branch_normal.png'))
  ]);
  console.log('✓ Saved /public/textures/foliage/pine_branch.png');

  // 4. Rock Model: rock_07 (glTF + bin + textures)
  console.log('\n[Models] Downloading rock_07 3D model...');
  const rockModelFolder = path.join(modelsDir, 'rock_07');
  ensureDir(path.join(rockModelFolder, 'textures'));
  await Promise.all([
    downloadFile('https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/rock_07/rock_07_1k.gltf', path.join(rockModelFolder, 'rock_07_1k.gltf')),
    downloadFile('https://dl.polyhaven.org/file/ph-assets/Models/gltf/8k/rock_07/rock_07.bin', path.join(rockModelFolder, 'rock_07.bin')),
    downloadFile('https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/rock_07/rock_07_diff_1k.jpg', path.join(rockModelFolder, 'textures', 'rock_07_diff_1k.jpg')),
    downloadFile('https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/rock_07/rock_07_nor_gl_1k.jpg', path.join(rockModelFolder, 'textures', 'rock_07_nor_gl_1k.jpg')),
    downloadFile('https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/rock_07/rock_07_arm_1k.jpg', path.join(rockModelFolder, 'textures', 'rock_07_arm_1k.jpg'))
  ]);
  console.log('✓ Saved /public/models/rock_07/');

  console.log('\n🎉 All Poly Haven 2K assets downloaded and installed successfully!');
}

main().catch((err) => {
  console.error('Download error:', err);
  process.exit(1);
});
