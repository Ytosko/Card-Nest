import Image from 'next/image';
import Link from 'next/link';

export function Brand({ className = '', href = '/' }: { className?: string; href?: string }) {
  return (
    <Link aria-label="Card Nest home" className={`focus-ring inline-flex items-center gap-3 rounded-xl ${className}`.trim()} href={href}>
      <Image alt="" aria-hidden height={44} priority src="/logo.svg" width={44} />
      <span className="text-xl font-bold tracking-[-0.03em]">Card Nest</span>
    </Link>
  );
}
