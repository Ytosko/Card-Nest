import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const allowedEvents = new Set([
  'callback_loaded',
  'parameters_inspected',
  'code_present',
  'hash_tokens_present',
  'deep_link_constructed',
  'deep_link_attempted',
  'deep_link_timeout',
  'callback_error',
]);

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
};

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400, headers: responseHeaders });
  }

  const correlationId = typeof body.correlationId === 'string' ? body.correlationId.slice(0, 36) : 'unknown';
  const event = typeof body.event === 'string' ? body.event : 'unknown';

  if (!allowedEvents.has(event)) {
    return NextResponse.json({ ok: false, message: 'Disallowed event' }, { status: 400, headers: responseHeaders });
  }

  // Sanitized server stdout log for Coolify visibility — NEVER logs secrets/tokens
  const logData = {
    correlationId,
    event,
    codePresent: Boolean(body.codePresent),
    hashTokensPresent: Boolean(body.hashTokensPresent),
    searchTokensPresent: Boolean(body.searchTokensPresent),
    errorPresent: Boolean(body.errorPresent),
    errorKind: typeof body.errorKind === 'string' ? body.errorKind : undefined,
    format: typeof body.format === 'string' ? body.format : undefined,
    timestamp: new Date().toISOString(),
  };

  console.log(
    `[OAuth Diagnostic POST] correlationId=${logData.correlationId} event=${logData.event} codePresent=${logData.codePresent} hashTokensPresent=${logData.hashTokensPresent} format=${logData.format ?? 'none'} errorKind=${logData.errorKind ?? 'none'} timestamp="${logData.timestamp}"`,
  );

  return NextResponse.json({ ok: true }, { headers: responseHeaders });
}
