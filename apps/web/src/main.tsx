import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.js';
import './styles.css';

// The startup diagnostic runs outside React. Mark the moment the application
// module has actually started, rather than waiting for a deferred effect that
// can arrive late on a cold mobile WebKit launch.
document.documentElement.dataset.laojieMounted = 'true';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
