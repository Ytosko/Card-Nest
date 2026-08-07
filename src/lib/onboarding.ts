const onboardingKey = 'cardnest.onboarding.complete.v1';

export function hasCompletedOnboarding() {
  try {
    return globalThis.localStorage?.getItem(onboardingKey) === 'true';
  } catch {
    return false;
  }
}

export function completeOnboarding() {
  globalThis.localStorage?.setItem(onboardingKey, 'true');
}
