import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth-session';

export async function GET(_req: NextRequest) {
  const { token, user } = await getServerSession();

  if (!token || !user) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user,
    // Proveer token de forma controlada a solicitudes del cliente hacia API Gateway
    token,
  });
}

