export const UPDATE_PILL_SIDEBARS = [200, 240, 400];
export const UPDATE_PILL_SCENES = UPDATE_PILL_SIDEBARS.map(
  (sidebar) => `u26s-update-row&sidebar=${sidebar}`,
);
export const UPDATE_PILL_WIDTHS = [1024, 1440];
export const UPDATE_PILL_READY = '[data-update-pill]';
export const UPDATE_PILL_TOLERANCE_PX = 0.5;

export const updatePillProbe = () => {
  const pill = document.querySelector('[data-update-pill]');
  const version = pill?.querySelector('[data-update-pill-version]') ?? null;
  const row = pill?.closest('[data-column-foot] > div') ?? null;
  const bug = row?.querySelector('[data-report-bug]') ?? null;
  if (pill === null || version === null || row === null) {
    return null;
  }
  const box = (element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, height: rect.height };
  };
  const lineHeight = Number.parseFloat(getComputedStyle(version).lineHeight);
  return {
    pill: box(pill),
    row: box(row),
    bug: bug === null ? null : box(bug),
    versionHeight: version.getBoundingClientRect().height,
    lineHeight: Number.isNaN(lineHeight) ? version.getBoundingClientRect().height : lineHeight,
    versionScroll: version.scrollWidth,
    versionClient: version.clientWidth,
    text: version.textContent,
  };
};

const round = (value) => Math.round(value * 10) / 10;

export const updatePillFailures = ({
  scene,
  width,
  measured,
  tolerance = UPDATE_PILL_TOLERANCE_PX,
}) => {
  if (measured === null) {
    return [{ scene, width, check: 'the Goodboy row shows the update pill' }];
  }
  const failures = [];
  if (measured.versionHeight > measured.lineHeight * 1.5) {
    failures.push({
      scene,
      width,
      check: 'the update pill holds its version on one line',
      height: round(measured.versionHeight),
      lineHeight: round(measured.lineHeight),
    });
  }
  if (measured.versionScroll > measured.versionClient + tolerance) {
    failures.push({
      scene,
      width,
      check: 'the update pill shows its whole version',
      text: measured.text,
      scroll: measured.versionScroll,
      client: measured.versionClient,
    });
  }
  if (measured.pill.right > measured.row.right + tolerance) {
    failures.push({
      scene,
      width,
      check: 'the update pill stays inside the Goodboy row',
      pill: round(measured.pill.right),
      row: round(measured.row.right),
    });
  }
  if (measured.bug !== null && measured.pill.right > measured.bug.left + tolerance) {
    failures.push({
      scene,
      width,
      check: 'the update pill never runs under the bug button',
      pill: round(measured.pill.right),
      bug: round(measured.bug.left),
    });
  }
  return failures;
};
