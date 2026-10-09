import type { SessionId } from '@goodboy/types';
import { RoutingPickerBody } from '../../../../shared/components/RoutingPicker/RoutingPickerBody';
import { SUGGESTED_LABEL } from '../../../../shared/components/RoutingPicker/autoRecommendationCopy';
import { useDraftRouting } from './useDraftRouting';

type Props = {
  readonly sessionId: SessionId;
  readonly onClose: () => void;
};

export const DraftRoutingBody = ({ sessionId, onClose }: Props) => {
  const draft = useDraftRouting({ sessionId });
  return (
    <RoutingPickerBody
      connectedProviders={draft.connectedProviders}
      onClose={onClose}
      recommendation={{ ...draft.suggested, label: SUGGESTED_LABEL }}
      overridden={draft.isOverridden}
      onReset={() => draft.save(null)}
      provider={draft.routing.provider}
      model={draft.routing.model}
      effort={{ editable: true, value: draft.routing.effort }}
      onChange={(route) =>
        draft.save(
          route.provider === '' ? null : { ...draft.routing, ...route, provider: route.provider },
        )
      }
    />
  );
};
