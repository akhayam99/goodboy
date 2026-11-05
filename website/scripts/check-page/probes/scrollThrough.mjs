const SCROLL_STEP_PX = 600;
const SCROLL_PAUSE_MS = 60;

export const scrollThrough = ({ evaluate }) =>
  evaluate(`(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += ${SCROLL_STEP_PX}) {
      window.scrollTo(0, y);
      await new Promise((done) => setTimeout(done, ${SCROLL_PAUSE_MS}));
    }
    await Promise.all([...document.images].filter((image) => image.getClientRects().length > 0).map((image) => image.decode().catch(() => null)));
    window.scrollTo(0, 0);
    return true;
  })()`);
