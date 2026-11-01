import { NextRequest, NextResponse } from 'next/server';
import { setServerSession } from '@/lib/auth-session';

const API_GATEWAY_URL =
  process.env.API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3000/api/v1';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const backendRes = await fetch(`${API_GATEWAY_URL}/auth/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    if (data.accessToken && data.user) {
      await setServerSession(data.accessToken, data.user, data.expiresIn || 3600);
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { message: `Error conectando con el servicio de activación: ${err.message}` },
      { status: 503 },
    );
  }
}

