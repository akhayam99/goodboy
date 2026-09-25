import { describe, expect, it } from 'vitest';
import { extractProseQuestion } from './prose-question';

const FORCE_PUSH_TURN = [
  'Build verde. Ora `yarn check` completo con Postgres.',
  '',
  '**push distruttivo da confermare**: il branch remoto ha una storia diversa. Serve:',
  '',
  '```',
  'git push --force-with-lease origin ak/admin-table-standardization',
  '```',
  '',
  'Confermi il force-push? Dopo procedo con: aggiornamento titolo/body PR, risoluzione thread, ri-richiesta review.',
].join('\n');

describe('extractProseQuestion', () => {
  it('finds an approval asked in prose at the end of the turn', () => {
    expect(extractProseQuestion({ assistantText: FORCE_PUSH_TURN })).toBe(
      'Confermi il force-push? Dopo procedo con: aggiornamento titolo/body PR, risoluzione thread, ri-richiesta review.',
    );
  });

  it('finds a confirmation request that does not end with a question mark', () => {
    const text = 'Tests are green.\n\nI need your approval before I run the migration on staging.';
    expect(extractProseQuestion({ assistantText: text })).toBe(
      'I need your approval before I run the migration on staging.',
    );
  });

  it('ignores a turn that only reports progress', () => {
    const text = 'Ran the suite, 759 tests green.\n\nNow running the build.';
    expect(extractProseQuestion({ assistantText: text })).toBeNull();
  });

  it('ignores a question asked early in the log and answered later', () => {
    const text = [
      'Why does the import fail? The alias points to the old folder.',
      '',
      'Fixed the alias.',
      '',
      'Build green, committing now.',
    ].join('\n');
    expect(extractProseQuestion({ assistantText: text })).toBeNull();
  });

  it('ignores question marks inside code blocks and control markers', () => {
    const text = [
      'Updated the regex.',
      '',
      '```ts',
      'const optional = /colou?r?/;',
      '```',
      '',
      '<<ctx-decision>>should we keep the old alias?<</ctx-decision>>',
    ].join('\n');
    expect(extractProseQuestion({ assistantText: text })).toBeNull();
  });

  it('keeps only the asking sentences when the paragraph is long', () => {
    const filler = 'Checked every table and every formatter again. '.repeat(15);
    const text = `${filler}Shall I push now?`;
    expect(extractProseQuestion({ assistantText: text })).toBe('Shall I push now?');
  });
});
