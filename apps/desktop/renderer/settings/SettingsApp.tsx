import { useEffect, useState } from 'react';

export function SettingsApp() {
  const [gateway, setGateway] = useState('Checking gateway...');
  useEffect(() => {
    let active = true;
    window.openclawPet.getGatewayStatus()
      .then((status) => {
        if (active) setGateway(`${status.connected ? 'Connected' : 'Not connected'}: ${status.endpoint}`);
      })
      .catch(() => { if (active) setGateway('Gateway status unavailable'); });
    return () => { active = false; };
  }, []);
  return <main className="panel"><header><strong>Settings</strong><span>PawClaw</span></header><section className="setting"><label>Active pet</label><output>Sol</output></section><section className="setting"><label>Gateway</label><output>{gateway}</output></section><p className="muted">Tokens remain in the Electron main process. The renderer never receives them.</p></main>;
}
