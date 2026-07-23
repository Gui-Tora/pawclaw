import { Menu, Tray, nativeImage, type BrowserWindow, type NativeImage } from 'electron';
import { getActivePetManifest, resolvePetAsset } from '../pets/pet-files.js';
import { readAppSettings } from '../settings/app-settings.js';
import { connection } from '../ipc/openclaw-ipc.js';

export interface TrayApp {
  tray: Tray;
  refresh(): Promise<void>;
  refreshTooltip(): Promise<void>;
}

interface TrayAppOptions {
  show(view: 'chat' | 'settings'): void;
  quit(): void;
  getWindow(): BrowserWindow | undefined;
  /**
   * True when the flyout was hidden moments ago. A tray click first blurs the
   * flyout (hiding it) and then fires `click`, which would otherwise reopen it.
   */
  wasRecentlyHidden(): boolean;
}

async function activePetImage(): Promise<NativeImage> {
  const settings = await readAppSettings();
  const manifest = await getActivePetManifest(settings.activePetId);
  const animation = manifest.animations.idle;
  const source = manifest.preview ?? animation.src;
  let image = nativeImage.createFromPath(resolvePetAsset(manifest.id, source));
  if (!manifest.preview && !image.isEmpty()) {
    image = image.crop({
      x: 0,
      y: 0,
      width: animation.frameWidth,
      height: animation.frameHeight
    });
  }
  if (image.isEmpty()) {
    throw new Error(`Tray icon could not be loaded for ${manifest.name}`);
  }
  return image.resize({ width: 32, height: 32, quality: 'best' });
}

async function trayImage(): Promise<NativeImage> {
  try {
    return await activePetImage();
  } catch (error) {
    // A broken pet asset must not take down the tray (and with it the app UI).
    console.error('[pawclaw] tray icon failed to load; using blank icon', error);
    return nativeImage.createEmpty();
  }
}

export async function createTrayApp(options: TrayAppOptions): Promise<TrayApp> {
  const tray = new Tray(await trayImage());
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir chat', click: () => options.show('chat') },
    { label: 'Ajustes', click: () => options.show('settings') },
    { type: 'separator' },
    { label: 'Salir de PawClaw', click: options.quit }
  ]));
  tray.on('click', () => {
    const window = options.getWindow();
    if (window && !window.isDestroyed() && window.isVisible()) window.hide();
    else if (!options.wasRecentlyHidden()) options.show('chat');
  });

  const api: TrayApp = {
    tray,
    async refresh() {
      tray.setImage(await trayImage());
      await api.refreshTooltip();
    },
    async refreshTooltip() {
      const status = connection.status();
      let name = 'OpenClaw';
      if (status.connected) {
        try {
          name = (await connection.getAgentIdentity()).name;
        } catch {
          // Keep the generic identity while the Gateway is reconnecting.
        }
      }
      tray.setToolTip(`PawClaw · ${name} · ${status.connected ? 'Conectado' : 'Sin conexión'}`);
    }
  };
  await api.refreshTooltip();
  return api;
}
