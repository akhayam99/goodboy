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

  it('does not read a status reply that names a past confirmation as a question', () => {
    const text = [
      'No, la PR non è stata creata. Il branch `nw/settle-rounding` è solo locale: nessun push e nessuna PR, perché i passaggi precedenti aspettavano la tua conferma.',
      '',
      'Io qui sono in modalità review in sola lettura, quindi non posso pushare né aprire la PR. Passo il lavoro a un implementer che la apre come draft.',
    ].join('\n');
    expect(extractProseQuestion({ assistantText: text })).toBeNull();
    expect(
      extractProseQuestion({
        assistantText: text.split('\n\n')[0] ?? '',
      }),
    ).toBeNull();
  });

  it('does not read an earlier wait on an approval as a request', () => {
    const text = 'The earlier steps were waiting for your approval, so nothing was pushed.';
    expect(extractProseQuestion({ assistantText: text })).toBeNull();
  });

  it('still finds a present wait on an approval', () => {
    const text = 'Tests are green.\n\nI am waiting for your approval before I push.';
    expect(extractProseQuestion({ assistantText: text })).toBe(
      'I am waiting for your approval before I push.',
    );
  });

  it('finds a plain imperative ask', () => {
    const text = 'Migration is ready.\n\nPlease confirm the target schema.';
    expect(extractProseQuestion({ assistantText: text })).toBe('Please confirm the target schema.');
  });

  it('ignores an ask that is followed by a closing report paragraph', () => {
    const text = [
      'Do you want me to keep the old alias?',
      '',
      'I kept it and ran the suite, 759 tests green.',
    ].join('\n');
    expect(extractProseQuestion({ assistantText: text })).toBeNull();
  });

  it('keeps only the asking sentences when the paragraph is long', () => {
    const filler = 'Checked every table and every formatter again. '.repeat(15);
    const text = `${filler}Shall I push now?`;
    expect(extractProseQuestion({ assistantText: text })).toBe('Shall I push now?');
  });
});
