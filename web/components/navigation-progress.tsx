'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type ProgressPhase = 'idle' | 'active' | 'finishing';

export function startCardNestNavigation() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('cardnest:navigation-start'));
}

export function NavigationProgress() {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const finishTimer = useRef<number | null>(null);
  const safetyTimer = useRef<number | null>(null);
  const [phase, setPhase] = useState<ProgressPhase>('idle');

  useEffect(() => {
    const start = () => {
      if (finishTimer.current) window.clearTimeout(finishTimer.current);
      if (safetyTimer.current) window.clearTimeout(safetyTimer.current);
      window.dispatchEvent(new Event('cardnest:web-safe-transition'));
      setPhase('active');
      safetyTimer.current = window.setTimeout(() => {
        setPhase('finishing');
        finishTimer.current = window.setTimeout(() => setPhase('idle'), 220);
      }, 10_000);
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(target instanceof HTMLAnchorElement) || target.target === '_blank' || target.hasAttribute('download')) return;
      const destination = new URL(target.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;
      start();
    };
    window.addEventListener('cardnest:navigation-start', start);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('cardnest:navigation-start', start);
      document.removeEventListener('click', onClick, true);
      if (finishTimer.current) window.clearTimeout(finishTimer.current);
      if (safetyTimer.current) window.clearTimeout(safetyTimer.current);
    };
  }, []);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (safetyTimer.current) window.clearTimeout(safetyTimer.current);
    const frame = requestAnimationFrame(() => {
      setPhase((current) => current === 'idle' ? current : 'finishing');
      finishTimer.current = window.setTimeout(() => setPhase('idle'), 220);
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return <div aria-hidden className={`navigation-progress navigation-progress-${phase}`}><span /></div>;
}
