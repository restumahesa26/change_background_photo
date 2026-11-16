'use client';

import React, { useSyncExternalStore } from 'react';
import { Camera, Sparkles, Moon, Sun } from 'lucide-react';

function subscribeToTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

function getThemeSnapshot() {
  return document.documentElement.classList.contains('dark');
}

function getServerThemeSnapshot() {
  return false;
}

export default function Header() {
  const isDark = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  );

  const toggleDarkMode = () => {
    const nextDark = !isDark;
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-sm transition-transform hover:scale-105">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-white">
                StudioPasfoto<span className="text-neutral-400 dark:text-neutral-500">.ai</span>
              </h1>
              <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Passport Photo AI Background Changer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* AI Status Indicator */}
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/60 px-3 py-1 text-xs text-neutral-600 dark:text-neutral-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span className="font-medium">MediaPipe Active</span>
              <Sparkles className="h-3 w-3 text-amber-500" />
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all shadow-3xs"
            >
              {isDark ? (
                <Sun className="h-4 w-4 text-amber-400 transition-transform rotate-0 hover:rotate-45" />
              ) : (
                <Moon className="h-4 w-4 text-neutral-600 transition-transform rotate-0 hover:-rotate-12" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
