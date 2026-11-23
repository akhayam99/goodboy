import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore, type SessionFace } from '../../../store';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { NAMES } from '../../../shared/utils/names';
import { switchSessionFace } from '../../../features/session/components/SessionDesk/switchSessionFace';
import { FACE_SWITCH_LABEL } from '../../../features/session/components/SessionDesk/focusDeskControl';
import { useDeskOffReason } from '../../../features/session/components/SessionDesk/useDeskOffReason';

type Props = {
  readonly sessionId: SessionId;
  readonly isFacePage: boolean;
};

export const FaceSwitch = ({ sessionId, isFacePage }: Props) => {
  const face = useAppStore((state) => state.sessionFace[sessionId] ?? 'overview');
  const offReason = useDeskOffReason({ sessionId });
  const tooltip = shortcutGlyphs('session.desk');
  const options: ReadonlyArray<SegmentedTabOption<SessionFace>> = [
    { value: 'overview', label: NAMES.overview, tooltip },
    {
      value: 'desk',
      label: NAMES.desk,
      tooltip: offReason ?? tooltip,
      disabled: offReason !== null && face !== 'desk',
    },
  ];
  return (
    <SegmentedTabs
      ariaLabel={FACE_SWITCH_LABEL}
      size="xs"
      options={options}
      value={isFacePage ? face : null}
      onChange={(next) => switchSessionFace({ sessionId, face: next })}
    />
  );
};
