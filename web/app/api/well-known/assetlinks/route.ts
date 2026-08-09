import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const assetLinks = [
  {
    relation: [
      'delegate_permission/common.handle_all_urls',
      'delegate_permission/common.get_login_creds',
    ],
    target: {
      namespace: 'android_app',
      package_name: 'dev.ytosko.cardnest',
      sha256_cert_fingerprints: [
        '06:AB:5F:9B:3E:78:A8:B2:82:72:B0:4E:9E:30:83:DB:59:B7:9E:85:AC:1E:29:D3:02:44:3E:5C:33:E4:FE:9C',
      ],
    },
  },
];

export function GET() {
  return NextResponse.json(assetLinks, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
