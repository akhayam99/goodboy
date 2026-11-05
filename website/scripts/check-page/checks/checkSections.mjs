const PAGE_EYEBROWS = ['Free desktop ADE, built in public', 'Install', 'All features'];
const MAX_ALSO_LINES = 2;

export const checkSections = ({ fail, probe, rules, viewport, groups }) => {
  rules.rowCollisions.forEach((message) => fail(`run row: ${message}`));
  if (viewport.isDesktop === true) {
    rules.alsoLines
      .filter((entry) => entry.lines > MAX_ALSO_LINES)
      .forEach((entry) =>
        fail(
          `the Also line "${entry.name}" runs ${entry.lines} lines, the limit is ${MAX_ALSO_LINES}`,
        ),
      );
  }
  rules.crowded.forEach((message) => fail(message));
  rules.sameTone.forEach((message) => fail(message));
  rules.cardEdges.forEach((message) => fail(message));
  probe.eyebrows
    .filter((eyebrow) => eyebrow.group !== null && !groups.includes(eyebrow.group))
    .forEach((eyebrow) => fail(`eyebrow "${eyebrow.text}" is not a FEATURES.md group`));
  probe.eyebrows
    .filter((eyebrow) => eyebrow.group === null)
    .filter((eyebrow) => !PAGE_EYEBROWS.includes(eyebrow.text))
    .forEach((eyebrow) => fail(`eyebrow "${eyebrow.text}" names neither a feature nor a page`));
};
