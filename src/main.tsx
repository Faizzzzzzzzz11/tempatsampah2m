import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

function renderApp() {
  const container = document.getElementById('root');
  if (container) {
    createRoot(container).render(<App />);
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      const el = document.getElementById('root') || document.body;
      createRoot(el).render(<App />);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderApp);
} else {
  renderApp();
}
