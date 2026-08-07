export type AuthLinkResult =
  | {
      kind: 'session';
      accessToken: string;
      refreshToken: string;
      flowType: string | null;
    }
  | { kind: 'code'; code: string; flowType: string | null }
  | { kind: 'error'; message: string; code: string | null }
  | { kind: 'invalid' };

function readParams(url: string) {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
  const hashParams = new URLSearchParams(hash);

  hashParams.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });

  return params;
}

export function parseAuthLink(url: string): AuthLinkResult {
  try {
    const params = readParams(url);
    const error = params.get('error_description') ?? params.get('error');
    const errorCode = params.get('error_code');
    const flowType = params.get('type') ?? params.get('flow');

    if (error) {
      return {
        kind: 'error',
        code: errorCode,
        message: error,
      };
    }

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken && refreshToken) {
      return { kind: 'session', accessToken, refreshToken, flowType };
    }

    const code = params.get('code');
    if (code) return { kind: 'code', code, flowType };

    return { kind: 'invalid' };
  } catch {
    return { kind: 'invalid' };
  }
}
