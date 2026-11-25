import { tintClasses, type WorkNodeState } from '@goodboy/ui';

type Params = {
  readonly node: WorkNodeState;
};

type Ink = Readonly<{
  glyph: string;
  word: string;
}>;

const WARNING_NODES: ReadonlySet<WorkNodeState> = new Set([
  'ready',
  'question',
  'budget',
  'approval',
  'alert',
]);

const DONE_NODES: ReadonlySet<WorkNodeState> = new Set(['done', 'approved', 'finished']);

export const leadTreeInkOf = ({ node }: Params): Ink => {
  if (node === 'running') {
    return { glyph: tintClasses('info').text, word: tintClasses('info').text };
  }
  if (WARNING_NODES.has(node)) {
    return { glyph: tintClasses('warning').text, word: tintClasses('warning').text };
  }
  if (node === 'failed') {
    return { glyph: tintClasses('danger').text, word: tintClasses('danger').text };
  }
  if (node === 'merging') {
    return { glyph: tintClasses('primary').text, word: 'text-muted-foreground' };
  }
  return {
    glyph: DONE_NODES.has(node) ? 'text-muted-foreground' : 'text-faint-foreground',
    word: 'text-muted-foreground',
  };
};
