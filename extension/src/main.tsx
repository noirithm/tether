import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadSession } from './persist';
import './index.css';

const root = createRoot(document.getElementById('root')!);

// the saved steps are read first, so the panel opens on them instead of flashing the goal prompt
void loadSession().then((saved) => {
  root.render(
    <StrictMode>
      <App saved={saved} />
    </StrictMode>,
  );
});
