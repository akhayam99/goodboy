import type { DiffComment } from '@goodboy/types';

export const buildNotesPrompt = (notes: ReadonlyArray<DiffComment>): string => {
  const byFile = new Map<string, DiffComment[]>();
  for (const note of notes) {
    const list = byFile.get(note.filePath) ?? [];
    list.push(note);
    byFile.set(note.filePath, list);
  }
  const sections: string[] = [];
  for (const [file, items] of byFile) {
    const lines = items.map((note) => {
      const anchor = note.anchor
        ? note.anchor.endLineNumber
          ? `[${note.anchor.side}:${note.anchor.lineNumber}-${note.anchor.endLineNumber}]`
          : `[${note.anchor.side}:${note.anchor.lineNumber}]`
        : '[file-level]';
      return `  - ${anchor} (id ${note.id}) ${note.body.replace(/\n+/g, ' ')}`;
    });
    sections.push(`### ${file}\n${lines.join('\n')}`);
  }
  const header = [
    'open review notes on these files. each note is anchored to a specific line of the diff.',
    '',
    '**mode: PROPOSE-ONLY**',
    '- do NOT modify any code.',
    '- for each note, produce: context, proposed fix (snippet), affected file/line.',
    '- end with a summary plan (note → fix) for me to approve.',
  ].join('\n');
  return `${header}\n\n${sections.join('\n\n')}`;
};
