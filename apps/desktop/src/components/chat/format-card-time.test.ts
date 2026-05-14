import { describe, expect, it } from 'vitest';
import { formatCardTime } from './format-card-time';

describe('formatCardTime', () => {
  it('renders ISO timestamps as HH:MM:SS', () => {
    const output = formatCardTime('2026-05-14T09:30:45.000Z');
    expect(output).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('includes hour, minute, and second fields', () => {
    const output = formatCardTime('2026-05-14T23:59:59.000Z');
    expect(output).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});
