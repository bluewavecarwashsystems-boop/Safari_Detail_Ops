/**
 * Toast Provider
 * 
 * Provides toast notification context for the entire app
 */

'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextValue {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(7);
    const toast: Toast = { id, message, type };
    
    setToasts(prev => [...prev, toast]);

    // Remove toast after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[9999] pointer-events-none">
        <div className="flex flex-col gap-2">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`
                pointer-events-auto px-6 py-3 rounded-lg shadow-lg text-white font-medium
                animate-in slide-in-from-right duration-300
                ${toast.type === 'success' ? 'bg-green-500' : ''}
                ${toast.type === 'error' ? 'bg-red-500' : ''}
                ${toast.type === 'info' ? 'bg-blue-500' : ''}
              `}
            >
              {toast.message}
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
