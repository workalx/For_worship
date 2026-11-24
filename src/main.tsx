import '@fontsource-variable/geist';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { takeShared } from './library/shareTarget';
import { takeSongSelectHash } from './songselect/hashImport';

const shared = takeShared();
const songSelectHash = takeSongSelectHash();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App shared={shared} songSelectHash={songSelectHash} />
  </StrictMode>,
);
