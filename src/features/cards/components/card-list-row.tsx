import React from 'react';

import { CompactContactRow, type CompactContactRowProps } from '@/src/features/cards/components/compact-contact-row';

export function CardListRow(props: CompactContactRowProps) {
  return <CompactContactRow {...props} />;
}
