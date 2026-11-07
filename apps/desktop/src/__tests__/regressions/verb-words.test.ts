import { ROW_ACTION_LABEL } from '../../features/workTreeModel/rowActionLabels';
import { describe, expect, it } from 'vitest';
import { describeCopy, scanCopy } from './scanCopy';
import { scanCopySource, type CopyString } from './scanCopySource';

const RETIRED = /^(?:View|See|Go to|Open full)\b/;
const ACTION_PROPS: ReadonlySet<string> = new Set([
  'label',
  'actionLabel',
  'confirmLabel',
  'shortLabel',
  'short',
  'aria-label',
  'ariaLabel',
]);
const CONTROLS: ReadonlySet<string> = new Set([
  'button',
  'Button',
  'GhostActionButton',
  'IconButton',
  'MenuItem',
  'MenuRow',
  'Chip',
]);

type Params = {
  readonly copy: CopyString;
};

const isRetiredVerb = ({ copy }: Params): boolean => {
  if (!RETIRED.test(copy.text) || copy.element === 'FacetSection') {
    return false;
  }
  return (
    (copy.prop !== null && ACTION_PROPS.has(copy.prop)) ||
    (copy.prop === null && copy.element !== undefined && CONTROLS.has(copy.element))
  );
};

describe('one verb per move or act', () => {
  it.each(['View transcript', 'See what it did', 'Go to chat', 'Open full', 'View'])(
    'rejects %s on a control',
    (label) => {
      const copies = scanCopySource({ path: 'Harborline.tsx', text: `<Button>${label}</Button>` });
      expect(copies.some((copy) => isRetiredVerb({ copy }))).toBe(true);
    },
  );

  it('keeps a view noun on a facet heading and advice in a sentence', () => {
    const copies = scanCopySource({
      path: 'Harborline.tsx',
      text: `<FacetSection label="View" /><p>See the branch before you retry.</p>`,
    });

    expect(copies.filter((copy) => isRetiredVerb({ copy }))).toEqual([]);
  });

  it('keeps the shared row actions on the same verbs', () => {
    expect(Object.values(ROW_ACTION_LABEL).filter((label) => RETIRED.test(label))).toEqual([]);
  });

  it('finds no retired moving verb on a control', () => {
    const offenders = scanCopy()
      .filter((copy) => isRetiredVerb({ copy }))
      .map((copy) => describeCopy({ copy }));

    expect(offenders).toEqual([]);
  });
});
