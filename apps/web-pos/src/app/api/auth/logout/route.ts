import { NextRequest, NextResponse } from 'next/server';
import { clearServerSession, getServerSession } from '@/lib/auth-session';

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export async function POST(_req: NextRequest) {
  try {
    const { token } = await getServerSession();

    if (token) {
      await fetch(`${API_GATEWAY_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }).catch(() => {});
    }

    await clearServerSession();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    await clearServerSession();
    return NextResponse.json({ success: true, message: err.message });
  }
}

