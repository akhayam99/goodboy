export const checkFeatures = ({ fail, probe, rules, viewport, budget }) => {
  const clusterCap = budget.clusterMaxByViewport?.[viewport.name];
  if (clusterCap !== undefined) {
    rules.clusterHeights
      .filter((cluster) => cluster.height > clusterCap)
      .forEach((cluster) =>
        fail(`cluster ${cluster.name} is ${cluster.height} px tall, the budget is ${clusterCap}`),
      );
  }
  if (!probe.hasBoard) {
    fail('no board is visible on the page, so the card height rule has nothing to measure');
  }
};
