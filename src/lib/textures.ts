import * as THREE from 'three';

export type QualityLevel = 'low' | 'medium' | 'high';

/**
 * Resolves texture file path based on graphics quality setting.
 * In 'low' mode, selects 1K optimized variants to maximize mobile frame rate.
 * In 'medium' and 'high' mode, selects full 2K Poly Haven PBR textures.
 */
export function getTexturePath(category: string, filename: string, quality: QualityLevel): string {
  if (quality === 'low') {
    const extMatch = filename.match(/\.(jpg|png)$/);
    if (extMatch) {
      const ext = extMatch[0];
      const base = filename.slice(0, -ext.length);
      return `/textures/${category}/${base}_1k${ext}`;
    }
  }
  return `/textures/${category}/${filename}`;
}

/**
 * Configures texture filtering, mipmaps, anisotropy, and color space according to PBR standards.
 * - Color/Diffuse maps: sRGB color space
 * - Normal, Roughness, AO maps: Linear (NoColorSpace)
 */
export function configureTexture(
  texture: THREE.Texture,
  isColor: boolean,
  anisotropy = 8,
  repeatX = 1,
  repeatY = 1
): void {
  texture.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = Math.max(1, anisotropy);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.needsUpdate = true;
}
