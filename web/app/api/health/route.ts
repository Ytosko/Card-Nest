export const dynamic = 'force-dynamic';

export function GET() {
  const authVerificationConfigured = Boolean(
    process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_ANON_KEY?.trim(),
  );

  return Response.json(
    {
      status: authVerificationConfigured ? 'healthy' : 'configuration_required',
      service: 'card-nest-web',
      authVerificationConfigured,
      timestamp: new Date().toISOString(),
    },
    {
      status: authVerificationConfigured ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
