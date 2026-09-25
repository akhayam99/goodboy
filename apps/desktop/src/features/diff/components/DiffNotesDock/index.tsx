import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MessageSquare } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { clampEffortForModel, getDefaultTurnModel } from '@goodboy/core';
import type { DiffComment, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { kindRouting, type AgentKindRouting } from '../../../session/agent-kind';
import { buildNotesPrompt } from '../../lib/notesPrompt';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly openNotes: ReadonlyArray<DiffComment>;
};

export const DiffNotesDock = ({ sessionId, mountId, openNotes }: Props) => {
  const toggleDrawer = useAppStore((s) => s.toggleDrawer);
  const isDrawerOpen = useAppStore((s) => selectOpenDrawer(s)?.kind === 'diff-notes');
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const sendTurn = useAppStore((s) => s.sendTurn);
  const consumeDiffComments = useAppStore((s) => s.consumeDiffComments);
  const connectedProviders = useAppStore(
    useShallow((s) => s.providers.filter((p) => p.connection === 'connected').map((p) => p.id)),
  );
  const roleModels = useSessionRoleModels({ sessionId });
  const [routing, setRouting] = useState<AgentKindRouting>(() =>
    kindRouting({ kind: 'resolver', roleModels }),
  );
  const [spawning, setSpawning] = useState(false);
  const count = openNotes.length;

  const proposeFixes = async () => {
    if (count === 0 || spawning) {
      return;
    }
    setSpawning(true);
    try {
      const fileCount = new Set(openNotes.map((note) => note.filePath)).size;
      const agentId = await spawnAgent(sessionId, {
        name: `resolve notes (${fileCount}F/${count}N)`,
        provider: routing.provider,
        model: routing.model,
        effort: routing.effort,
        kindOverride: 'resolver',
        sourceKind: 'diff_comment',
        focus: 'none',
      });
      try {
        await consumeDiffComments(
          sessionId,
          openNotes.map((note) => note.id),
          agentId,
        );
      } catch (err) {
        console.error('failed to mark comments consumed', err);
      }
      void sendTurn({
        sessionId,
        agentId,
        content: buildNotesPrompt(openNotes),
        ...(mountId === null ? {} : { mountId }),
      });
    } finally {
      setSpawning(false);
    }
  };

  return (
    <div data-slot="diff-notes-dock" className="flex min-w-0 items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={isDrawerOpen}
        onClick={() => toggleDrawer({ kind: 'diff-notes', sessionId, payload: {} })}
      >
        <MessageSquare size={ICON_SIZE.row} aria-hidden />
        {count} open {count === 1 ? 'note' : 'notes'}
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <RoutingPicker
          ariaLabel="Resolver routing"
          variant="pill"
          align="end"
          connectedProviders={connectedProviders}
          provider={routing.provider}
          model={routing.model}
          effort={{
            editable: true,
            value: routing.effort,
            onChange: (effort) => setRouting({ ...routing, effort }),
          }}
          disabled={spawning}
          onProvider={(next) => {
            if (next === '') {
              return;
            }
            const model = getDefaultTurnModel({ id: next });
            setRouting({
              provider: next,
              model,
              effort: clampEffortForModel({ model, effort: routing.effort }) ?? routing.effort,
            });
          }}
          onModel={(model) =>
            setRouting({
              ...routing,
              model,
              effort: clampEffortForModel({ model, effort: routing.effort }) ?? routing.effort,
            })
          }
        />
        <Button size="sm" onClick={() => void proposeFixes()} disabled={spawning || count === 0}>
          {spawning ? 'Starting…' : 'Propose fixes'}
        </Button>
      </div>
    </div>
  );
};
