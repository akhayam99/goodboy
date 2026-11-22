import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore, type SessionFace } from '../../../store';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { NAMES } from '../../../shared/utils/names';
import { switchSessionFace } from '../../../features/session/components/SessionDesk/switchSessionFace';

type Props = {
  readonly sessionId: SessionId;
  readonly isFacePage: boolean;
};

export const FaceSwitch = ({ sessionId, isFacePage }: Props) => {
  const face = useAppStore((state) => state.sessionFace[sessionId] ?? 'overview');
  const tooltip = shortcutGlyphs('session.desk');
  const options: ReadonlyArray<SegmentedTabOption<SessionFace>> = [
    { value: 'overview', label: NAMES.overview, tooltip },
    { value: 'desk', label: NAMES.desk, tooltip },
  ];
  return (
    <SegmentedTabs
      ariaLabel={`${NAMES.overview} or ${NAMES.desk}`}
      size="xs"
      options={options}
      value={isFacePage ? face : null}
      onChange={(next) => switchSessionFace({ sessionId, face: next })}
    />
  );
};
