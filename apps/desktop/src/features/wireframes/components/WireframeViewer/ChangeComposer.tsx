import type { KeyboardEvent } from 'react';
import { Crosshair, X } from 'lucide-react';
import { Button, Chip, KbdPill, SegmentedTabs, Textarea } from '@goodboy/ui';
import type { WireframeChangeScope, WireframePickedNode } from '../../buildWireframeChangeRequest';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { isSubmitChord } from '../../../../shared/keyboard/isSubmitChord';

const SCOPE_OPTIONS = [
  { value: 'screen', label: 'This screen' },
  { value: 'all', label: 'All screens' },
] satisfies ReadonlyArray<{ readonly value: WireframeChangeScope; readonly label: string }>;

type Props = {
  readonly ask: string;
  readonly onAskChange: (ask: string) => void;
  readonly screenTitle: string | null;
  readonly picked: ReadonlyArray<WireframePickedNode>;
  readonly onUnpick: (nodeId: string) => void;
  readonly isPicking: boolean;
  readonly onTogglePick: () => void;
  readonly scope: WireframeChangeScope;
  readonly onScopeChange: (scope: WireframeChangeScope) => void;
  readonly modelLabel: string | null;
  readonly isBusy: boolean;
  readonly onSend: () => void;
};

export const ChangeComposer = ({
  ask,
  onAskChange,
  screenTitle,
  picked,
  onUnpick,
  isPicking,
  onTogglePick,
  scope,
  onScopeChange,
  modelLabel,
  isBusy,
  onSend,
}: Props) => {
  const canSend = !isBusy && ask.trim().length > 0;
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSubmitChord(event) && canSend) {
      event.preventDefault();
      onSend();
    }
  };
  return (
    <section
      aria-label="Ask for a change"
      data-testid="wireframe-change-composer"
      className="flex min-w-0 flex-col gap-2 rounded-lg border border-border-soft bg-subtle p-3"
    >
      {picked.length === 0 ? null : (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {picked.map((node) => (
            <Chip
              key={node.nodeId}
              tone="neutral"
              size="sm"
              label={screenTitle === null ? node.label : `${screenTitle} › ${node.label}`}
              trailing={<X size={ICON_SIZE.row} aria-hidden />}
              as="button"
              ariaLabel={`Remove ${node.label}`}
              onClick={() => onUnpick(node.nodeId)}
              testId="wireframe-picked-chip"
            />
          ))}
        </div>
      )}
      <Textarea
        aria-label="Ask for a change"
        placeholder={
          screenTitle === null ? 'Ask for a change' : `Ask for a change to ${screenTitle}`
        }
        value={ask}
        onChange={(event) => onAskChange(event.target.value)}
        onKeyDown={onKeyDown}
        disabled={isBusy}
        autoGrow
        minRows={2}
        maxRows={8}
        className="w-full text-body"
      />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onTogglePick}
          aria-pressed={isPicking}
          disabled={isBusy}
          data-testid="wireframe-pick"
          title={isPicking ? 'Picking. Press Esc to stop' : 'Pick an element on the page'}
        >
          <Crosshair size={ICON_SIZE.row} aria-hidden />
          {isPicking ? 'Picking' : 'Pick'}
        </Button>
        <SegmentedTabs
          ariaLabel="Scope"
          options={SCOPE_OPTIONS}
          value={scope}
          onChange={onScopeChange}
          size="sm"
        />
        <span className="ml-auto flex min-w-0 items-center gap-2">
          {modelLabel === null ? null : (
            <span className="truncate text-secondary text-muted-foreground">{modelLabel}</span>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={onSend}
            disabled={!canSend}
            isBusy={isBusy}
            data-testid="wireframe-change-send"
          >
            Ask
            <KbdPill>{shortcutGlyphs('composer.submit')}</KbdPill>
          </Button>
        </span>
      </div>
    </section>
  );
};
