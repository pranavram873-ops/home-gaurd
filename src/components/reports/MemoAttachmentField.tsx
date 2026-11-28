'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import Image from 'next/image';
import { Icon } from '@/components/ui/Icon';
import { DocumentScanner } from '@/components/reports/DocumentScanner';

export function MemoAttachmentField({
  photo,
  document,
  busy = false,
  onAttach,
  onRemove,
}: {
  photo: string | null;
  document: string | null;
  busy?: boolean;
  onAttach: (file: File) => Promise<void>;
  onRemove: () => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const isBusy = busy || processing;

  async function attach(file?: File) {
    if (!file) return;
    setProcessing(true);
    try {
      await onAttach(file);
    } finally {
      setProcessing(false);
    }
  }

  function chooseGallery(event?: ChangeEvent<HTMLInputElement>) {
    if (event) {
      const file = event.target.files?.[0];
      event.target.value = '';
      void attach(file);
    } else {
      setScannerOpen(false);
      window.setTimeout(() => galleryRef.current?.click(), 0);
    }
  }

  return (
    <div className="space-y-2">
      {photo ? (
        <div className="flex items-center gap-3 rounded-lg bg-surface-container-low p-2">
          <Image src={photo} alt="Scanned memo preview" width={96} height={68} unoptimized className="h-16 w-24 shrink-0 rounded-md border border-outline-variant object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-primary">Memo image attached</p>
            {document ? (
              <a href={document} download="home-guard-memo.pdf" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary underline underline-offset-2">
                <Icon icon="picture_as_pdf" size={15} /> Download PDF
              </a>
            ) : <p className="mt-1 text-xs text-error">PDF is missing. Remove and scan the memo again.</p>}
            <button type="button" onClick={onRemove} disabled={isBusy} className="mt-1 block text-xs font-bold text-error underline disabled:opacity-50">Remove attachment</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setScannerOpen(true)} disabled={isBusy} className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-3 text-sm font-semibold text-primary transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60">
            {isBusy ? <Icon icon="sync" size={18} className="animate-spin" /> : <Icon icon="document_scanner" size={18} />}
            {isBusy ? 'Preparing image and PDF…' : 'Take memo photo'}
          </button>
          <button type="button" onClick={() => chooseGallery()} disabled={isBusy} className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-3 text-sm font-semibold text-primary transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60">
            <Icon icon="add_photo_alternate" size={18} /> Choose from gallery
          </button>
          <input ref={galleryRef} type="file" accept="image/*" aria-label="Choose a memo image" className="hidden" onChange={chooseGallery} />
        </div>
      )}
      {scannerOpen && (
        <DocumentScanner
          onClose={() => setScannerOpen(false)}
          onUseGallery={() => chooseGallery()}
          onConfirm={(file) => {
            setScannerOpen(false);
            void attach(file);
          }}
        />
      )}
    </div>
  );
}
