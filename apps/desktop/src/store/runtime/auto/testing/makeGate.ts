export type Gate = Readonly<{
  promise: Promise<void>;
  open: () => void;
}>;

export const makeGate = (): Gate => {
  const holder: { open: () => void } = { open: () => undefined };
  const promise = new Promise<void>((resolve) => {
    holder.open = resolve;
  });
  return { promise, open: () => holder.open() };
};
