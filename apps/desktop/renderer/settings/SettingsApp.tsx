import { useEffect, useMemo, useState } from 'react';
import { resolveSpriteLayout } from '@pawclaw/pet-engine';
import type { PetAnimationLayout, PetAnimationState, PetCalibration } from '@pawclaw/shared';
import { PetRenderer } from '../pet/PetRenderer';
import type { SettingsSnapshot } from '../shared/desktop-api';

const motionModeLabels = {
  disabled: 'Sin movimiento automatico',
  manual: 'Solo posicion manual',
  taskbar: 'Pasear por la barra de tareas'
} as const;

function hasCalibration(calibration: PetCalibration): boolean {
  return calibration.scale !== undefined || Object.keys(calibration.animations ?? {}).length > 0;
}

export function SettingsApp() {
  const [gateway, setGateway] = useState('Comprobando Gateway...');
  const [settings, setSettings] = useState<SettingsSnapshot>();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('Los cambios se guardan automaticamente.');
  const [draftCalibration, setDraftCalibration] = useState<PetCalibration>({});
  const [selectedState, setSelectedState] = useState<PetAnimationState>('idle');
  const [playing, setPlaying] = useState(true);
  const [previewFrame, setPreviewFrame] = useState(0);
  const selectedPet = useMemo(
    () => settings?.pets.find((pet) => pet.id === settings.activePetId),
    [settings]
  );
  const manifest = settings?.activePetManifest;
  const animationStates = useMemo(
    () => manifest ? Object.keys(manifest.animations) as PetAnimationState[] : [],
    [manifest]
  );
  const animation = manifest?.animations[selectedState] ?? manifest?.animations.idle;
  const currentLayout = useMemo(
    () => animation ? resolveSpriteLayout(animation, draftCalibration.animations?.[selectedState]) : undefined,
    [animation, draftCalibration.animations, selectedState]
  );

  useEffect(() => {
    let active = true;
    const loadSettings = () => window.openclawPet.getSettings()
      .then((value) => { if (active) setSettings(value); })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : 'Ajustes no disponibles.');
      });
    void window.openclawPet.getGatewayStatus()
      .then((status) => {
        if (active) setGateway(`${status.connected ? 'Conectado' : 'Sin conexion'} · ${status.endpoint}`);
      })
      .catch(() => { if (active) setGateway('Estado del Gateway no disponible'); });
    void loadSettings();
    const unsubscribeSettings = window.openclawPet.onSettingsChanged(() => void loadSettings());
    return () => {
      active = false;
      unsubscribeSettings();
    };
  }, []);

  useEffect(() => {
    if (!settings || !manifest) return;
    setDraftCalibration(settings.petCalibrations[settings.activePetId] ?? {});
    setSelectedState((current) => animationStates.includes(current) ? current : 'idle');
  }, [animationStates, manifest, settings]);

  useEffect(() => {
    setPreviewFrame(0);
  }, [selectedState, animation?.src]);

  useEffect(() => {
    if (!playing || !animation || animation.frames === 1) return;
    const interval = window.setInterval(() => {
      setPreviewFrame((current) => {
        const next = current + 1;
        return next < animation.frames ? next : animation.loop ? 0 : current;
      });
    }, 1000 / animation.fps);
    return () => window.clearInterval(interval);
  }, [animation?.fps, animation?.frames, animation?.loop, animation?.src, playing]);

  async function update(patch: Partial<Pick<SettingsSnapshot, 'activePetId' | 'alwaysOnTop' | 'motionMode' | 'petCalibrations'>>) {
    if (saving) return;
    setSaving(true);
    setNotice('Guardando...');
    try {
      setSettings(await window.openclawPet.updateSettings(patch));
      setNotice('Guardado.');
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : 'No se pudieron guardar los ajustes.');
    } finally {
      setSaving(false);
    }
  }

  function updateLayout(patch: Partial<PetAnimationLayout>) {
    setDraftCalibration((current) => ({
      ...current,
      animations: {
        ...current.animations,
        [selectedState]: { ...current.animations?.[selectedState], ...patch }
      }
    }));
  }

  async function applyCalibration() {
    if (!settings) return;
    const petCalibrations = { ...settings.petCalibrations };
    if (hasCalibration(draftCalibration)) petCalibrations[settings.activePetId] = draftCalibration;
    else delete petCalibrations[settings.activePetId];
    await update({ petCalibrations });
  }

  async function resetCalibration() {
    if (!settings) return;
    const petCalibrations = { ...settings.petCalibrations };
    delete petCalibrations[settings.activePetId];
    setDraftCalibration({});
    await update({ petCalibrations });
  }

  const scale = draftCalibration.scale ?? manifest?.scale ?? 1;

  return (
    <section className="settings-panel">
      <section className="settings-list">
        <div className="setting">
          <label htmlFor="active-pet">Companero</label>
          <select
            disabled={!settings || saving}
            id="active-pet"
            onChange={(event) => void update({ activePetId: event.target.value })}
            value={settings?.activePetId ?? ''}
          >
            {!settings && <option value="">Cargando...</option>}
            {settings?.pets.map((pet) => (
              <option key={pet.id} value={pet.id}>{pet.name} · {pet.species}</option>
            ))}
          </select>
        </div>
        <div className="setting setting--inline">
          <div>
            <label htmlFor="always-on-top">Siempre encima</label>
            <p>Mantiene la mascota visible sobre las demas ventanas.</p>
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
          <label htmlFor="motion-mode">Movimiento</label>
          <select
            disabled={!settings || saving}
            id="motion-mode"
            onChange={(event) => void update({ motionMode: event.target.value as SettingsSnapshot['motionMode'] })}
            value={settings?.motionMode ?? 'manual'}
          >
            {Object.entries(motionModeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <p>El paseo funciona en barras inferiores visibles; se detiene con alertas, reposo o pantallas sin espacio reservado.</p>
        </div>
        {manifest && animation && currentLayout && (
          <section className="setting sprite-calibration">
            <div>
              <label htmlFor="animation-state">Calibracion de sprite</label>
              <p>Estos ajustes se aplican solo a {manifest.name} y no modifican su pet.json.</p>
            </div>
            <div className="sprite-preview" aria-label="Previsualizacion de la animacion">
              <span className="sprite-preview__ground" />
              <PetRenderer
                animationState={selectedState}
                calibration={draftCalibration}
                frame={previewFrame}
                manifest={manifest}
                mood="idle"
                playing={false}
              />
            </div>
            <div className="sprite-controls">
              <label htmlFor="animation-state">Animacion</label>
              <select
                id="animation-state"
                onChange={(event) => setSelectedState(event.target.value as PetAnimationState)}
                value={selectedState}
              >
                {animationStates.map((state) => <option key={state} value={state}>{state}</option>)}
              </select>
              <div className="sprite-controls__row">
                <button onClick={() => setPlaying((current) => !current)} type="button">
                  {playing ? 'Pausar' : 'Reproducir'}
                </button>
                <output>Frame {previewFrame + 1} de {animation.frames}</output>
              </div>
              <label htmlFor="sprite-frame">Frame</label>
              <input
                disabled={playing}
                id="sprite-frame"
                max={animation.frames - 1}
                min="0"
                onChange={(event) => setPreviewFrame(Number(event.target.value))}
                type="range"
                value={previewFrame}
              />
              <label htmlFor="sprite-scale">Escala: {scale.toFixed(2)}x</label>
              <input
                id="sprite-scale"
                max="16"
                min="0.25"
                onChange={(event) => setDraftCalibration((current) => ({ ...current, scale: Number(event.target.value) }))}
                step="0.25"
                type="range"
                value={scale}
              />
              <div className="sprite-controls__grid">
                <label>Offset X<input max="4096" min="-4096" onChange={(event) => updateLayout({ offsetX: Number(event.target.value) })} type="number" value={currentLayout.offsetX} /></label>
                <label>Offset Y<input max="4096" min="-4096" onChange={(event) => updateLayout({ offsetY: Number(event.target.value) })} type="number" value={currentLayout.offsetY} /></label>
                <label>Anchor X<input max={animation.frameWidth} min="0" onChange={(event) => updateLayout({ anchorX: Number(event.target.value) })} type="number" value={currentLayout.anchorX} /></label>
                <label>Ground Y<input max={animation.frameHeight} min="0" onChange={(event) => updateLayout({ groundY: Number(event.target.value) })} type="number" value={currentLayout.groundY} /></label>
                <label>Recorte superior<input max={animation.frameHeight - currentLayout.crop.bottom - 1} min="0" onChange={(event) => updateLayout({ crop: { ...currentLayout.crop, top: Number(event.target.value) } })} type="number" value={currentLayout.crop.top} /></label>
                <label>Recorte inferior<input max={animation.frameHeight - currentLayout.crop.top - 1} min="0" onChange={(event) => updateLayout({ crop: { ...currentLayout.crop, bottom: Number(event.target.value) } })} type="number" value={currentLayout.crop.bottom} /></label>
                <label>Recorte izquierdo<input max={animation.frameWidth - currentLayout.crop.right - 1} min="0" onChange={(event) => updateLayout({ crop: { ...currentLayout.crop, left: Number(event.target.value) } })} type="number" value={currentLayout.crop.left} /></label>
                <label>Recorte derecho<input max={animation.frameWidth - currentLayout.crop.left - 1} min="0" onChange={(event) => updateLayout({ crop: { ...currentLayout.crop, right: Number(event.target.value) } })} type="number" value={currentLayout.crop.right} /></label>
              </div>
              <div className="sprite-controls__row">
                <button disabled={saving} onClick={() => void applyCalibration()} type="button">Aplicar calibracion</button>
                <button className="button--secondary" disabled={saving} onClick={() => void resetCalibration()} type="button">Restablecer</button>
              </div>
            </div>
          </section>
        )}
        <div className="setting">
          <label>Gateway</label>
          <output>{gateway}</output>
        </div>
        {selectedPet?.attribution && (
          <div className="setting">
            <label>Creditos del arte</label>
            <output>{selectedPet.attribution.creator}<br />{selectedPet.attribution.source}</output>
          </div>
        )}
      </section>
      <small>{notice}</small>
      <p className="muted">El token permanece en el proceso principal de Electron y nunca se expone a React.</p>
    </section>
  );
}
