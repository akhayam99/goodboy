export const checkBrandMarks = ({ fail, probe, brands }) => {
  probe.brandPaths.forEach((mark) => {
    const source = brands.find((entry) => entry.id === mark.brand);
    if (source === undefined) {
      fail(`provider mark ${mark.brand} has no pinned source`);
      return;
    }
    if (source.path !== mark.d) {
      fail(`provider mark ${mark.brand} differs from simple-icons ${source.slug}`);
    }
  });
  probe.brandInkColors
    .filter((mark) => mark.color === mark.ink)
    .forEach((mark) => fail(`provider mark ${mark.brand} uses the text color`));
};
