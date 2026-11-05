const HERO_MOCK_VISIBLE_PX = 380;
const HERO_FIRST_SCREEN_PX = 900;

export const checkHome = ({ fail, rules, viewport }) => {
  if (rules.heroMock === null) {
    fail('no [data-hero-mock] on the home page');
  } else if (viewport.isDesktop === true) {
    const visible =
      Math.min(rules.heroMock.bottom, HERO_FIRST_SCREEN_PX) - Math.max(rules.heroMock.top, 0);
    if (visible < HERO_MOCK_VISIBLE_PX) {
      fail(
        `${Math.round(Math.max(visible, 0))} px of the hero mock show in the first ${HERO_FIRST_SCREEN_PX} px, at least ${HERO_MOCK_VISIBLE_PX} are needed`,
      );
    }
  }
  if (viewport.isFirstScreen === true) {
    if (rules.worksWith === null) {
      fail('no [data-works-with] on the home page');
    } else if (rules.worksWith.top < 0 || rules.worksWith.bottom > viewport.height) {
      fail(
        `Works with spans ${Math.round(rules.worksWith.top)} to ${Math.round(rules.worksWith.bottom)} px, the first screen is ${viewport.height} px`,
      );
    }
  }
  rules.headingEdges.forEach((message) => fail(message));
};
