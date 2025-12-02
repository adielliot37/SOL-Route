// src/app/providers.tsx
'use client'
import { ReactNode, useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import type { Adapter } from '@solana/wallet-adapter-base'
import '@solana/wallet-adapter-react-ui/styles.css'
import { ToastProvider } from '@/components/ui/toast'

export function Providers({ children }: { children: ReactNode }) {
  const wallets = useMemo(() => {
    const phantom = new PhantomWalletAdapter()
    const solflare = new SolflareWalletAdapter()
    
    // Create array with explicit wallets only
    const walletList: Adapter[] = [phantom, solflare]
    
    // Remove duplicates based on adapter name and URL to prevent React key conflicts
    // This ensures each wallet has a unique identifier
    const seen = new Map<string, Adapter>()
    walletList.forEach((wallet) => {
      const name = wallet.name || wallet.constructor.name
      // Use name as key, but also check if we've seen this exact adapter instance
      if (!seen.has(name)) {
        seen.set(name, wallet)
      }
    })
    
    return Array.from(seen.values())
  }, [])
  
  return (
    <ConnectionProvider endpoint={process.env.NEXT_PUBLIC_SOLANA_RPC!}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}