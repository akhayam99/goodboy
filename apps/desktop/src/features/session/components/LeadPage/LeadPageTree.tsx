import { ScrollFade } from '@goodboy/ui';
import type { AgentId } from '@goodboy/types';
import { LeadTree } from '../LeadTree';
import type { LeadTreeItem } from '../../../auto/tree/leadTreeItemsOf';

type Props = {
  readonly items: ReadonlyArray<LeadTreeItem>;
  readonly selectedAgentId: AgentId | null;
  readonly onSelect: (agentId: AgentId) => void;
  readonly onEditNote: (noteId: string) => void;
  readonly onRemoveNote: (noteId: string) => void;
};

export const LeadPageTree = ({
  items,
  selectedAgentId,
  onSelect,
  onEditNote,
  onRemoveNote,
}: Props) => (
  <ScrollFade className="min-h-0 flex-1" viewportClassName="flex flex-col px-3 pb-3">
    <LeadTree
      items={items}
      selectedAgentId={selectedAgentId}
      onSelect={onSelect}
      onEditNote={onEditNote}
      onRemoveNote={onRemoveNote}
    />
  </ScrollFade>
);
