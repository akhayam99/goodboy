import type { FreshTail } from '@goodboy/ui';
import { CodeBlockActionsContext, Markdown, cn, inlineMarkdownText } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { sliceFreshTail } from '../../../../chat/reveal/sliceFreshTail';
import type { AskHandle } from '../../askHandles';
import type { AskBlock, AskInline } from '../../parseAskAnswer';
import { AskCodeActions } from './AskCodeActions';
import { AskInlines } from './AskInlines';

type Props = {
  readonly sessionId: SessionId;
  readonly blocks: ReadonlyArray<AskBlock>;
  readonly isStreaming: boolean;
  readonly fresh?: FreshTail | undefined;
  readonly onOpen: (handle: AskHandle) => void;
};

type Group =
  | { readonly kind: 'paragraph'; readonly block: AskBlock }
  | { readonly kind: 'markdown'; readonly text: string }
  | {
      readonly kind: 'list';
      readonly isNumbered: boolean;
      readonly items: ReadonlyArray<AskBlock>;
    };

const NO_FRESH: ReadonlyMap<AskInline, FreshTail> = new Map();

const groupsOf = (blocks: ReadonlyArray<AskBlock>): ReadonlyArray<Group> =>
  blocks.reduce<ReadonlyArray<Group>>((groups, block) => {
    const last = groups[groups.length - 1];
    if (block.kind === 'markdown') {
      return [...groups, { kind: 'markdown', text: block.text }];
    }
    if (block.kind === 'paragraph') {
      return [...groups, { kind: 'paragraph', block }];
    }
    const isNumbered = block.kind === 'number';
    if (last?.kind === 'list' && last.isNumbered === isNumbered) {
      return [...groups.slice(0, -1), { ...last, items: [...last.items, block] }];
    }
    return [...groups, { kind: 'list', isNumbered, items: [block] }];
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

export const AskAnswer = ({ sessionId, blocks, isStreaming, fresh, onOpen }: Props) => {
  const freshOf = freshByInline({ blocks, fresh });
  return (
    <CodeBlockActionsContext.Provider value={AskCodeActions}>
      <div
        data-testid="ask-answer"
        className="flex min-w-0 flex-col gap-3 text-prose text-foreground"
      >
        {groupsOf(blocks).map((group, index) => {
          if (group.kind === 'markdown') {
            return <Markdown key={`md-${index}`} text={group.text} className="gap-3 text-prose" />;
          }
          if (group.kind === 'paragraph') {
            return (
              <p key={`p-${index}`} className="min-w-0">
                <AskInlines
                  sessionId={sessionId}
                  inlines={group.block.inlines}
                  freshOf={freshOf}
                  onOpen={onOpen}
                />
              </p>
            );
          }
          const List = group.isNumbered ? 'ol' : 'ul';
          return (
            <List
              key={`list-${index}`}
              className={cn(
                'flex flex-col gap-1 pl-5',
                group.isNumbered ? 'list-decimal' : 'list-disc',
              )}
            >
              {group.items.map((item, position) => (
                <li key={`li-${position}`}>
                  <AskInlines
                    sessionId={sessionId}
                    inlines={item.inlines}
                    freshOf={freshOf}
                    onOpen={onOpen}
                  />
                </li>
              ))}
            </List>
          );
        })}
        {isStreaming ? <span aria-hidden className="h-3.5 w-0.5 bg-muted-foreground" /> : null}
      </div>
    </CodeBlockActionsContext.Provider>
  );
};
