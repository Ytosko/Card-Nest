import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

const aasa = {
  webcredentials: {
    apps: ['dev.ytosko.cardnest'],
  },
  applinks: {
    apps: [],
    details: [
      {
        appID: 'dev.ytosko.cardnest',
        paths: ['*'],
      },
    ],
  },
};

export function GET() {
  return NextResponse.json(aasa, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
