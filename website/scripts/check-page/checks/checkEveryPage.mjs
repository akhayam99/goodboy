import { STAGE_GRADIENT_TOKEN } from '../constants.mjs';

export const checkEveryPage = ({ fail, probe, rules, viewport, budget }) => {
  const pageCap = budget.heightByViewport?.[viewport.name];
  if (!probe.isInter) {
    fail('Inter is not loaded');
  }
  if (probe.scrollWidth > probe.clientWidth) {
    fail(`horizontal overflow, ${probe.scrollWidth} px wide in ${probe.clientWidth}`);
  }
  if (pageCap !== undefined && probe.height > pageCap) {
    fail(`page is ${probe.height} px tall, the budget is ${pageCap}`);
  }
  if (viewport.isDesktop === true) {
    rules.sectionHeights
      .filter(
        (section) => budget.sectionMaxPx !== undefined && section.height > budget.sectionMaxPx,
      )
      .forEach((section) =>
        fail(
          `section ${section.name} is ${section.height} px tall, the budget is ${budget.sectionMaxPx}`,
        ),
      );
  }
  if (probe.hasEmDash) {
    fail('an em dash in visible text');
  }
  probe.shadowed.forEach((name) => fail(`a shadow on ${name}`));
  probe.paintedGradients.forEach((name) =>
    fail(`a gradient other than ${STAGE_GRADIENT_TOKEN} paints ${name}`),
  );
  probe.tablists.forEach((tablist) => {
    if (tablist.selected !== 1) {
      fail(`tablist has ${tablist.selected} selected tabs`);
    }
    if (tablist.invalidControls > 0) {
      fail(`tablist has ${tablist.invalidControls} tabs without a panel`);
    }
  });
  probe.brokenImages.forEach((source) => fail(`${source} did not load`));
  probe.periods.forEach((text) => fail(`heading ends with a period: "${text}"`));
  probe.collisions.forEach((message) => fail(message));
  probe.spills.forEach((message) => fail(message));
  if (probe.heroOpacity !== null && probe.heroOpacity < 1) {
    fail(`the hero mock is at opacity ${probe.heroOpacity} after load`);
  }
  if (probe.bannerCoversH1) {
    fail('the consent card covers the h1');
  }
};
