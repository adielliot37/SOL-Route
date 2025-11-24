'use client'
import { Button } from '@/components/ui/button'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'
import Link from 'next/link'

export default function Navbar() {
  const { setVisible } = useWalletModal()
  const { connected, publicKey } = useWallet()

  return (
    <header className="sticky top-0 z-50 border-b border-purple-500/10 bg-black/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
        <Link href="/" className="group flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-purple-500/20 blur-xl group-hover:bg-purple-500/30 transition-all" />
            <div className="relative w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tighter text-white group-hover:text-purple-300 transition-colors">
              SOL ROUTE
            </span>
            <span className="text-[10px] text-purple-400/60 font-mono tracking-widest -mt-1">
              ONCHAIN MARKETPLACE
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/create"
            className="text-sm font-medium text-purple-300/80 hover:text-purple-300 transition-colors relative group"
          >
            <span className="relative z-10">LIST ITEM</span>
            <div className="absolute inset-0 bg-purple-500/0 group-hover:bg-purple-500/10 rounded transition-all -m-2 p-2" />
          </Link>
          <Link
            href="/account"
            className="text-sm font-medium text-purple-300/80 hover:text-purple-300 transition-colors relative group"
          >
            <span className="relative z-10">DASHBOARD</span>
            <div className="absolute inset-0 bg-purple-500/0 group-hover:bg-purple-500/10 rounded transition-all -m-2 p-2" />
          </Link>

          {!connected ? (
            <Button
              size="sm"
              onClick={() => setVisible(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0 font-mono tracking-wider shadow-lg shadow-purple-500/25"
            >
              CONNECT
            </Button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-mono text-purple-300">
                {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
              </span>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}