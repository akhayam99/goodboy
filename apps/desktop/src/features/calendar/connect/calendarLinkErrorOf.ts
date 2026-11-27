type Params = {
  readonly url: string;
};

const SECURE_PROTOCOLS: ReadonlyArray<string> = ['https:', 'webcal:'];

export const calendarLinkErrorOf = ({ url }: Params): string | null => {
  const trimmed = url.trim();
  if (trimmed === '') {
    return 'Paste the calendar link first.';
  }
  if (!URL.canParse(trimmed)) {
    return 'This is not a link. Paste the full address, starting with https://.';
  }
  const parsed = new URL(trimmed);
  if (!SECURE_PROTOCOLS.includes(parsed.protocol)) {
    return 'Only https links are kept. Use the https address of the calendar.';
  }
  if (parsed.hostname === '') {
    return 'This link has no host. Paste the full address, starting with https://.';
  }
  return null;
};
