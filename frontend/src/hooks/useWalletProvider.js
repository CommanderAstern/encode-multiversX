import { useState, useEffect } from 'react';
import { ExtensionProvider } from "@multiversx/sdk-extension-provider";

function useWalletProvider() {
  // Get wallet provider instance
  const walletProvider = ExtensionProvider.getInstance();

  // Effect to initialize provider
  useEffect(() => {
    async function initProvider() {
      try {
        await walletProvider.init();
        if (walletProvider.account && walletProvider.account.address !== '') {
        }
      } catch (error) {
        console.error("Error initializing provider:", error);
      }
    }
    initProvider();
  }, []);

  return walletProvider;
}

export default useWalletProvider;
