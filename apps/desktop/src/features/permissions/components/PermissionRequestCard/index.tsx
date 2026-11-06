import { useState, type ReactNode } from 'react';
import { Hand, ShieldCheck } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  ConfirmPopover,
  ICON_SIZE,
  MenuTriggerButton,
  tintClasses,
  useDropdown,
} from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { TranscriptShell } from '../../../chat/components/TranscriptShell';
import { AppMenuList } from '../../../actions/AppMenuList';
import { formatRequestInput } from './formatRequestInput';
import { PromptField } from '../../../../shared/components/PromptField';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { OpenPermissionAsk } from '../../openPermissionAsksOf';
import { PermissionDockAsk } from './PermissionDockAsk';
import { usePermissionAsk } from './usePermissionAsk';

const warningTint = tintClasses('warning');

type Props = {
  readonly item: OpenPermissionAsk;
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
  readonly isDocked?: boolean;
  readonly isMessageTyped?: boolean;
  readonly pager?: string | null;
  readonly openAsker?: ReactNode;
};

type OverflowView = 'menu' | 'denyReason';

type CommandParams = {
  readonly input: unknown;
};

const askedCommandOf = ({ input }: CommandParams): string | null => {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const value: unknown = Reflect.get(input, 'command');
  return typeof value === 'string' ? value : null;
};

export const PermissionRequestCard = ({
  item,
  sessionId,
  agentId,
  isDocked = false,
  isMessageTyped = false,
  pager = null,
  openAsker = null,
}: Props) => {
  const [overflowView, setOverflowView] = useState<OverflowView>('menu');
  const [isConfirmingGlobal, setIsConfirmingGlobal] = useState(false);
  const [denyReason, setDenyReason] = useState('');
  const dropdown = useDropdown({ align: 'end', width: 'w-80', expectedWidth: 320 });
  const { open, close, toggle } = dropdown;
  const ask = usePermissionAsk({ item, sessionId, agentId, isDocked, onAnswered: close });

  const inputPreview = formatRequestInput({ input: item.input });
  const commandText = item.toolName === 'Bash' ? askedCommandOf({ input: item.input }) : null;

  const closeOverflow = () => {
    close();
    setOverflowView('menu');
    setDenyReason('');
  };

  const moreActions = (
    <ConfirmPopover
      role="alert"
      icon={<ShieldCheck size={ICON_SIZE.row} aria-hidden />}
      title={`${ask.ruleLabel} in every workspace?`}
      description="Every session in every workspace runs it without asking again."
      confirmLabel="Allow everywhere"
      isBusy={ask.isBusy}
      isOpen={isConfirmingGlobal}
      onConfirm={async () => {
        await ask.alwaysAllow({ scope: 'global' });
        setIsConfirmingGlobal(false);
      }}
      onCancel={() => setIsConfirmingGlobal(false)}
      trigger={() => (
        <AnchoredPopover
          dropdown={dropdown}
          role={overflowView === 'menu' ? undefined : 'dialog'}
          ariaLabel={overflowView === 'menu' ? undefined : 'More permission actions'}
          trigger={
            <MenuTriggerButton
              label="More permission actions"
              isOpen={open}
              size="control"
              disabled={ask.isBusy}
              onClick={toggle}
            >
              <CONCEPT_ICONS.more size={ICON_SIZE.control} aria-hidden />
            </MenuTriggerButton>
          }
        >
          {overflowView === 'menu' && (
            <AppMenuList
              label="More permission actions"
              onClose={closeOverflow}
              entries={[
                {
                  kind: 'item',
                  key: 'allow-session',
                  label: 'Allow all commands in this session',
                  isDisabled: ask.isBusy,
                  shouldStayOpen: true,
                  onSelect: ask.allowSession,
                },
                {
                  kind: 'item',
                  key: 'allow-everywhere',
                  label: `${ask.ruleLabel} everywhere`,
                  isDisabled: ask.isBusy,
                  onSelect: () => setIsConfirmingGlobal(true),
                },
                {
                  kind: 'item',
                  key: 'never-allow',
                  label: ask.neverLabel,
                  isDisabled: ask.isBusy,
                  onSelect: ask.neverAllow,
                },
                {
                  kind: 'item',
                  key: 'deny-reason',
                  label: `Deny and tell ${ask.askerNoun ?? 'the agent'} why…`,
                  isDisabled: ask.isBusy,
                  shouldStayOpen: true,
                  onSelect: () => setOverflowView('denyReason'),
                },
              ]}
            />
          )}
          {overflowView === 'denyReason' && (
            <div className="flex flex-col gap-2 p-3">
              <PromptField
                kind="document"
                label="Why you deny it"
                value={denyReason}
                onChange={setDenyReason}
                placeholder="Say why, so it doesn't try again this way"
                minRows={2}
                maxRows={4}
                className="w-full bg-elevated"
                textClassName="text-meta"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" disabled={ask.isBusy} onClick={closeOverflow}>
                  Cancel
                </Button>
                <Button
                  variant="ghost-danger"
                  size="sm"
                  disabled={ask.isBusy}
                  onClick={() => ask.deny({ reason: denyReason })}
                >
                  Deny
                </Button>
              </div>
            </div>
          )}
        </AnchoredPopover>
      )}
    />
  );
  const preview =
    commandText !== null ? (
      <code className="min-w-0 break-words rounded-md bg-elevated px-2 py-1 text-code text-foreground">
        {commandText}
      </code>
    ) : (
      inputPreview !== null && (
        <code className="min-w-0 break-words rounded-md bg-elevated px-2 py-1 text-code text-muted-foreground">
          {inputPreview}
        </code>
      )
    );

  if (isDocked) {
    return (
      <PermissionDockAsk
        title={ask.title}
        pager={pager}
        preview={preview}
        isMessageTyped={isMessageTyped}
        canAct={ask.canAct}
        isBusy={ask.isBusy}
        alwaysAllowLabel={ask.alwaysAllowLabel}
        openAsker={openAsker}
        moreActions={moreActions}
        onAllow={ask.allow}
        onAlwaysAllow={() => void ask.alwaysAllow({ scope: 'workspace' })}
        onDeny={() => ask.deny({ reason: '' })}
      />
    );
  }

  return (
    <TranscriptShell
      tone="warning"
      variant="boxed"
      emphasis
      className="flex flex-col gap-2 text-meta"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Hand size={ICON_SIZE.control} aria-hidden className={warningTint.icon} />
        <span className="text-heading text-foreground">{ask.title}</span>
        {ask.isResolved ? (
          <span className="ml-auto text-meta text-muted-foreground">Resolved</span>
        ) : null}
      </div>
      {preview}
      {ask.modeLabel !== null && (
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">{ask.modeLabel}</span> is on
        </span>
      )}
      {ask.canAct && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={ask.isBusy} onClick={ask.allow}>
            Allow and continue
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={ask.isBusy}
            onClick={() => void ask.alwaysAllow({ scope: 'workspace' })}
          >
            {ask.alwaysAllowLabel}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={ask.isBusy}
            onClick={() => ask.deny({ reason: '' })}
            className="text-danger hover:text-danger"
          >
            Deny
          </Button>
          <span className="ml-auto" />
          {moreActions}
        </div>
      )}
    </TranscriptShell>
  );
};
