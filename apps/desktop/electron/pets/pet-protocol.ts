import { protocol } from 'electron';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { resolvePetAsset } from './pet-files.js';

const contentTypes: Record<string, string> = {
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

export function registerPetAssetProtocol(): void {
  protocol.handle('pawclaw-pet', async (request) => {
    try {
      const url = new URL(request.url);
      const source = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      const assetPath = resolvePetAsset(url.hostname, source);
      const contentType = contentTypes[extname(assetPath).toLowerCase()];
      if (!contentType) return new Response('Unsupported pet asset', { status: 415 });
      const content = await readFile(assetPath);
      return new Response(new Uint8Array(content), { headers: { 'content-type': contentType } });
    } catch {
      return new Response('Pet asset not found', { status: 404 });
    }
  });
}
