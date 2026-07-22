import { useEffect, useState } from 'react';
import type { PetAttribution } from '@pawclaw/shared';

export function SettingsApp() {
  const [gateway, setGateway] = useState('Checking gateway...');
  const [pet, setPet] = useState<{ name: string; attribution?: PetAttribution }>({ name: 'Loading…' });
  useEffect(() => {
    let active = true;
    window.openclawPet.getGatewayStatus()
      .then((status) => {
        if (active) setGateway(`${status.connected ? 'Connected' : 'Not connected'}: ${status.endpoint}`);
      })
      .catch(() => { if (active) setGateway('Gateway status unavailable'); });
    window.openclawPet.getPetStatus()
      .then(({ manifest }) => {
        if (active) setPet({ name: manifest.name, attribution: manifest.attribution });
      })
      .catch(() => { if (active) setPet({ name: 'Unavailable' }); });
    return () => { active = false; };
  }, []);
  return <main className="panel"><header><strong>Settings</strong><span>PawClaw</span></header><section className="setting"><label>Active pet</label><output>{pet.name}</output></section><section className="setting"><label>Gateway</label><output>{gateway}</output></section>{pet.attribution && <section className="setting"><label>Artwork credit</label><output>{pet.attribution.creator}<br />{pet.attribution.source}</output></section>}<p className="muted">Tokens remain in the Electron main process. The renderer never receives them.</p></main>;
}
