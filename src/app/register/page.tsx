import { redirect } from 'next/navigation';

export default function RegistrationPage(): never {
  redirect('/login');
}
