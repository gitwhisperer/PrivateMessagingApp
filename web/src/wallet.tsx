import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppConfig, UserSession, showConnect, FinishedAuthData } from '@stacks/connect';

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

interface WalletCtx {
  userSession: UserSession;
  address?: string;
  signIn: () => void;
  signOut: () => void;
}

const Ctx = createContext<WalletCtx | null>(null);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | undefined>();

  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      const data = userSession.loadUserData();
      // Stacks address (testnet) typical path
      // @ts-ignore
      setAddress(data.profile?.stxAddress?.testnet || data.profile?.stxAddress?.mainnet);
    }
  }, []);

  const signIn = () => {
    showConnect({
      userSession,
      appDetails: { name: import.meta.env.VITE_APP_NAME || 'PMA', icon: import.meta.env.VITE_APP_ICON || '' },
      onFinish: (data: FinishedAuthData) => {
        const userData = userSession.loadUserData();
        // @ts-ignore
        setAddress(userData.profile?.stxAddress?.testnet || userData.profile?.stxAddress?.mainnet);
      },
      onCancel: () => console.log('Connect cancelled')
    });
  };

  const signOut = () => { userSession.signUserOut(); setAddress(undefined); };

  return <Ctx.Provider value={{ userSession, address, signIn, signOut }}>{children}</Ctx.Provider>;
};

export function useWallet() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('Wallet context missing');
  return ctx;
}
