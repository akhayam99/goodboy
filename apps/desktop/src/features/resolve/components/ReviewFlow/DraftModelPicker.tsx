import { useEffect, useRef, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { clampEffortForModel } from '@goodboy/core';
import { AnchoredPopover, PopoverBody, useDropdown } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { RoutingPickerBody } from '../../../../shared/components/RoutingPicker/RoutingPickerBody';
import { SUGGESTED_LABEL } from '../../../../shared/components/RoutingPicker/autoRecommendationCopy';
import { selectResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import { kindRouting, type AgentKindRouting } from '../../../session/agent-kind';
import { draftRoutingOf } from '../../draftFixes';

type Props = {
  readonly sessionId: SessionId;
  readonly request: number;
  readonly children: ReactNode;
};

const DRAFT_MODEL_LABEL = 'Model for drafts';

export const DraftModelPicker = ({ sessionId, request, children }: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    expectedHeight: 420,
    expectedWidth: 360,
    width: 'w-[22.5rem] max-w-[calc(100vw-2rem)]',
  });
  const { open, toggle, close } = dropdown;
  const handled = useRef(request);
  const routing = useAppStore(useShallow((s) => draftRoutingOf({ state: s, sessionId })));
  const suggested = useAppStore(
    useShallow((s) =>
      kindRouting({
        kind: 'resolver',
        roleModels: selectResolvedSettings({ state: s, sessionId })?.roleModels ?? null,
      }),
    ),
  );
  const isOverridden = useAppStore((s) => s.resolveQueueView[sessionId]?.lastRouting != null);
  const connectedProviders = useAppStore(
    useShallow((s) =>
      s.providers.filter((provider) => provider.connection === 'connected').map(({ id }) => id),
    ),
  );
  const setResolveQueueView = useAppStore((s) => s.setResolveQueueView);

  useEffect(() => {
    if (request === handled.current) {
      return;
    }
    handled.current = request;
    if (!open) {
      toggle();
    }
  }, [open, request, toggle]);

  const save = (next: AgentKindRouting | null): void =>
    setResolveQueueView({ sessionId, patch: { lastRouting: next } });

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={DRAFT_MODEL_LABEL}
      className="flex max-h-[calc(100vh-1rem)] flex-col bg-subtle"
      anchorClassName="flex shrink-0"
      trigger={children}
    >
      <PopoverBody>
        <p className="px-2.5 pb-1 pt-2 text-heading text-foreground">{DRAFT_MODEL_LABEL}</p>
        <RoutingPickerBody
          connectedProviders={connectedProviders}
          onClose={close}
          recommendation={{ ...suggested, label: SUGGESTED_LABEL }}
          overridden={isOverridden}
          onReset={() => save(null)}
          provider={routing.provider}
          model={routing.model}
          effort={{
            editable: true,
            value: routing.effort,
            onChange: (effort) => save({ ...routing, effort }),
          }}
          onProvider={(provider) => (provider === '' ? save(null) : save({ ...routing, provider }))}
          onModel={(model) =>
            save({
              ...routing,
              model,
              effort:
                clampEffortForModel({
                  model,
                  effort: routing.effort,
                  provider: routing.provider,
                }) ?? routing.effort,
            })
          }
        />
      </PopoverBody>
    </AnchoredPopover>
  );
};
