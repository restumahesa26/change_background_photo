'use client';

import React from 'react';
import { Camera, Sparkles } from 'lucide-react';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 text-white shadow-sm transition-transform hover:scale-105">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-neutral-900">
                StudioPasfoto<span className="text-neutral-400">.ai</span>
              </h1>
              <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                Passport Photo AI Background Changer
              </p>
            </div>
          </div>

          {/* AI Status Indicator */}
          <div className="flex items-center gap-2 rounded-full border border-neutral-100 bg-neutral-50 px-3 py-1 text-xs text-neutral-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="font-medium">MediaPipe Segmentation Active</span>
            <Sparkles className="h-3 w-3 text-amber-500" />
          </div>
        </div>
      </div>
    </header>
  );
}
