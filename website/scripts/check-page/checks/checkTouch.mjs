import { MIN_TOUCH_FONT_PX, MIN_TOUCH_TARGET_PX } from '../constants.mjs';

const PAGES_WITH_DOWNLOAD = ['home'];
const DOWNLOAD_PREFIX = 'https://github.com/akhayam99/goodboy/releases/download/';

export const checkTouch = ({ fail, page, probe, touch, viewport, isMarketing }) => {
  if (viewport.isTouch === true) {
    if (!probe.isCoarse) {
      fail('touch emulation did not give a coarse pointer');
    }
    if (probe.downloads > 0) {
      fail(`${probe.downloads} download links or Homebrew blocks show on a touch device`);
    }
    if (isMarketing && probe.stars === 0) {
      fail('no Star on GitHub button on a touch device');
    }
  } else if (PAGES_WITH_DOWNLOAD.includes(page) && probe.downloads === 0) {
    fail('no download link shows with a fine pointer');
  }
  probe.downloadHrefs
    .filter((href) => !href.startsWith(DOWNLOAD_PREFIX))
    .forEach((href) =>
      fail(`a data-download link goes to ${href}, not a /releases/download/ asset`),
    );
  if (touch !== null) {
    touch.smallText.forEach((message) => fail(`text under ${MIN_TOUCH_FONT_PX} px, ${message}`));
    touch.smallTargets.forEach((message) =>
      fail(`touch target under ${MIN_TOUCH_TARGET_PX} px, ${message}`),
    );
    if (!touch.hasMenu) {
      fail('no visible menu button on a touch device');
    }
  }
};
