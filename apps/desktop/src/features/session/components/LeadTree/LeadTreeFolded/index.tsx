import { Fragment, useMemo } from 'react';
import type { AgentId } from '@goodboy/types';
import { Button, Tooltip, cn, type WorkNodeState } from '@goodboy/ui';
import { AgentKindChip } from '../../../../../shared/components/AgentKindChip';
import { NAMES } from '../../../../../shared/utils/names';
import type { LeadTreeItem } from '../../../../auto/tree/leadTreeItemsOf';
import type { AgentKind } from '../../../agent-kind';
import { LeadTreeSelectedMark } from '../LeadTreeSelectedMark';
import { leadTreeInkOf } from '../leadTreeInkOf';
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

type EntriesParams = Pick<Props, 'items' | 'root'>;

const LEVEL_INDENT_PX = 8;

const GUIDE_ORIGIN_PX = 16;

const MAX_DEPTH = 1;

const foldedEntriesOf = ({ items, root }: EntriesParams): ReadonlyArray<Entry> => {
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
  const hasRoot = root !== null;
  return (
    <nav aria-label={NAMES.agents} data-lead-tree-folded="" className="flex w-full flex-col pb-3">
      {entries.map((entry, index) => {
        const isSelected = entry.agentId === selectedAgentId;
        const depth = Math.min(MAX_DEPTH, hasRoot ? Math.max(0, entry.level - 1) : entry.level);
        const label = `${entry.role}${entry.title === '' ? '' : `, ${entry.title}`}, ${entry.word}`;
        return (
          <Fragment key={entry.id}>
            <div className="relative flex h-7 w-full items-center">
              {isSelected ? <LeadTreeSelectedMark /> : null}
              {Array.from({ length: depth }, (_, at) => (
                <span
                  key={at}
                  aria-hidden
                  data-lead-tree-guide=""
                  className="absolute inset-y-0 w-px bg-border"
                  style={{ left: GUIDE_ORIGIN_PX + at * LEVEL_INDENT_PX }}
                />
              ))}
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
                  style={{ marginLeft: 10 + depth * LEVEL_INDENT_PX }}
                  onClick={() => onSelect(entry.agentId)}
                >
                  <AgentKindChip
                    kind={entry.kind}
                    density="bare"
                    isDecorative
                    className={leadTreeInkOf({ node: entry.node }).glyph}
                  />
                </Button>
              </Tooltip>
            </div>
            {hasRoot && index === 0 && entries.length > 1 ? (
              <div aria-hidden data-lead-tree-sep="" className="px-2 py-1">
                <div className="h-px bg-border-soft" />
              </div>
            ) : null}
          </Fragment>
        );
      })}
    </nav>
  );
};
