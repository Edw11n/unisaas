import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth-session';

export default async function HomePage() {
  const { token } = await getServerSession();

  if (token) {
    redirect('/pos');
  } else {
    redirect('/login');
  }
}

