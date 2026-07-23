import { createRoot } from 'react-dom/client';
import { PetApp } from './pet/PetApp';
import { TrayApp } from './tray/TrayApp';
import './styles.css';
import './shared/desktop-api';

const root = document.getElementById('root');

if (!root) throw new Error('Renderer root element was not found');

const view = new URLSearchParams(window.location.search).get('view');
createRoot(root).render(view === 'pet' ? <PetApp /> : <TrayApp />);
