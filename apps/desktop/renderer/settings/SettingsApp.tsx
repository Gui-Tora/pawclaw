import { useEffect, useMemo, useState } from 'react';
import type { SettingsSnapshot } from '../shared/desktop-api';

export function SettingsApp() {
  const [gateway, setGateway] = useState('Comprobando Gateway…');
  const [settings, setSettings] = useState<SettingsSnapshot>();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('Los cambios se guardan automáticamente.');
  const selectedPet = useMemo(
    () => settings?.pets.find((pet) => pet.id === settings.activePetId),
    [settings]
  );

  useEffect(() => {
    let active = true;
    void window.openclawPet.getGatewayStatus()
      .then((status) => {
        if (active) setGateway(`${status.connected ? 'Conectado' : 'Sin conexión'} · ${status.endpoint}`);
      })
      .catch(() => { if (active) setGateway('Estado del Gateway no disponible'); });
    void window.openclawPet.getSettings()
      .then((value) => { if (active) setSettings(value); })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : 'Ajustes no disponibles.');
      });
    return () => { active = false; };
  }, []);

  async function update(patch: { activePetId?: string; alwaysOnTop?: boolean }) {
    if (saving) return;
    setSaving(true);
    setNotice('Guardando…');
    try {
      setSettings(await window.openclawPet.updateSettings(patch));
      setNotice('Guardado.');
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : 'No se pudieron guardar los ajustes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-panel">
      <section className="settings-list">
        <div className="setting">
          <label htmlFor="active-pet">Compañero</label>
          <select
            disabled={!settings || saving}
            id="active-pet"
            onChange={(event) => void update({ activePetId: event.target.value })}
            value={settings?.activePetId ?? ''}
          >
            {!settings && <option value="">Cargando…</option>}
            {settings?.pets.map((pet) => (
              <option key={pet.id} value={pet.id}>{pet.name} · {pet.species}</option>
            ))}
          </select>
        </div>
        <div className="setting setting--inline">
          <div>
            <label htmlFor="always-on-top">Siempre encima</label>
            <p>Mantiene la mascota visible sobre las demás ventanas.</p>
          </div>
          <input
            checked={settings?.alwaysOnTop ?? true}
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
            <label>Créditos del arte</label>
            <output>{selectedPet.attribution.creator}<br />{selectedPet.attribution.source}</output>
          </div>
        )}
      </section>
      <small>{notice}</small>
      <p className="muted">El token permanece en el proceso principal de Electron y nunca se expone a React.</p>
    </section>
  );
}
