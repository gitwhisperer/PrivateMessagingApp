import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { WalletProvider } from './wallet';

createRoot(document.getElementById('root') as HTMLElement).render(
  <WalletProvider>
    <App />
  </WalletProvider>
);
