'use client';

import { DivisionChooser } from '@/components/attendance/DivisionChooser';
import { DivisionProvider } from '@/lib/attendance/divisionContext';
import { Sidebar } from '@/components/layout/Sidebar';

export default function InchargeDivisionsPage() {
  // No command bar here: the greeting banner inside the chooser is this
  // screen's header, matching the Stitch mockup.
  return (
    <DivisionProvider>
      <div className="min-h-screen bg-surface text-on-surface">
        <Sidebar />
        <div className="flex min-h-screen min-w-0 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pl-[264px] lg:pb-0">
          <main className="mx-auto w-full max-w-[640px] flex-1 px-4 py-5 sm:max-w-[1440px] sm:px-6 sm:py-7 lg:px-8">
            <DivisionChooser />
          </main>
        </div>
      </div>
    </DivisionProvider>
  );
}
