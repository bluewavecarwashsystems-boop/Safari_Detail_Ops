/**
 * PWA Install Instructions Page
 * Detects iOS vs Android and shows appropriate instructions
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

type Platform = 'ios' | 'android' | 'desktop' | 'unknown';

export default function InstallPage() {
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    setIsInstalled(isStandalone);

    if (isIOS) {
      setPlatform('ios');
    } else if (isAndroid) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    // Listen for install prompt (Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstalled(true);
    }
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--sf-bg)' }}>
        <div className="max-w-md w-full bg-white rounded-2xl p-8 text-center" style={{ boxShadow: 'var(--sf-shadow)', border: '1px solid var(--sf-border)' }}>
          <div className="mb-6">
            <div className="w-20 h-20 bg-[#DCFCE7] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-10 h-10 text-[#1F8A5B]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--sf-ink)' }}>
              Already Installed!
            </h1>
            <p style={{ color: 'var(--sf-muted)' }}>
              Safari Detail Ops is already installed on your device
            </p>
          </div>

          <Link
            href="/en"
            className="block w-full h-14 bg-[#F47C20] hover:bg-[#DB6E1C] text-white font-bold rounded-xl transition-colors flex items-center justify-center"
          >
            Open Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--sf-bg)' }}>
      {/* Header */}
      <header className="bg-white shadow-sm border-b-[3px] border-[#F47C20]" style={{ boxShadow: 'var(--sf-shadow)' }}>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-2">
            <Image src="/safari-logo.png" alt="Safari Car Wash" width={60} height={60} className="object-contain" />
            <div>
              <h1 className="text-3xl font-bold" style={{ color: 'var(--sf-ink)' }}>Install Safari Detail Ops</h1>
              <p className="mt-1" style={{ color: 'var(--sf-muted)' }}>
                Get quick access from your home screen
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* iOS Instructions */}
        {platform === 'ios' && (
          <div className="bg-white rounded-2xl p-6 mb-6" style={{ boxShadow: 'var(--sf-shadow)', border: '1px solid var(--sf-border)' }}>
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-[#F47C20] rounded-xl flex items-center justify-center mr-4">
                <svg
                  className="w-7 h-7 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--sf-ink)' }}>iPhone/iPad Instructions</h2>
                <p className="text-sm" style={{ color: 'var(--sf-muted)' }}>Using Safari browser</p>
              </div>
            </div>

            <ol className="space-y-4 mt-6">
              <li className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-[#F47C20] text-white rounded-full flex items-center justify-center mr-3 font-bold">
                  1
                </span>
                <div>
                  <p className="font-medium" style={{ color: 'var(--sf-ink)' }}>Tap the Share button</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--sf-muted)' }}>
                    Look for{' '}
                    <svg
                      className="inline w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z" />
                    </svg>{' '}
                    at the bottom of Safari
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-[#F47C20] text-white rounded-full flex items-center justify-center mr-3 font-bold">
                  2
                </span>
                <div>
                  <p className="font-medium" style={{ color: 'var(--sf-ink)' }}>Scroll down and tap "Add to Home Screen"</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--sf-muted)' }}>
                    You may need to scroll down in the share menu
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-[#F47C20] text-white rounded-full flex items-center justify-center mr-3 font-bold">
                  3
                </span>
                <div>
                  <p className="font-medium" style={{ color: 'var(--sf-ink)' }}>Tap "Add" in the top right</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--sf-muted)' }}>
                    The app icon will appear on your home screen
                  </p>
                </div>
              </li>
            </ol>
          </div>
        )}

        {/* Android Instructions */}
        {platform === 'android' && (
          <div className="bg-white rounded-2xl p-6 mb-6" style={{ boxShadow: 'var(--sf-shadow)', border: '1px solid var(--sf-border)' }}>
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-[#1F8A5B] rounded-xl flex items-center justify-center mr-4">
                <svg
                  className="w-7 h-7 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.43 11.43 0 00-8.94 0L5.65 5.67c-.19-.28-.54-.37-.83-.22-.3.16-.42.54-.26.85l1.84 3.18C4.8 11.16 3.5 13.84 3.5 16.5h17c0-2.66-1.3-5.34-2.9-7.02zM7 14.5c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm10 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--sf-ink)' }}>Android Instructions</h2>
                <p className="text-sm" style={{ color: 'var(--sf-muted)' }}>Using Chrome browser</p>
              </div>
            </div>

            {deferredPrompt ? (
              <div className="mt-6">
                <button
                  onClick={handleInstallClick}
                  className="w-full h-16 bg-[#1F8A5B] hover:bg-[#166B47] text-white font-bold rounded-xl text-lg transition-colors flex items-center justify-center gap-3"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Install App Now
                </button>
              </div>
            ) : (
              <ol className="space-y-4 mt-6">
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 bg-[#1F8A5B] text-white rounded-full flex items-center justify-center mr-3 font-bold">
                    1
                  </span>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--sf-ink)' }}>Tap the menu button</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--sf-muted)' }}>
                      Three dots ⋮ in the top right corner
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 bg-[#1F8A5B] text-white rounded-full flex items-center justify-center mr-3 font-bold">
                    2
                  </span>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--sf-ink)' }}>Tap "Add to Home screen"</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--sf-muted)' }}>
                      Or "Install app" if available
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 bg-[#1F8A5B] text-white rounded-full flex items-center justify-center mr-3 font-bold">
                    3
                  </span>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--sf-ink)' }}>Tap "Add" or "Install"</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--sf-muted)' }}>
                      The app will be added to your home screen
                    </p>
                  </div>
                </li>
              </ol>
            )}
          </div>
        )}

        {/* Desktop */}
        {platform === 'desktop' && (
          <div className="bg-white rounded-2xl p-6 mb-6" style={{ boxShadow: 'var(--sf-shadow)', border: '1px solid var(--sf-border)' }}>
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-[#F47C20] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--sf-ink)' }}>Mobile Device Required</h2>
              <p className="mb-6" style={{ color: 'var(--sf-muted)' }}>
                This app is designed for mobile devices only.
                <br />
                Please open this page on your iPhone or Android phone.
              </p>
              <div className="bg-[#FAF6EF] rounded-lg p-4 mt-6" style={{ border: '1px solid var(--sf-border)' }}>
                <p className="text-sm mb-2" style={{ color: 'var(--sf-muted)' }}>Scan with your phone:</p>
                <div className="w-48 h-48 bg-white rounded-lg mx-auto flex items-center justify-center" style={{ border: '1px solid var(--sf-border)' }}>
                  <p className="text-xs" style={{ color: 'var(--sf-muted)' }}>QR Code Placeholder</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="text-center">
          <Link
            href="/en"
            className="inline-block px-8 py-4 bg-[#F47C20] hover:bg-[#DB6E1C] text-white font-bold rounded-xl text-lg transition-colors"
          >
            Open Dashboard
          </Link>
          <p className="text-sm mt-4" style={{ color: 'var(--sf-muted)' }}>
            You can install the app later from the browser menu
          </p>
        </div>
      </div>
    </div>
  );
}
