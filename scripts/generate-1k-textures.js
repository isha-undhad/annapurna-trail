const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const TEXTURE_DIR = path.join(__dirname, '..', 'public', 'textures');

async function processDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await processDir(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const base = path.basename(entry.name, ext);
      if ((ext === '.jpg' || ext === '.png') && !base.endsWith('_1k')) {
        const outName = `${base}_1k${ext}`;
        const outPath = path.join(dir, outName);
        if (!fs.existsSync(outPath)) {
          console.log(`Generating 1K for ${entry.name} -> ${outName}`);
          if (ext === '.jpg') {
            await sharp(fullPath)
              .resize(1024, 1024, { fit: 'cover' })
              .jpeg({ quality: 85 })
              .toFile(outPath);
          } else {
            await sharp(fullPath)
              .resize(1024, 1024, { fit: 'cover' })
              .png({ compressionLevel: 8 })
              .toFile(outPath);
          }
        }
      }
    }
  }
}

async function main() {
  console.log('Generating 1K texture variants for Low quality mode...');
  await processDir(TEXTURE_DIR);
  console.log('1K textures ready.');
}

main().catch(err => {
  console.error('Error generating 1K textures:', err);
  process.exit(1);
});
