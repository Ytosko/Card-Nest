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

function sanitizeErrorString(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[a-zA-Z0-9_-]{20,}/gu, '[redacted]')
    .replace(/[\r\n]+/gu, ' ')
    .trim()
    .slice(0, 300);
}

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

  const error = sanitizeErrorString(body.error);
  const errorCode = sanitizeErrorString(body.errorCode);
  const errorDescription = sanitizeErrorString(body.errorDescription);
  const errorUri = sanitizeErrorString(body.errorUri);

  const logData = {
    correlationId,
    event,
    codePresent: Boolean(body.codePresent),
    hashTokensPresent: Boolean(body.hashTokensPresent),
    searchTokensPresent: Boolean(body.searchTokensPresent),
    errorPresent: Boolean(body.errorPresent || error || errorCode || errorDescription),
    errorKind: typeof body.errorKind === 'string' ? body.errorKind : undefined,
    format: typeof body.format === 'string' ? body.format : undefined,
    error,
    errorCode,
    errorDescription,
    errorUri,
    timestamp: new Date().toISOString(),
  };

  console.log(
    `[OAuth Diagnostic POST] correlationId=${logData.correlationId} event=${logData.event} codePresent=${logData.codePresent} hashTokensPresent=${logData.hashTokensPresent} format=${logData.format ?? 'none'} errorKind=${logData.errorKind ?? 'none'} error="${logData.error}" error_code="${logData.errorCode}" error_description="${logData.errorDescription}" error_uri="${logData.errorUri}" timestamp="${logData.timestamp}"`,
  );

  return NextResponse.json({ ok: true }, { headers: responseHeaders });
}
