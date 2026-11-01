import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth-session';
import { PosTerminalView } from '@/components/PosTerminalView';

export default async function PosPage() {
  const { user, token } = await getServerSession();

  // Redirigir a login si no hay sesión activa en cookie segura
  if (!token) {
    redirect('/login');
  }

  return <PosTerminalView user={user} token={token} />;
}

