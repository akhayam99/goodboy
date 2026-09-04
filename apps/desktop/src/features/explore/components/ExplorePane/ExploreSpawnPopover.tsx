import { useEffect, useMemo, useState } from 'react';
import { AnchoredPopover, Button, Divider, Textarea, useDropdown } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { clampEffort } from '../../../chat/utils/chat-constants';
import { AgentSpawnConfig } from '../../../session/components/AgentSpawnConfig';
import { resolveSpawnRouting } from '../../../session/spawn-routing';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import type { AgentSpawnConfigValue } from '../../../session/components/AgentSpawnConfig/AgentSpawnConfigValue';
import { DEFAULT_AGENT_SPAWN_CONFIG } from '../../../session/components/AgentSpawnConfig/defaultAgentSpawnConfig';
import { appendOperatorNotes } from '../../../session/utils/appendOperatorNotes';
import { type ExploreEntry } from '../../explore';
import { buildExploreSpawnPrompt } from '../../buildExploreSpawnPrompt';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ExploreEntry;
};

const toErrorMessage = ({ error }: { readonly error: unknown }): string => {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }
  return 'Unknown error';
};

export const ExploreSpawnPopover = ({ sessionId, entry }: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    expectedHeight: 420,
    expectedWidth: 420,
    width: 'w-[26rem] max-w-[calc(100vw-2rem)]',
  });
  const { open, close, toggle } = dropdown;
  const spawnAgent = useAppStore((state) => state.spawnAgent);
  const selectAgent = useAppStore((state) => state.selectAgent);
  const { showToast } = useToast();
  const session = useAppStore(
    (state) => state.sessions.find((candidate) => candidate.id === sessionId) ?? null,
  );
  const roleModels = useSessionRoleModels({ sessionId });
  const spawnRouting = resolveSpawnRouting({ kind: 'generic', roleModels, session });
  const defaultConfig = useMemo<AgentSpawnConfigValue>(
    () => ({
      ...DEFAULT_AGENT_SPAWN_CONFIG,
      provider: spawnRouting.provider,
      model: spawnRouting.model,
      effort: clampEffort(spawnRouting.model, spawnRouting.effort),
    }),
    [spawnRouting.provider, spawnRouting.model, spawnRouting.effort],
  );
  const [ask, setAsk] = useState('');
  const [isSpawning, setIsSpawning] = useState(false);
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const [config, setConfig] = useState<AgentSpawnConfigValue>(defaultConfig);
  const trimmedAsk = ask.trim();
  const canSpawn = trimmedAsk !== '' && isSpawning === false;

  useEffect(() => {
    if (open) {
      return;
    }
    setAsk('');
    setSpawnError(null);
    setConfig(defaultConfig);
  }, [defaultConfig, open]);

  const spawnFromFile = async () => {
    if (!canSpawn) {
      return;
    }
    setIsSpawning(true);
    setSpawnError(null);
    try {
      const kickoff = buildExploreSpawnPrompt({ ask: trimmedAsk, relPath: entry.relPath });
      const initialPrompt = appendOperatorNotes({ prompt: kickoff, hint: config.hint });
      const agentId = await spawnAgent(sessionId, {
        initialPrompt,
        model: config.model,
        ...(config.provider !== '' && { provider: config.provider }),
        effort: config.effort,
        focus: 'none',
      });
      close();
      showToast('success', `An agent is working on ${entry.name}. You can keep working.`, {
        title: 'Agent started',
        action: {
          label: 'Open the agent',
          onClick: () => {
            void selectAgent(sessionId, agentId);
            window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
          },
        },
      });
    } catch (error) {
      setSpawnError(toErrorMessage({ error }));
    }
    setIsSpawning(false);
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={`Ask an agent about ${entry.name}`}
      className="flex flex-col gap-3 p-3"
      trigger={
        <button
          type="button"
          onClick={toggle}
          aria-label={`Ask an agent to work on ${entry.name}`}
          className="rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <CONCEPT_ICONS.agents size={ICON_SIZE.control} aria-hidden />
        </button>
      }
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">Ask an agent about this file</p>
        <p className="truncate font-mono text-2xs text-muted-foreground">{entry.relPath}</p>
      </div>
      <Divider />
      <div className="flex flex-col gap-2">
        <Textarea
          aria-label="What should the agent do with this file?"
          value={ask}
          onChange={(event) => setAsk(event.target.value)}
          minRows={3}
          maxRows={10}
          autoGrow
          placeholder="Describe what you want from this file."
          disabled={isSpawning}
        />
        <AgentSpawnConfig
          value={config}
          onChange={setConfig}
          disabled={isSpawning}
          className="gap-1.5"
        />
        {spawnError != null ? <p className="text-xs text-danger">{spawnError}</p> : null}
      </div>
      <Divider />
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => void spawnFromFile()} disabled={!canSpawn}>
          {isSpawning ? 'Spawning…' : 'Spawn agent'}
        </Button>
      </div>
    </AnchoredPopover>
  );
};
