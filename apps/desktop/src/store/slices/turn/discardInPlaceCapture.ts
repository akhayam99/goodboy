type Params = Readonly<{
  capture: Readonly<{ discard: () => Promise<void> }> | null;
}>;

export const discardInPlaceCapture = async ({ capture }: Params): Promise<void> => {
  if (capture === null) {
    return;
  }
  await capture.discard();
};
