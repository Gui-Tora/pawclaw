import { useEffect, useMemo, useState } from 'react';
import type { SettingsSnapshot } from '../shared/desktop-api';

export function SettingsApp() {
  const [gateway, setGateway] = useState('Checking gateway…');
  const [settings, setSettings] = useState<SettingsSnapshot>();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('Changes are saved automatically.');
  const selectedPet = useMemo(
    () => settings?.pets.find((pet) => pet.id === settings.activePetId),
    [settings]
  );

  useEffect(() => {
    let active = true;
    void window.openclawPet.getGatewayStatus()
      .then((status) => {
        if (active) setGateway(`${status.connected ? 'Connected' : 'Not connected'}: ${status.endpoint}`);
      })
      .catch(() => { if (active) setGateway('Gateway status unavailable'); });
    void window.openclawPet.getSettings()
      .then((value) => { if (active) setSettings(value); })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : 'Settings unavailable.');
      });
    return () => { active = false; };
  }, []);

  async function update(patch: { activePetId?: string; alwaysOnTop?: boolean }) {
    if (saving) return;
    setSaving(true);
    setNotice('Saving…');
    try {
      setSettings(await window.openclawPet.updateSettings(patch));
      setNotice('Saved.');
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : 'Settings could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="panel settings-panel">
      <header>
        <strong>Settings</strong>
        <span>PawClaw</span>
      </header>
      <section className="settings-list">
        <div className="setting">
          <label htmlFor="active-pet">Active pet</label>
          <select
            disabled={!settings || saving}
            id="active-pet"
            onChange={(event) => void update({ activePetId: event.target.value })}
            value={settings?.activePetId ?? ''}
          >
            {!settings && <option value="">Loading…</option>}
            {settings?.pets.map((pet) => (
              <option key={pet.id} value={pet.id}>{pet.name} · {pet.species}</option>
            ))}
          </select>
        </div>
        <div className="setting setting--inline">
          <div>
            <label htmlFor="always-on-top">Always on top</label>
            <p>Keep the pet above normal windows and the Windows taskbar.</p>
          </div>
          <input
            checked={settings?.alwaysOnTop ?? false}
            disabled={!settings || saving}
            id="always-on-top"
            onChange={(event) => void update({ alwaysOnTop: event.target.checked })}
            type="checkbox"
          />
        </div>
        <div className="setting">
          <label>Gateway</label>
          <output>{gateway}</output>
        </div>
        {selectedPet?.attribution && (
          <div className="setting">
            <label>Artwork credit</label>
            <output>{selectedPet.attribution.creator}<br />{selectedPet.attribution.source}</output>
          </div>
        )}
      </section>
      <small>{notice}</small>
      <p className="muted">Tokens remain in the Electron main process. The renderer never receives them.</p>
    </main>
  );
}
