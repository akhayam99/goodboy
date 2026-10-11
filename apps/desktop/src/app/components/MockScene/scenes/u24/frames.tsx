import { GuideStudio } from '../../../../../features/settings/components/GuideStudio';
import { ChatRoomScene } from '../ChatRoomScene';
import { OverviewFullScene } from '../OverviewFullScene';
import { FramedStudioScene } from '../u23/FramedStudioScene';
import { FrameStage } from './FrameStage';

const noop = () => undefined;

const RAIL_WIDTH_PX = 1440;
const PINNED_WIDTH_PX = 1100;
const WIDE_WIDTH_PX = 1920;

export const U24_FRAMES_SCENES = {
  'frames-guide-rail': () => (
    <FrameStage id="frames-guide-rail" width={RAIL_WIDTH_PX}>
      <FramedStudioScene kind="guide" place="link">
        <GuideStudio onClose={noop} />
      </FramedStudioScene>
    </FrameStage>
  ),
  'frames-guide-pinned': () => (
    <FrameStage id="frames-guide-pinned" width={PINNED_WIDTH_PX}>
      <FramedStudioScene kind="guide" place="link">
        <GuideStudio onClose={noop} />
      </FramedStudioScene>
    </FrameStage>
  ),
  'frames-chat-rail': () => (
    <FrameStage id="frames-chat-rail" width={RAIL_WIDTH_PX}>
      <ChatRoomScene />
    </FrameStage>
  ),
  'frames-overview-rail-1920': () => (
    <FrameStage id="frames-overview-rail-1920" width={WIDE_WIDTH_PX}>
      <OverviewFullScene />
    </FrameStage>
  ),
};
