/**
 * Round axis ticks on a 1 / 2 / 2.5 / 5 x 10^n step, about four intervals,
 * always covering [min, max] so no point is drawn outside the axis.
 */
export function niceTicks(min: number, max: number): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
  const ticks = [Math.floor(min / step) * step];
  while (ticks[ticks.length - 1] < max - 1e-9) ticks.push(ticks[ticks.length - 1] + step);
  return ticks.map((t) => Number(t.toFixed(6)));
}
