export type HistoryGraphBox = {
  readonly top: number;
  readonly height: number;
};

export const historyGraphHeight = ({
  boxes,
}: {
  readonly boxes: ReadonlyArray<HistoryGraphBox>;
}): number => boxes.reduce((bottom, box) => Math.max(bottom, box.top + box.height), 0);
