import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.redirect(
    'https://api.farcaster.xyz/miniapps/hosted-manifest/019c6324-9b21-9e39-12d6-bac6836538fc',
    307
  );
}
