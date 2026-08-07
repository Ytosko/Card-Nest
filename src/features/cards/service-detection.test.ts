import { describe, expect, it } from 'vitest';

import { phoneItemSchema, KNOWN_SERVICES } from './card-schema';

describe('Messaging & Payment Service Detection', () => {
  it('validates phone items with WhatsApp service metadata', () => {
    const item = phoneItemSchema.parse({
      phone: '+8801712345678',
      label: 'Mobile',
      service: 'whatsapp',
      serviceLabel: 'WhatsApp',
      isPrimary: true,
    });

    expect(item.service).toBe('whatsapp');
    expect(item.serviceLabel).toBe('WhatsApp');
    expect(item.phone).toBe('+8801712345678');
  });

  it('validates bKash payment account service metadata', () => {
    const item = phoneItemSchema.parse({
      phone: '01712345678',
      label: 'Personal',
      service: 'bkash',
      serviceLabel: 'bKash',
      isPrimary: false,
    });

    expect(item.service).toBe('bkash');
    expect(item.serviceLabel).toBe('bKash');
  });

  it('validates IMO service metadata', () => {
    const item = phoneItemSchema.parse({
      phone: '+8801812345678',
      label: 'Mobile',
      service: 'imo',
      serviceLabel: 'IMO',
      isPrimary: false,
    });

    expect(item.service).toBe('imo');
    expect(item.serviceLabel).toBe('IMO');
  });

  it('handles unknown local custom service', () => {
    const item = phoneItemSchema.parse({
      phone: '01912345678',
      label: 'Work',
      service: 'other',
      serviceLabel: 'Upay',
      isPrimary: false,
    });

    expect(item.service).toBe('other');
    expect(item.serviceLabel).toBe('Upay');
  });

  it('handles card with no service labels', () => {
    const item = phoneItemSchema.parse({
      phone: '+1 555-0199',
      label: 'Work',
      service: '',
      serviceLabel: '',
      isPrimary: true,
    });

    expect(item.service).toBe('');
    expect(item.serviceLabel).toBe('');
  });

  it('includes KNOWN_SERVICES registry entries for UI selectors', () => {
    const keys = KNOWN_SERVICES.map((s) => s.key);
    expect(keys).toContain('whatsapp');
    expect(keys).toContain('imo');
    expect(keys).toContain('bkash');
    expect(keys).toContain('telegram');
    expect(keys).toContain('nagad');
    expect(keys).toContain('rocket');
    expect(keys).toContain('viber');
    expect(keys).toContain('line');
    expect(keys).toContain('wechat');
    expect(keys).toContain('signal');
    expect(keys).toContain('messenger');
  });
});
