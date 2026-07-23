import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { SettingsStore, defaultSettings } from '../dist/settings-store.js';

const directory = await mkdtemp(join(tmpdir(), 'pawclaw-settings-'));
const path = join(directory, 'settings.json');
const store = new SettingsStore(path);

after(() => rm(directory, { recursive: true, force: true }));

describe('SettingsStore', () => {
  it('returns defaults when no settings file exists', async () => {
    assert.deepEqual(await store.read(), defaultSettings);
  });

  it('persists valid partial updates', async () => {
    const saved = await store.update({ activePetId: 'ember', alwaysOnTop: false });
    assert.deepEqual(saved, { activePetId: 'ember', alwaysOnTop: false });
    assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), saved);
  });

  it('falls back safely when stored values are invalid', async () => {
    await writeFile(path, JSON.stringify({ activePetId: '../escape', alwaysOnTop: 'yes' }));
    assert.deepEqual(await store.read(), defaultSettings);
  });
});
