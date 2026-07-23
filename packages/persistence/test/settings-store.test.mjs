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

  it('persists a truly partial update, preserving the other field', async () => {
    await store.update({ activePetId: 'ember', alwaysOnTop: false });
    const saved = await store.update({ alwaysOnTop: true });
    assert.deepEqual(saved, { activePetId: 'ember', alwaysOnTop: true });
    assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), saved);
  });

  it('reports the pre-patch settings from applyUpdate', async () => {
    await store.update({ activePetId: 'ember', alwaysOnTop: true });
    const { previous, settings } = await store.applyUpdate({ alwaysOnTop: false });
    assert.deepEqual(previous, { activePetId: 'ember', alwaysOnTop: true });
    assert.deepEqual(settings, { activePetId: 'ember', alwaysOnTop: false });
  });

  it('rejects invalid patch values without touching stored settings', async () => {
    await store.update({ activePetId: 'ember', alwaysOnTop: false });
    await assert.rejects(() => store.update({ activePetId: 'Not Valid!' }));
    await assert.rejects(() => store.update({ alwaysOnTop: 'yes' }));
    // The previously valid value must survive an invalid patch attempt.
    assert.deepEqual(await store.read(), { activePetId: 'ember', alwaysOnTop: false });
  });

  it('falls back safely when stored values are invalid', async () => {
    await writeFile(path, JSON.stringify({ activePetId: '../escape', alwaysOnTop: 'yes' }));
    assert.deepEqual(await store.read(), defaultSettings);
  });

  it('falls back safely when the stored file is corrupted JSON', async () => {
    await writeFile(path, '{ not json at all');
    assert.deepEqual(await store.read(), defaultSettings);
  });

  it('recovers from a corrupted file on the next update', async () => {
    await writeFile(path, '"garbage');
    const saved = await store.update({ alwaysOnTop: false });
    assert.deepEqual(saved, { ...defaultSettings, alwaysOnTop: false });
    assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), saved);
  });

  it('serializes concurrent updates without losing either field', async () => {
    await store.update({ activePetId: 'sol', alwaysOnTop: true });
    const [first, second] = await Promise.all([
      store.update({ activePetId: 'ember' }),
      store.update({ alwaysOnTop: false })
    ]);
    assert.equal(first.activePetId, 'ember');
    assert.equal(second.alwaysOnTop, false);
    // The write queue must merge both patches instead of last-write-wins.
    assert.deepEqual(await store.read(), { activePetId: 'ember', alwaysOnTop: false });
  });
});
