export const checkCoverage = ({ groups, clusters, featuresIds }) => {
  const covered = clusters.flatMap((cluster) => cluster.groups);
  const failures = groups
    .filter((group) => !covered.includes(group))
    .map(
      (group) => `coverage: FEATURES.md group "${group}" is in no cluster of features.data.json`,
    );
  if (featuresIds !== null) {
    clusters
      .filter((cluster) => !featuresIds.includes(cluster.id))
      .forEach((cluster) =>
        failures.push(`coverage: cluster "${cluster.id}" has no element with that id on /features`),
      );
  }
  return failures;
};
