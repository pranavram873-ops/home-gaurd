import { redirect } from 'next/navigation';

// The public landing page was retired: the portal opens directly on the
// Supervision Portal Login. Someone who is already signed in does not stop
// there either — `src/middleware.ts` moves an active session off /login to the
// dashboard its profile role allows.
export default function RootPage(): never {
  redirect('/login');
}
