import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { NativeControls } from './native-controls';
import { applyTheme, readTheme } from './theme';
import './index.css';
import './styles/game-colors.css';
import './style.css';

applyTheme(readTheme());
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <NativeControls />
  </StrictMode>,
);
