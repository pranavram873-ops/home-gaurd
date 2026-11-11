'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Icon } from '@/components/ui/Icon';

export function EvidencePhotoPreview({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => setPortalReady(true), []);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Enlarge ${alt}`} className="group block overflow-hidden rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <Image src={src} alt={alt} width={112} height={80} unoptimized className="h-20 w-28 rounded-lg border border-outline-variant/50 object-cover transition-transform group-hover:scale-105" />
        <span className="sr-only">Tap to enlarge</span>
      </button>
      {portalReady && open && createPortal(
        <div className="overlay-enter fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-label="Evidence photo" className="overlay-panel relative flex max-h-[95dvh] max-w-[95vw] items-center justify-center">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close enlarged photo" className="absolute -right-2 -top-12 rounded-full bg-white/15 p-2 text-white hover:bg-white/25 sm:right-0 sm:top-0 sm:-translate-y-12">
              <Icon icon="close" size={24} />
            </button>
            <Image src={src} alt={alt} width={1600} height={1200} unoptimized className="max-h-[88dvh] max-w-[95vw] rounded-xl object-contain shadow-2xl" />
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
