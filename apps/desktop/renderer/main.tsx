import { createRoot } from 'react-dom/client';
import { ChatApp } from './chat/ChatApp';
import { PetApp } from './pet/PetApp';
import { SettingsApp } from './settings/SettingsApp';
import './styles.css';
import './shared/desktop-api';

const view = new URLSearchParams(window.location.search).get('view');
const App = view === 'chat' ? ChatApp : view === 'settings' ? SettingsApp : PetApp;
const root = document.getElementById('root');

if (!root) throw new Error('Renderer root element was not found');

createRoot(root).render(<App />);
