'use client';

import { DivisionChooser } from '@/components/attendance/DivisionChooser';

export default function AdminDivisionsPage() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="min-h-screen w-full">
        <main className="min-h-screen w-full px-4 py-5 sm:px-6 sm:py-7 lg:px-10 lg:py-8 xl:px-14">
          <DivisionChooser />
        </main>
      </div>
    </div>
  );
}
