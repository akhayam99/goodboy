import { describe, expect, it } from 'vitest';
import { calendarLinkErrorOf } from './calendarLinkErrorOf';

describe('calendarLinkErrorOf', () => {
  it('accepts an https link and a webcal link', () => {
    expect(calendarLinkErrorOf({ url: 'https://calendar.northwind.example/basic.ics' })).toBeNull();
    expect(calendarLinkErrorOf({ url: ' webcal://calendar.acme.example/team.ics ' })).toBeNull();
  });

  it('refuses a link that is not https', () => {
    expect(calendarLinkErrorOf({ url: 'http://calendar.northwind.example/basic.ics' })).toBe(
      'Only https links are kept. Use the https address of the calendar.',
    );
    expect(calendarLinkErrorOf({ url: 'file:///Users/harborline/basic.ics' })).toBe(
      'Only https links are kept. Use the https address of the calendar.',
    );
  });

  it('asks for a link when the field is empty or not a link', () => {
    expect(calendarLinkErrorOf({ url: '   ' })).toBe('Paste the calendar link first.');
    expect(calendarLinkErrorOf({ url: 'calendar.northwind.example' })).toBe(
      'This is not a link. Paste the full address, starting with https://.',
    );
  });
});
