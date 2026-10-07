import { clampEffortForModel } from '@goodboy/core';
import { useEffect, useMemo, useState } from 'react';
import { AnchoredPopover, Button, FormActions, useDropdown } from '@goodboy/ui';
import { PromptField } from '../../../../shared/components/PromptField';
import type { SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { useFollowToast } from '../../../../shared/hooks/useFollowToast';
import { AgentSpawnConfig } from '../../../session/components/AgentSpawnConfig';
import { AGENT_KIND_META } from '../../../session/agent-kind';
import { resolveSpawnRouting } from '../../../session/spawn-routing';
import { useKindRouting } from '../../../../shared/hooks/useKindRouting';
import type { AgentSpawnConfigValue } from '../../../session/agentSpawnConfigValue';
import { appendOperatorNotes } from '../../../session/utils/appendOperatorNotes';
import { type ExploreEntry } from '../../explore';
import { buildExploreSpawnPrompt } from '../../buildExploreSpawnPrompt';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

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
  const followAgent = useFollowToast();
  const session = useAppStore((state) => sessionById(state.sessions, sessionId) ?? null);
  const roleDefault = useKindRouting({ sessionId, kind: 'scout' });
  const spawnRouting = resolveSpawnRouting({ kind: 'scout', roleDefault, session });
  const defaultConfig = useMemo<AgentSpawnConfigValue>(
    () => ({
      hint: '',
      provider: spawnRouting.provider,
      model: spawnRouting.model,
      effort:
        clampEffortForModel({
          model: spawnRouting.model,
          effort: spawnRouting.effort,
          provider: spawnRouting.provider,
        }) ?? spawnRouting.effort,
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
      followAgent({
        title: 'Agent started',
        message: `An agent is working on ${entry.name}.`,
        target: { place: agentPlace({ sessionId, agentId }) },
        startKey: agentId,
        onFollow: () => window.dispatchEvent(new CustomEvent('goodboy:reveal-chat')),
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
          className="rounded-md p-2 text-faint-foreground transition-colors hover:bg-hover hover:text-foreground"
        >
          <CONCEPT_ICONS.agents size={ICON_SIZE.control} aria-hidden />
        </button>
      }
    >
      <div className="flex flex-col gap-1">
        <p className="text-row text-foreground">Ask an agent about this file</p>
        <p className="truncate font-mono text-meta text-muted-foreground">{entry.relPath}</p>
      </div>
      <div className="flex flex-col gap-2">
        <PromptField
          kind="document"
          label="What should the agent do with this file?"
          value={ask}
          onChange={setAsk}
          minRows={3}
          maxRows={10}
          placeholder="Describe what you want from this file."
          disabled={isSpawning}
        />
        <AgentSpawnConfig
          value={config}
          onChange={setConfig}
          disabled={isSpawning}
          className="gap-2"
          role={{ label: AGENT_KIND_META.generic.label, hint: 'Fixed by the explore panel' }}
        />
      </div>
      <FormActions
        error={spawnError == null ? null : <span className="text-label">{spawnError}</span>}
      >
        <Button size="sm" onClick={() => void spawnFromFile()} disabled={!canSpawn}>
          {isSpawning ? 'Starting…' : 'Start agent'}
        </Button>
      </FormActions>
    </AnchoredPopover>
  );
};
