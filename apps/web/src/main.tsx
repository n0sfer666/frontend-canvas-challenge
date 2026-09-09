import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@xyflow/react/dist/style.css';
import './index.css';
import { App } from './app/App';
import { AppProviders } from './app/AppProviders';

const container = document.getElementById('root');

if (container === null) throw new Error('В разметке нет элемента #root.');

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
