import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';

import { GoogleAuthCallbackClient } from './client';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function sanitizeErrorString(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[a-zA-Z0-9_-]{20,}/gu, '[redacted]')
    .replace(/[\r\n]+/gu, ' ')
    .trim()
    .slice(0, 300);
}

export default async function GoogleAuthCallbackPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedParams = await searchParams;
  const headerList = await headers();

  const userAgent = headerList.get('user-agent') ?? 'unknown';
  const host = headerList.get('host') ?? 'cardnest.ytosko.dev';

  const codeParam = resolvedParams.code;
  const rawError = resolvedParams.error;
  const rawErrorCode = resolvedParams.error_code;
  const rawErrorDesc = resolvedParams.error_description;
  const rawErrorUri = resolvedParams.error_uri;

  const codePresent = Array.isArray(codeParam) ? Boolean(codeParam[0]) : Boolean(codeParam);

  const errorVal = sanitizeErrorString(Array.isArray(rawError) ? rawError[0] : rawError);
  const errorCodeVal = sanitizeErrorString(Array.isArray(rawErrorCode) ? rawErrorCode[0] : rawErrorCode);
  const errorDescVal = sanitizeErrorString(Array.isArray(rawErrorDesc) ? rawErrorDesc[0] : rawErrorDesc);
  const errorUriVal = sanitizeErrorString(Array.isArray(rawErrorUri) ? rawErrorUri[0] : rawErrorUri);

  const errorPresent = Boolean(errorVal || errorCodeVal || errorDescVal || errorUriVal);

  const correlationId = `req_${randomUUID().replace(/-/gu, '').slice(0, 8)}`;
  const timestamp = new Date().toISOString();

  // Sanitized server stdout log for Coolify visibility — NEVER logs codes, tokens, or credentials
  console.log(
    `[OAuth Server GET /gauth/callback] correlationId=${correlationId} host=${host} path=/gauth/callback codePresent=${codePresent} errorPresent=${errorPresent} error="${errorVal}" error_code="${errorCodeVal}" error_description="${errorDescVal}" error_uri="${errorUriVal}" userAgent="${userAgent.slice(0, 80)}" timestamp="${timestamp}"`,
  );

  return <GoogleAuthCallbackClient correlationId={correlationId} />;
}
