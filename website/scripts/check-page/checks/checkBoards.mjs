const BOARD_ROW_TOLERANCE_PX = 1;

export const checkBoards = ({ fail, probe }) => {
  if (probe.boardRows.length === 0 && probe.hasBoard) {
    fail('no board card rows were measured');
  }
  probe.boardRows
    .filter((entry) => entry.spread > BOARD_ROW_TOLERANCE_PX)
    .forEach((entry) =>
      fail(
        `board cards in row ${entry.row + 1} differ in height by ${entry.spread.toFixed(1)} px (${entry.heights.join(', ')})`,
      ),
    );
};
