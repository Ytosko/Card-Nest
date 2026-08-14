import { QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

import { AIConfigProvider } from '@/src/features/ai/ai-config-provider';
import { AppThemeProvider } from '@/src/theme/theme-provider';
import { AuthProvider } from '@/src/features/auth/auth-provider';
import { CaptureQueueProvider } from '@/src/features/capture/capture-queue-provider';
import { SecurityProvider } from '@/src/features/security/security-provider';
import { UpdateProvider } from '@/src/features/updates/update-provider';
import { queryClient } from '@/src/lib/query-client';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <AuthProvider>
          <SecurityProvider>
            <UpdateProvider>
              <AIConfigProvider>
                <CaptureQueueProvider>{children}</CaptureQueueProvider>
              </AIConfigProvider>
            </UpdateProvider>
          </SecurityProvider>
        </AuthProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}
