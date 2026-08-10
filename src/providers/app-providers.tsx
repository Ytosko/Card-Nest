import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

import { AppThemeProvider } from '@/src/theme/theme-provider';
import { AuthProvider } from '@/src/features/auth/auth-provider';
import { CaptureQueueProvider } from '@/src/features/capture/capture-queue-provider';
import { SecurityProvider } from '@/src/features/security/security-provider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
    mutations: {
      retry: 1,
    },
  },
});

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <AuthProvider>
          <SecurityProvider>
            <CaptureQueueProvider>{children}</CaptureQueueProvider>
          </SecurityProvider>
        </AuthProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}
