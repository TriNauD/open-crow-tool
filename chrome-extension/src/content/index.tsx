import { createRoot } from 'react-dom/client';
import App from './App';
import { STYLES } from './styles';

function mount() {
  if (document.getElementById('wtf-ext-host')) return;

  const host = document.createElement('div');
  host.id = 'wtf-ext-host';
  host.style.cssText =
    'all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647; pointer-events: none;';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = STYLES;
  shadow.appendChild(style);

  const container = document.createElement('div');
  shadow.appendChild(container);

  createRoot(container).render(<App />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
