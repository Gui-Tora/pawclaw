import { useEffect, useMemo, useState } from 'react';
import { resolveSpriteLayout } from '@pawclaw/pet-engine';
import type { PetAnimationLayout, PetAnimationState, PetCalibration, PetSpriteInsets } from '@pawclaw/shared';
import { PetRenderer } from '../pet/PetRenderer';
import type { SettingsSnapshot } from '../shared/desktop-api';

type CropEdge = 'top' | 'right' | 'bottom' | 'left' | 'move';

interface DragState {
  edge: CropEdge;
  startX: number;
  startY: number;
  crop: PetSpriteInsets;
  offsetX: number;
  offsetY: number;
}

function assetUrl(petId: string, source: string): string {
  return `pawclaw-pet://${petId}/${source.split('/').map(encodeURIComponent).join('/')}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function hasCalibration(calibration: PetCalibration): boolean {
  return calibration.scale !== undefined
    || calibration.flipX !== undefined
    || calibration.motionSpeed !== undefined
    || Object.keys(calibration.animations ?? {}).length > 0;
}

export function CropEditorApp({ initialState }: { initialState: string | null }) {
  const [settings, setSettings] = useState<SettingsSnapshot>();
  const [state, setState] = useState<PetAnimationState>(initialState as PetAnimationState || 'idle');
  const [draft, setDraft] = useState<PetCalibration>({});
  const [drag, setDrag] = useState<DragState>();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('Arrastra los bordes para recortar o el centro para desplazar el arte. El ajuste se aplica a todos los frames.');
  const manifest = settings?.activePetManifest;
  const animation = manifest?.animations[state] ?? manifest?.animations.idle;
  const layout = useMemo(
    () => animation ? resolveSpriteLayout(animation, draft.animations?.[state]) : undefined,
    [animation, draft.animations, state]
  );
  const displayScale = animation
    ? Math.min(5, 760 / (animation.frameWidth * animation.frames), 390 / animation.frameHeight)
    : 1;

  useEffect(() => {
    let active = true;
    const load = () => window.openclawPet.getSettings()
      .then((next) => {
        if (!active) return;
        setSettings(next);
        setDraft(next.petCalibrations[next.activePetId] ?? {});
        setState((current) => next.activePetManifest.animations[current] ? current : 'idle');
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : 'No se pudo cargar el editor.');
      });
    void load();
    const unsubscribe = window.openclawPet.onSettingsChanged(() => void load());
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => window.openclawPet.onCropEditorState(setState), []);

  function updateCrop(crop: PetSpriteInsets) {
    if (!animation) return;
    const safeCrop = {
      top: clamp(crop.top, 0, animation.frameHeight - 1),
      right: clamp(crop.right, 0, animation.frameWidth - 1),
      bottom: clamp(crop.bottom, 0, animation.frameHeight - 1),
      left: clamp(crop.left, 0, animation.frameWidth - 1)
    };
    safeCrop.right = clamp(safeCrop.right, 0, animation.frameWidth - safeCrop.left - 1);
    safeCrop.bottom = clamp(safeCrop.bottom, 0, animation.frameHeight - safeCrop.top - 1);
    setDraft((current) => ({
      ...current,
      animations: {
        ...current.animations,
        [state]: { ...current.animations?.[state], crop: safeCrop }
      }
    }));
  }

  function updateOffset(offset: Pick<PetAnimationLayout, 'offsetX' | 'offsetY'>) {
    setDraft((current) => ({
      ...current,
      animations: {
        ...current.animations,
        [state]: { ...current.animations?.[state], ...offset }
      }
    }));
  }

  function beginDrag(edge: CropEdge, event: React.PointerEvent<HTMLButtonElement>) {
    if (!layout) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      edge,
      startX: event.clientX,
      startY: event.clientY,
      crop: layout.crop,
      offsetX: layout.offsetX,
      offsetY: layout.offsetY
    });
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag || !animation) return;
    const deltaX = Math.round((event.clientX - drag.startX) / displayScale);
    const deltaY = Math.round((event.clientY - drag.startY) / displayScale);
    if (drag.edge === 'move') {
      updateOffset({
        offsetX: clamp(drag.offsetX + deltaX, -4096, 4096),
        offsetY: clamp(drag.offsetY + deltaY, -4096, 4096)
      });
      return;
    }
    const crop = { ...drag.crop };
    if (drag.edge === 'left') crop.left = clamp(drag.crop.left + deltaX, 0, animation.frameWidth - drag.crop.right - 1);
    if (drag.edge === 'right') crop.right = clamp(drag.crop.right - deltaX, 0, animation.frameWidth - drag.crop.left - 1);
    if (drag.edge === 'top') crop.top = clamp(drag.crop.top + deltaY, 0, animation.frameHeight - drag.crop.bottom - 1);
    if (drag.edge === 'bottom') crop.bottom = clamp(drag.crop.bottom - deltaY, 0, animation.frameHeight - drag.crop.top - 1);
    updateCrop(crop);
  }

  async function apply() {
    if (!settings) return;
    setSaving(true);
    setNotice('Guardando recorte...');
    try {
      const petCalibrations = { ...settings.petCalibrations };
      if (hasCalibration(draft)) petCalibrations[settings.activePetId] = draft;
      else delete petCalibrations[settings.activePetId];
      await window.openclawPet.updateSettings({ petCalibrations });
      setNotice('Recorte aplicado.');
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : 'No se pudo guardar el recorte.');
    } finally {
      setSaving(false);
    }
  }

  function resetCrop() {
    setDraft((current) => {
      const animations = { ...current.animations };
      const next = { ...animations[state] };
      delete next.crop;
      if (Object.keys(next).length === 0) delete animations[state];
      else animations[state] = next;
      return { ...current, animations };
    });
  }

  if (!manifest || !animation || !layout) {
    return <main className="crop-editor-shell"><p>Cargando editor de recorte...</p></main>;
  }

  const sheetWidth = Math.round(animation.frameWidth * animation.frames * displayScale);
  const sheetHeight = Math.round(animation.frameHeight * displayScale);
  const cropX = layout.crop.left * displayScale;
  const cropY = layout.crop.top * displayScale;
  const cropWidth = layout.viewWidth * displayScale;
  const cropHeight = layout.viewHeight * displayScale;

  return (
    <main className="crop-editor-shell">
      <header className="crop-editor-header">
        <div>
          <span>Editor de recorte · {manifest.name}</span>
          <h1>{state}</h1>
        </div>
        <button onClick={() => void window.openclawPet.closeCropEditor()} type="button">Cerrar</button>
      </header>
      <section className="crop-editor-body">
        <div className="crop-editor-workspace">
          <p>El marco naranja se repite para cada frame. Arrastra sus bordes en el primer frame; el tirador central desplaza el arte sin invadir el frame vecino.</p>
          <div
            className="crop-sheet"
            onPointerMove={moveDrag}
            onPointerUp={() => setDrag(undefined)}
            onPointerCancel={() => setDrag(undefined)}
            style={{ width: sheetWidth, height: sheetHeight }}
          >
            <img alt="Sprite sheet completo" draggable={false} src={assetUrl(manifest.id, animation.src)} style={{ width: sheetWidth, height: sheetHeight }} />
            {Array.from({ length: animation.frames }, (_, index) => (
              <div
                className="crop-sheet__frame"
                key={index}
                style={{
                  left: index * animation.frameWidth * displayScale + cropX,
                  top: cropY,
                  width: cropWidth,
                  height: cropHeight
                }}
              >
                {index === 0 && (
                  <>
                    {(['top', 'right', 'bottom', 'left'] as const).map((edge) => (
                      <button
                        aria-label={`Ajustar recorte ${edge}`}
                        className={`crop-handle crop-handle--${edge}`}
                        key={edge}
                        onPointerDown={(event) => beginDrag(edge, event)}
                        type="button"
                      />
                    ))}
                    <button
                      aria-label="Desplazar arte"
                      className="crop-handle crop-handle--move"
                      onPointerDown={(event) => beginDrag('move', event)}
                      type="button"
                    >
                      +
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        <aside className="crop-editor-sidebar">
          <label htmlFor="crop-animation">Animacion</label>
          <select id="crop-animation" onChange={(event) => setState(event.target.value as PetAnimationState)} value={state}>
            {Object.keys(manifest.animations).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <div className="crop-values">
            <label>Superior<input min="0" max={animation.frameHeight - layout.crop.bottom - 1} onChange={(event) => updateCrop({ ...layout.crop, top: Number(event.target.value) })} type="number" value={layout.crop.top} /></label>
            <label>Inferior<input min="0" max={animation.frameHeight - layout.crop.top - 1} onChange={(event) => updateCrop({ ...layout.crop, bottom: Number(event.target.value) })} type="number" value={layout.crop.bottom} /></label>
            <label>Izquierdo<input min="0" max={animation.frameWidth - layout.crop.right - 1} onChange={(event) => updateCrop({ ...layout.crop, left: Number(event.target.value) })} type="number" value={layout.crop.left} /></label>
            <label>Derecho<input min="0" max={animation.frameWidth - layout.crop.left - 1} onChange={(event) => updateCrop({ ...layout.crop, right: Number(event.target.value) })} type="number" value={layout.crop.right} /></label>
            <label>Desplazar X<input min="-4096" max="4096" onChange={(event) => updateOffset({ offsetX: clamp(Number(event.target.value), -4096, 4096) })} type="number" value={layout.offsetX} /></label>
            <label>Desplazar Y<input min="-4096" max="4096" onChange={(event) => updateOffset({ offsetY: clamp(Number(event.target.value), -4096, 4096) })} type="number" value={layout.offsetY} /></label>
          </div>
          <label>Resultado</label>
          <div className="crop-editor-preview"><PetRenderer animationState={state} calibration={draft} manifest={manifest} mood="idle" /></div>
          <div className="crop-editor-actions">
            <button disabled={saving} onClick={() => void apply()} type="button">Aplicar</button>
            <button className="button--secondary" disabled={saving} onClick={resetCrop} type="button">Restablecer recorte</button>
          </div>
          <small>{notice}</small>
        </aside>
      </section>
    </main>
  );
}
