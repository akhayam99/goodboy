const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });

export const waitForPaint = async (): Promise<void> => {
  if (document.fonts !== undefined) {
    await document.fonts.ready;
  }
  await nextFrame();
  await nextFrame();
};
