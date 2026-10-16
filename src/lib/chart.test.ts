import { describe, expect, it } from "vitest";
import { niceTicks } from "./chart";

describe("niceTicks", () => {
  it.each([
    [73.3, 83.3],
    [0, 2150],
    [55, 65],
    [8, 13],
    [0.4, 0.9],
    [100, 100],
  ])("covers [%d, %d] with round steps", (min, max) => {
    const ticks = niceTicks(min, max);
    expect(ticks[0]).toBeLessThanOrEqual(min);
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(max);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks.length).toBeLessThanOrEqual(7);
    const steps = new Set(ticks.slice(1).map((t, i) => Number((t - ticks[i]).toFixed(6))));
    expect(steps.size).toBe(1);
  });

  it("uses 1-2-2.5-5 steps", () => {
    expect(niceTicks(73.3, 83.3)).toEqual([72.5, 75, 77.5, 80, 82.5, 85]);
    expect(niceTicks(0, 2150)).toEqual([0, 1000, 2000, 3000]);
  });
});
