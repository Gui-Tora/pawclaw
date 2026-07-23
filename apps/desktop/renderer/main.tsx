import { createRoot } from 'react-dom/client';
import { PetApp } from './pet/PetApp';
import { CropEditorApp } from './settings/CropEditorApp';
import { TrayApp } from './tray/TrayApp';
import './styles.css';
import './shared/desktop-api';

const root = document.getElementById('root');

if (!root) throw new Error('Renderer root element was not found');

const parameters = new URLSearchParams(window.location.search);
const view = parameters.get('view');
createRoot(root).render(
  view === 'pet' ? <PetApp /> : view === 'crop-editor' ? <CropEditorApp initialState={parameters.get('state')} /> : <TrayApp />
);
