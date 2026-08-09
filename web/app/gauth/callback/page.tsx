import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';

import { GoogleAuthCallbackClient } from './client';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function GoogleAuthCallbackPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedParams = await searchParams;
  const headerList = await headers();

  const userAgent = headerList.get('user-agent') ?? 'unknown';
  const host = headerList.get('host') ?? 'cardnest.ytosko.dev';

  const codeParam = resolvedParams.code;
  const errorParam = resolvedParams.error ?? resolvedParams.error_code;

  const codePresent = Array.isArray(codeParam) ? Boolean(codeParam[0]) : Boolean(codeParam);
  const errorPresent = Array.isArray(errorParam) ? Boolean(errorParam[0]) : Boolean(errorParam);

  const correlationId = `req_${randomUUID().replace(/-/gu, '').slice(0, 8)}`;
  const timestamp = new Date().toISOString();

  // Sanitized server stdout log — NEVER logs codes, tokens, or credentials
  console.log(
    `[OAuth Server GET /gauth/callback] correlationId=${correlationId} host=${host} path=/gauth/callback codePresent=${codePresent} errorPresent=${errorPresent} userAgent="${userAgent.slice(0, 80)}" timestamp="${timestamp}"`,
  );

  return <GoogleAuthCallbackClient correlationId={correlationId} />;
}
