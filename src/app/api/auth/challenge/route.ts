import { NextResponse } from 'next/server';
import { createChallenge } from '@/lib/auth';

export async function GET() {
  const challenge = createChallenge();
  return NextResponse.json({ challenge });
}
