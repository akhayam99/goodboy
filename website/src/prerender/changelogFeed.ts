import { SITE } from '../site';
import { escapeHtml } from './escapeHtml';
import type { Release } from './RELEASES';

type Params = {
  readonly releases: readonly Release[];
};

const timestamp = (date: string) => `${date}T00:00:00Z`;

export const changelogFeed = ({ releases }: Params) => {
  const feedUrl = `${SITE.origin}${SITE.changelogFeed}`;
  const entries = releases.map((release) => {
    const url = `${SITE.origin}${SITE.release(release.version)}`;
    return [
      '  <entry>',
      `    <id>${url}</id>`,
      `    <title>Goodboy ${escapeHtml(release.version)}</title>`,
      `    <link href="${url}" />`,
      `    <updated>${timestamp(release.date)}</updated>`,
      `    <summary>${escapeHtml(release.summary)}</summary>`,
      '  </entry>',
    ].join('\n');
  });
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <id>${feedUrl}</id>`,
    '  <title>Goodboy changelog</title>',
    `  <link href="${SITE.origin}${SITE.changelog}" />`,
    `  <link rel="self" href="${feedUrl}" />`,
    `  <updated>${timestamp(releases[0]?.date ?? '1970-01-01')}</updated>`,
    '  <author><name>Goodboy</name></author>',
    ...entries,
    '</feed>',
    '',
  ].join('\n');
};
