import { cn } from '@goodboy/ui';
import {
  EFFORT_LABEL,
  PROVIDER_LABEL,
  modelEffortLevels,
  modelLabel,
} from '../../../chat/utils/chat-constants';
import type { AgentKind, AgentKindRouting } from '../../agent-kind';
import type { SpawnRouting } from '../../spawn-routing';

type Props = {
  readonly kind: AgentKind;
  readonly effective: AgentKindRouting;
  readonly fallback: SpawnRouting;
  readonly isPinned: boolean;
  readonly onReset: () => void;
};

const RIGHT_SIZED_HINT: Partial<Record<AgentKind, string>> = {
  scout: 'Scouts default to a smaller model, they only read code',
  docs: 'Docs agents default to a smaller model, they only write prose',
  generic: 'No model picked in this chat yet, so it starts small',
};

const ORIGIN_TAG: Record<SpawnRouting['origin'], string> = {
  chat: 'from this chat',
  'right-sized': 'recommended',
  'role-default': 'recommended',
};

const routingLine = ({ provider, model, effort }: AgentKindRouting): string => {
  const head = `${PROVIDER_LABEL[provider]} · ${modelLabel(model)}`;
  if (modelEffortLevels(model) == null) {
    return head;
  }
  return `${head}, ${EFFORT_LABEL[effort].toLowerCase()} effort`;
};

const modelLine = ({ model, effort }: AgentKindRouting): string => {
  if (modelEffortLevels(model) == null) {
    return modelLabel(model);
  }
  return `${modelLabel(model)}, ${EFFORT_LABEL[effort].toLowerCase()} effort`;
};

export const SpawnRoutingSummary = ({ kind, effective, fallback, isPinned, onReset }: Props) => {
  const hint = RIGHT_SIZED_HINT[kind];
  const showHint = !isPinned && fallback.origin === 'right-sized' && hint != null;
  const resetPrefix = fallback.origin === 'chat' ? "Use this chat's model" : 'Use recommended';

  return (
    <div className="flex flex-col gap-1 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {routingLine(effective)}
        </span>
        {!isPinned && (
          <span
            className={cn(
              'shrink-0 rounded-full px-1.5 py-0.5 text-2xs',
              fallback.origin === 'chat'
                ? 'bg-primary/10 text-primary'
                : 'bg-background text-muted-foreground',
            )}
          >
            {ORIGIN_TAG[fallback.origin]}
          </span>
        )}
      </div>
      {showHint && <p className="text-2xs leading-tight text-muted-foreground/70">{hint}</p>}
      {isPinned && (
        <button
          type="button"
          onClick={onReset}
          className="self-start text-2xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          {`${resetPrefix}: ${modelLine(fallback)}`}
        </button>
      )}
    </div>
  );
};
