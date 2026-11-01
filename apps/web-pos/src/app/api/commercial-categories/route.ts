import { NextResponse } from 'next/server';

const API_GATEWAY_URL =
  process.env.API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3000/api/v1';

export async function GET() {
  try {
    const backendRes = await fetch(`${API_GATEWAY_URL}/commercial-categories`, {
      cache: 'no-store',
    });
    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err: any) {
    return NextResponse.json(
      { message: `Error cargando rubros comerciales: ${err.message}` },
      { status: 503 },
    );
  }
}

