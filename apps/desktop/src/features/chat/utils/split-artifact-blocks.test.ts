import { describe, expect, it } from 'vitest';
import { splitArtifactText } from './split-artifact-blocks';

const BODY = '{"title":"Check of ledger-core","format":"markdown","content":"No shell."}';

describe('splitArtifactText', () => {
  it('replaces a trailing block after prose with one artifact segment', () => {
    const text = `Check incomplete.\n\n<<artifact v=1 kind=report>>\n${BODY}\n<</artifact>>\n`;
    const { segments } = splitArtifactText({ text });
    expect(segments.map((segment) => segment.kind)).toEqual(['prose', 'artifact']);
    expect(segments[1]).toMatchObject({ artifactKind: 'report', title: 'Check of ledger-core' });
  });

  it('hides a block that the agent wrapped in a json code fence', () => {
    const text = `Check incomplete.\n\n\`\`\`json\n<<artifact v=1 kind=report>>\n${BODY}\n<</artifact>>\n\`\`\`\n`;
    const { segments } = splitArtifactText({ text });
    expect(segments.map((segment) => segment.kind)).toEqual(['prose', 'artifact']);
    const prose = segments[0];
    expect(prose).toMatchObject({ kind: 'prose', text: 'Check incomplete.\n' });
    expect(JSON.stringify(segments)).not.toContain('<<artifact');
    expect(JSON.stringify(segments)).not.toContain('```');
  });

  it('keeps the prose that follows a fenced block', () => {
    const text = `\`\`\`\n<<artifact v=1 kind=report>>\n${BODY}\n<</artifact>>\n\`\`\`\nDone.`;
    const { segments } = splitArtifactText({ text });
    expect(segments.map((segment) => segment.kind)).toEqual(['artifact', 'prose']);
    expect(segments[1]).toMatchObject({ text: 'Done.' });
  });

  it('leaves plain prose alone', () => {
    const { segments } = splitArtifactText({ text: 'No artifact here.' });
    expect(segments).toEqual([{ kind: 'prose', text: 'No artifact here.' }]);
  });
});
