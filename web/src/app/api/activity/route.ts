import { NextResponse } from 'next/server';
import { readActivity } from '@/server/chain';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(readActivity());
}
