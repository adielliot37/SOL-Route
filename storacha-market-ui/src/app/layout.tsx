// src/app/layout.tsx
import './globals.css'
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import { cn } from '@/lib/utils'
import { Providers } from './providers'
import Navbar from '@/components/navbar'
import { Toaster } from 'sonner'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata = {
  title: 'SOL ROUTE - Onchain Digital Marketplace',
  description: 'The underground marketplace for encrypted digital assets. Trade anonymously on Solana.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn('h-full', spaceGrotesk.variable, jetbrainsMono.variable)}>
      <body className={cn(
        'min-h-screen bg-black text-foreground antialiased',
        spaceGrotesk.className
      )}>
        <Providers>
          <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black pointer-events-none" />
          <div className="relative z-10">
            <Navbar />
            <main className="flex-1 w-full mx-auto px-4">
              {children}
            </main>
            <footer className="border-t border-purple-500/10 py-8 mt-20">
              <div className="max-w-7xl mx-auto px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                    <span className="text-sm text-purple-300/60 font-mono">
                      ONLINE • {new Date().getFullYear()}
                    </span>
                  </div>
                  <span className="text-xs text-purple-300/40 font-mono tracking-wider">
                    SOL ROUTE © ALL RIGHTS RESERVED
                  </span>
                </div>
              </div>
            </footer>
          </div>
          <Toaster richColors closeButton position="top-right" />
        </Providers>
      </body>
    </html>
  )
}