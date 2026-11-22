import '@fontsource-variable/geist';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { takeShared } from './library/shareTarget';

const shared = takeShared();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App shared={shared} />
  </StrictMode>,
);
