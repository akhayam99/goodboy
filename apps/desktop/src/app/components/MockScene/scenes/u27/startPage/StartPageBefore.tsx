import { useState } from 'react';
import { Button, FormActions, SegmentedTabs } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { ControlChip } from '../../../../../../shared/components/ControlChip';
import { PromptField } from '../../../../../../shared/components/PromptField';
import { StartRun } from '../../../../../../features/session/components/StartRun/StartRun';
import { KickoffProjects } from '../../../../../../features/session/components/SessionKickoff/KickoffProjects';

type OldChoice = 'task' | 'workflow' | 'orchestrate' | 'agent';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const OLD_LINES = {
  task: 'Start from an issue in your tracker.',
  workflow: 'Several agents work through your goal, step by step.',
  orchestrate: 'The orchestrator picks each next step until the goal is done.',
  agent: 'One agent in the role you pick.',
} as const satisfies Readonly<Record<OldChoice, string>>;

const noop = (): void => undefined;

export const StartPageBefore = ({ workspaceId }: Props) => {
  const [choice, setChoice] = useState<OldChoice>('agent');
  const [prompt, setPrompt] = useState('');

  return (
    <section aria-label="Kickoff" className="flex flex-col gap-6" data-start-page-era="0.27.10">
      <StartRun workspaceId={workspaceId} sessionId={null} />
      <div className="flex flex-col gap-2">
        <SegmentedTabs
          ariaLabel="How do you want to start?"
          size="sm"
          value={choice}
          onChange={setChoice}
          options={[
            { value: 'task', label: 'Pick up a task', icon: CONCEPT_ICONS.issues },
            { value: 'workflow', label: 'Run a workflow', icon: CONCEPT_ICONS.workflows },
            {
              value: 'orchestrate',
              label: 'Run an orchestrator',
              icon: CONCEPT_ICONS.orchestrator,
            },
            { value: 'agent', label: 'Start an agent', icon: CONCEPT_ICONS.agents },
          ]}
        />
        <p className="text-label text-muted-foreground">{OLD_LINES[choice]}</p>
      </div>
      <PromptField
        kind="message"
        label="Agent prompt"
        value={prompt}
        onChange={setPrompt}
        placeholder="Optional: an area, a file or a question"
        minRows={2}
        maxRows={8}
        keyLabels={{ send: 'start' }}
      />
      <KickoffProjects workspaceId={workspaceId} />
      <FormActions
        leading={
          <div className="flex flex-wrap items-center gap-2">
            <ControlChip
              label="Role"
              value="Scout"
              isOpen={false}
              isDisabled={false}
              onToggle={noop}
            />
            <ControlChip
              label="Model"
              value="Haiku 5.5"
              isOpen={false}
              isDisabled={false}
              onToggle={noop}
            />
          </div>
        }
      >
        <Button size="md">Start Scout on the whole folder</Button>
      </FormActions>
    </section>
  );
};
