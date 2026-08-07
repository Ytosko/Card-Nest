export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    {
      status: 'healthy',
      service: 'card-nest-web',
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
