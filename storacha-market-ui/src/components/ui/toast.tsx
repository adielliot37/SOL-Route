'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  toasts: Toast[]
  showToast: (message: string, type?: ToastType) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(7)
    const newToast: Toast = { id, message, type }
    
    setToasts((prev) => [...prev, newToast])
    
    // Auto remove after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const bgColors = {
    success: 'bg-green-600/90 border-green-500',
    error: 'bg-red-600/90 border-red-500',
    info: 'bg-blue-600/90 border-blue-500',
    warning: 'bg-yellow-600/90 border-yellow-500',
  }

  const iconColors = {
    success: 'text-green-200',
    error: 'text-red-200',
    info: 'text-blue-200',
    warning: 'text-yellow-200',
  }

  return (
    <div
      className={`
        ${bgColors[toast.type]}
        border rounded-lg shadow-lg p-4 pr-10
        backdrop-blur-sm text-white
        flex items-start gap-3
        min-w-[300px] max-w-md
      `}
      style={{
        animation: 'slideIn 0.3s ease-out'
      }}
    >
      <div className="flex-1">
        <p className="text-sm font-medium leading-relaxed">{toast.message}</p>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className={`
          ${iconColors[toast.type]}
          hover:opacity-70 transition-opacity
          flex-shrink-0 mt-0.5
        `}
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

