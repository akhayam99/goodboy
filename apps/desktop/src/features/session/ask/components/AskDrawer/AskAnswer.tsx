import type { FreshTail } from '@goodboy/ui';
import { inlineMarkdownText } from '@goodboy/ui';
import { sliceFreshTail } from '../../../../chat/reveal/sliceFreshTail';
import type { AskHandle } from '../../askHandles';
import type { AskBlock, AskInline } from '../../parseAskAnswer';
import { AskInlines } from './AskInlines';

type Props = {
  readonly blocks: ReadonlyArray<AskBlock>;
  readonly isStreaming: boolean;
  readonly fresh?: FreshTail | undefined;
  readonly onOpen: (handle: AskHandle) => void;
};

type Group =
  | { readonly kind: 'paragraph'; readonly block: AskBlock }
  | { readonly kind: 'list'; readonly items: ReadonlyArray<AskBlock> };

const NO_FRESH: ReadonlyMap<AskInline, FreshTail> = new Map();

const groupsOf = (blocks: ReadonlyArray<AskBlock>): ReadonlyArray<Group> =>
  blocks.reduce<ReadonlyArray<Group>>((groups, block) => {
    const last = groups[groups.length - 1];
    if (block.kind === 'paragraph') {
      return [...groups, { kind: 'paragraph', block }];
    }
    if (last?.kind === 'list') {
      return [...groups.slice(0, -1), { kind: 'list', items: [...last.items, block] }];
    }
    return [...groups, { kind: 'list', items: [block] }];
  }, []);

type FreshParams = {
  readonly blocks: ReadonlyArray<AskBlock>;
  readonly fresh: FreshTail | undefined;
};

const freshByInline = ({ blocks, fresh }: FreshParams): ReadonlyMap<AskInline, FreshTail> => {
  if (fresh === undefined) {
    return NO_FRESH;
  }
  const byInline = new Map<AskInline, FreshTail>();
  let skip = 0;
  for (const inline of blocks.flatMap((block) => block.inlines).reverse()) {
    if (inline.kind !== 'text') {
      continue;
    }
    const length = inlineMarkdownText({ text: inline.text }).length;
    const slice = sliceFreshTail({ tail: fresh, skip, length });
    if (slice === undefined && skip > 0) {
      break;
    }
    if (slice !== undefined) {
      byInline.set(inline, slice);
    }
    skip += length;
  }
  return byInline;
};

export const AskAnswer = ({ blocks, isStreaming, fresh, onOpen }: Props) => {
  const freshOf = freshByInline({ blocks, fresh });
  return (
    <div
      data-testid="ask-answer"
      className="flex min-w-0 flex-col gap-2 text-prose text-foreground"
    >
      {groupsOf(blocks).map((group, index) =>
        group.kind === 'paragraph' ? (
          <p key={`p-${index}`} className="min-w-0">
            <AskInlines inlines={group.block.inlines} freshOf={freshOf} onOpen={onOpen} />
          </p>
        ) : (
          <ul key={`ul-${index}`} className="flex list-disc flex-col gap-1 pl-5">
            {group.items.map((item, position) => (
              <li key={`li-${position}`}>
                <AskInlines inlines={item.inlines} freshOf={freshOf} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        ),
      )}
      {isStreaming ? <span aria-hidden className="h-3.5 w-0.5 bg-muted-foreground" /> : null}
    </div>
  );
};
