export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createChallenge } from '@/lib/auth';

export async function GET() {
  const challenge = await createChallenge();
  return NextResponse.json({ challenge });
}
