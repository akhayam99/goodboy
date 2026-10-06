import type { AskHandle } from '../../askHandles';
import type { AskBlock } from '../../parseAskAnswer';
import { AskInlines } from './AskInlines';

type Props = {
  readonly blocks: ReadonlyArray<AskBlock>;
  readonly isStreaming: boolean;
  readonly onOpen: (handle: AskHandle) => void;
};

type Group =
  | { readonly kind: 'paragraph'; readonly block: AskBlock }
  | { readonly kind: 'list'; readonly items: ReadonlyArray<AskBlock> };

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

export const AskAnswer = ({ blocks, isStreaming, onOpen }: Props) => (
  <div data-testid="ask-answer" className="flex min-w-0 flex-col gap-2 text-prose text-foreground">
    {groupsOf(blocks).map((group, index) =>
      group.kind === 'paragraph' ? (
        <p key={`p-${index}`} className="min-w-0">
          <AskInlines inlines={group.block.inlines} onOpen={onOpen} />
        </p>
      ) : (
        <ul key={`ul-${index}`} className="flex list-disc flex-col gap-1 pl-5">
          {group.items.map((item, position) => (
            <li key={`li-${position}`}>
              <AskInlines inlines={item.inlines} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      ),
    )}
    {isStreaming ? <span aria-hidden className="h-3.5 w-0.5 bg-muted-foreground" /> : null}
  </div>
);
