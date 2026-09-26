import { Chip, GhostActionButton, Markdown } from '@goodboy/ui';
import type { HandoffSection, PlanId, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { HandoffEarlierStepRow } from './HandoffEarlierStepRow';
import { HandoffRawText } from './HandoffRawText';
import { HandoffThreadRow } from './HandoffThreadRow';

type Props = {
  readonly section: HandoffSection;
  readonly doneWhen: string | null;
  readonly sessionId: SessionId | null;
};

type OpenPlanParams = {
  readonly sessionId: SessionId;
  readonly planId: PlanId;
};

const openPlan = ({ sessionId, planId }: OpenPlanParams): void => {
  window.dispatchEvent(
    new CustomEvent('goodboy:open-plan-studio', { detail: { sessionId, planId } }),
  );
};

export const HandoffSectionBody = ({ section, doneWhen, sessionId }: Props) => {
  switch (section.kind) {
    case 'ask':
      return (
        <div className="flex min-w-0 flex-col gap-2">
          <div className="text-body text-foreground">
            <Markdown text={section.bodyMd} />
          </div>
          {doneWhen === null ? null : (
            <div className="flex min-w-0 gap-2 text-label">
              <span className="w-32 shrink-0 text-muted-foreground">Done when</span>
              <span className="min-w-0 flex-1 text-foreground">{doneWhen}</span>
            </div>
          )}
        </div>
      );
    case 'goal':
      return (
        <div className="text-body text-foreground">
          <Markdown text={section.bodyMd} />
        </div>
      );
    case 'earlierSteps':
      return (
        <div className="flex min-w-0 flex-col">
          {section.refs.flatMap((entry) =>
            entry.kind === 'agent'
              ? [<HandoffEarlierStepRow key={entry.agentId} entry={entry} sessionId={sessionId} />]
              : [],
          )}
        </div>
      );
    case 'plan':
      return (
        <div className="flex min-w-0 items-center gap-2 text-label">
          <span className="min-w-0 flex-1 truncate text-foreground">{section.summary}</span>
          {section.refs.flatMap((entry) =>
            entry.kind === 'plan' && sessionId !== null
              ? [
                  <GhostActionButton
                    key={entry.planId}
                    icon={CONCEPT_ICONS.plans}
                    label="Open plan"
                    onClick={() => openPlan({ sessionId, planId: entry.planId })}
                  />,
                ]
              : [],
          )}
        </div>
      );
    case 'files':
      return (
        <div className="flex flex-wrap gap-1.5">
          {section.refs.flatMap((entry) =>
            entry.kind === 'file'
              ? [<Chip key={entry.path ?? entry.label} tone="neutral" label={entry.label} />]
              : [],
          )}
        </div>
      );
    case 'threads':
      return (
        <div className="flex min-w-0 flex-col gap-2">
          {section.refs.flatMap((entry, index) =>
            entry.kind === 'thread'
              ? [
                  <HandoffThreadRow
                    key={entry.threadId ?? `thread-${index}`}
                    entry={entry}
                    sessionId={sessionId}
                  />,
                ]
              : [],
          )}
        </div>
      );
    case 'scope':
      return (
        <div className="flex min-w-0 flex-col gap-1">
          {section.refs.flatMap((entry) =>
            entry.kind === 'rule'
              ? [
                  <div key={entry.label} className="flex min-w-0 gap-2 text-label">
                    <span className="w-32 shrink-0 text-muted-foreground">{entry.label}</span>
                    <span className="min-w-0 flex-1 text-foreground">{entry.detail}</span>
                  </div>,
                ]
              : [],
          )}
        </div>
      );
    case 'profile':
    case 'role':
      return <HandoffRawText text={section.bodyMd} />;
    default: {
      const exhaustive: never = section.kind;
      return exhaustive;
    }
  }
};
