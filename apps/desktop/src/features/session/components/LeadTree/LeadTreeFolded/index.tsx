import { useMemo } from 'react';
import type { AgentId } from '@goodboy/types';
import { Button, Tooltip, cn, tintClasses, type WorkNodeState } from '@goodboy/ui';
import { AgentKindChip } from '../../../../../shared/components/AgentKindChip';
import { NAMES } from '../../../../../shared/utils/names';
import type { LeadTreeItem } from '../../../../auto/tree/leadTreeItemsOf';
import type { AgentKind } from '../../../agent-kind';
import { leadTreeToneOf } from '../leadTreeToneOf';
import type { LeadTreeRoot } from '../leadTreeRoot';

type Props = {
  readonly items: ReadonlyArray<LeadTreeItem>;
  readonly root: LeadTreeRoot | null;
  readonly selectedAgentId: AgentId | null;
  readonly onSelect: (agentId: AgentId) => void;
};

type Entry = Readonly<{
  id: string;
  agentId: AgentId;
  level: number;
  kind: AgentKind;
  role: string;
  title: string;
  node: WorkNodeState;
  word: string;
}>;

const LEVEL_INDENT_PX = 8;

const TRUNK_X_PX = 8;

const foldedEntriesOf = ({ items, root }: Pick<Props, 'items' | 'root'>): ReadonlyArray<Entry> => {
  const offset = root === null ? 0 : 1;
  const rows: Entry[] =
    root === null
      ? []
      : [
          {
            id: 'lead-tree-root',
            agentId: root.agentId,
            level: 0,
            kind: 'auto',
            role: 'Lead',
            title: root.title,
            node: root.node,
            word: root.word,
          },
        ];
  for (const item of items) {
    if (item.kind === 'agent') {
      rows.push({
        id: item.id,
        agentId: item.agentId,
        level: item.depth + offset,
        kind: item.agentKind,
        role: item.role,
        title: item.title,
        node: item.node,
        word: item.word,
      });
    }
  }
  return rows;
};

export const LeadTreeFolded = ({ items, root, selectedAgentId, onSelect }: Props) => {
  const entries = useMemo(() => foldedEntriesOf({ items, root }), [items, root]);
  if (entries.length === 0) {
    return null;
  }
  return (
    <nav
      aria-label={NAMES.agents}
      data-lead-tree-folded=""
      className="relative flex w-full flex-col pb-3"
    >
      {entries.length > 1 ? (
        <span
          aria-hidden
          className="absolute bottom-6 top-6 w-px bg-border"
          style={{ left: TRUNK_X_PX }}
        />
      ) : null}
      {entries.map((entry) => {
        const isSelected = entry.agentId === selectedAgentId;
        const tone = tintClasses(leadTreeToneOf({ node: entry.node }));
        const label = `${entry.role}${entry.title === '' ? '' : `, ${entry.title}`}, ${entry.word}`;
        return (
          <div key={entry.id} className="relative flex h-7 items-center">
            {entry.level === 0 ? null : (
              <span
                aria-hidden
                className="absolute h-px bg-border"
                style={{ left: TRUNK_X_PX, width: entry.level * LEVEL_INDENT_PX }}
              />
            )}
            <Tooltip
              content={`${entry.role}${entry.title === '' ? '' : `\n${entry.title}`}\n${entry.word}`}
              side="right"
              anchorClassName="flex"
            >
              <Button
                variant="ghost"
                size="xs"
                aria-label={label}
                aria-current={isSelected ? 'true' : undefined}
                data-lead-tree-agent={entry.agentId}
                data-lead-tree-node={entry.node}
                data-selected={isSelected}
                className={cn('w-6 px-0', isSelected && 'bg-selected hover:bg-selected')}
                style={{ marginLeft: 4 + entry.level * LEVEL_INDENT_PX }}
                onClick={() => onSelect(entry.agentId)}
              >
                <AgentKindChip
                  kind={entry.kind}
                  density="glyph"
                  isDecorative
                  className={cn(
                    tone.icon,
                    isSelected ? 'ring-2 ring-primary' : cn('ring-1', tone.ring),
                  )}
                />
              </Button>
            </Tooltip>
          </div>
        );
      })}
    </nav>
  );
};
