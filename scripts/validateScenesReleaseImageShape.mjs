export const RELEASE_IMAGE_SHAPE_SCENE = 'u32-release-images';
export const RELEASE_IMAGE_SHAPE_WIDTHS = [480, 1024, 1440];
export const RELEASE_IMAGE_SHAPE_READY = '[data-release-image-case] img';
export const RELEASE_IMAGE_MAX_HEIGHT_PX = 480;
export const RELEASE_IMAGE_ASPECT_TOLERANCE = 0.01;
export const RELEASE_IMAGE_EDGE_TOLERANCE_PX = 0.5;

export const releaseImageShapeProbe = async () => {
  const box = (element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  };
  const frameOf = (element) => {
    let node = element.parentElement;
    while (node !== null && getComputedStyle(node).overflow !== 'hidden') {
      node = node.parentElement;
    }
    return node;
  };
  const shownImageOf = (holder) =>
    [...holder.querySelectorAll('img')].find(
      (image) => getComputedStyle(image).visibility === 'visible',
    ) ?? null;
  const measure = (holder) => {
    const image = shownImageOf(holder);
    const frame = image === null ? null : frameOf(image);
    if (image === null || frame === null) {
      return null;
    }
    const shown = box(image);
    return {
      src: image.getAttribute('src'),
      natural: { width: image.naturalWidth, height: image.naturalHeight },
      image: { ...shown, width: shown.right - shown.left, height: shown.bottom - shown.top },
      frame: { ...box(frame), height: frame.getBoundingClientRect().height },
    };
  };
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const results = [];
  for (const holder of document.querySelectorAll('[data-release-image-case]')) {
    const label = holder.getAttribute('data-release-image-case') ?? '';
    const after = measure(holder);
    const before = [...holder.querySelectorAll('[role="tab"]')].find(
      (tab) => (tab.textContent ?? '').trim() === 'Before',
    );
    let afterPress = null;
    if (before instanceof HTMLElement) {
      before.click();
      await pause(400);
      afterPress = measure(holder);
    }
    results.push({ label, after, afterPress });
  }
  return results;
};

const round = (value) => Math.round(value * 100) / 100;

const shapeFailures = ({ scene, width, label, step, measured, aspectTolerance, edge }) => {
  if (measured === null) {
    return [{ scene, width, label, step, check: 'a picture is shown inside its frame' }];
  }
  const failures = [];
  const { natural, image, frame } = measured;
  const natureAspect = natural.width / natural.height;
  const shownAspect = image.width / image.height;
  if (Math.abs(shownAspect / natureAspect - 1) > aspectTolerance) {
    failures.push({
      scene,
      width,
      label,
      step,
      check: 'the picture keeps its natural aspect ratio',
      natural: round(natureAspect),
      shown: round(shownAspect),
    });
  }
  const isInside =
    image.left >= frame.left - edge &&
    image.right <= frame.right + edge &&
    image.top >= frame.top - edge &&
    image.bottom <= frame.bottom + edge;
  if (!isInside) {
    failures.push({ scene, width, label, step, check: 'the picture sits inside its frame' });
  }
  if (image.width > frame.right - frame.left + edge) {
    failures.push({
      scene,
      width,
      label,
      step,
      check: 'the picture is never wider than its frame',
      picture: round(image.width),
      frame: round(frame.right - frame.left),
    });
  }
  if (image.height > RELEASE_IMAGE_MAX_HEIGHT_PX + edge) {
    failures.push({
      scene,
      width,
      label,
      step,
      check: `the picture is never taller than ${RELEASE_IMAGE_MAX_HEIGHT_PX}px`,
      picture: round(image.height),
    });
  }
  return failures;
};

export const releaseImageShapeFailures = ({
  scene,
  width,
  cases,
  aspectTolerance = RELEASE_IMAGE_ASPECT_TOLERANCE,
  edge = RELEASE_IMAGE_EDGE_TOLERANCE_PX,
}) => {
  if (cases.length === 0) {
    return [{ scene, width, check: 'no release picture to measure' }];
  }
  const failures = [];
  for (const { label, after, afterPress } of cases) {
    failures.push(
      ...shapeFailures({ scene, width, label, step: 'after', measured: after, aspectTolerance, edge }),
    );
    if (afterPress === null) {
      continue;
    }
    failures.push(
      ...shapeFailures({
        scene,
        width,
        label,
        step: 'before',
        measured: afterPress,
        aspectTolerance,
        edge,
      }),
    );
    if (after !== null && afterPress.src === after.src) {
      failures.push({ scene, width, label, check: 'pressing Before shows the before picture' });
    }
    if (after !== null && Math.abs(afterPress.frame.height - after.frame.height) > edge) {
      failures.push({
        scene,
        width,
        label,
        check: 'the frame keeps its height when Before is pressed',
        afterHeight: round(after.frame.height),
        beforeHeight: round(afterPress.frame.height),
      });
    }
  }
  return failures;
};

export const runReleaseImageShape = async ({ send, only, measure, open, run }) => {
  if (only !== undefined && only !== 'release-image-shape') {
    return;
  }
  const scene = RELEASE_IMAGE_SHAPE_SCENE;
  await measure({
    scene,
    task: async () => {
      const failures = [];
      for (const width of RELEASE_IMAGE_SHAPE_WIDTHS) {
        await open({ send, scene, width, zoom: 1, readySelector: RELEASE_IMAGE_SHAPE_READY });
        const cases = await run(send, releaseImageShapeProbe, null);
        failures.push(...releaseImageShapeFailures({ scene, width, cases }));
        for (const { label, after, afterPress } of cases) {
          console.log(
            `${scene} ${width} ${label}: after ${round(after?.image.width ?? 0)}x${round(after?.image.height ?? 0)} frame ${round(after?.frame.height ?? 0)}, before ${round(afterPress?.image.width ?? 0)}x${round(afterPress?.image.height ?? 0)} frame ${round(afterPress?.frame.height ?? 0)}`,
          );
        }
      }
      console.log(
        `${scene}: ${RELEASE_IMAGE_SHAPE_WIDTHS.length} widths, ${failures.length} shape failures`,
      );
      return { failures, wraps: 0 };
    },
  });
};
