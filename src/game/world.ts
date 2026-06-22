import type { Cell } from "./types";

export const MAP_SIZE = 41;

type Island = {
  x: number;
  y: number;
  radius: number;
  stretchX: number;
  stretchY: number;
};

const ISLANDS: Island[] = [
  { x: 7, y: 7, radius: 8.8, stretchX: 1.35, stretchY: 1.0 },
  { x: 33, y: 7, radius: 8.2, stretchX: 1.05, stretchY: 1.35 },
  { x: 7, y: 33, radius: 8.4, stretchX: 1.3, stretchY: 1.05 },
  { x: 33, y: 33, radius: 8.0, stretchX: 1.05, stretchY: 1.35 },
  { x: 20, y: 20, radius: 8.6, stretchX: 1.45, stretchY: 0.95 },
];

export function createWorld(): Cell[][] {
  const world: Cell[][] = [];

  for (let y = 0; y < MAP_SIZE; y++) {
    const row: Cell[] = [];

    for (let x = 0; x < MAP_SIZE; x++) {
      const islandValue = getIslandValue(x, y);
      const isIsland = islandValue >= 1;
      const coastDistance = getNearestCoastDistance(x, y);

      const depth = isIsland ? 0 : getOceanDepth(x, y, coastDistance);

      row.push({
        x,
        y,
        depth,
        type: isIsland ? "island" : "sea",
        hasTreasure:
          !isIsland &&
          coastDistance > 1 &&
          coastDistance < 5 &&
          Math.random() < 0.05,
      });
    }

    world.push(row);
  }

  world[20][20].type = "sea";
  world[20][20].depth = 120;
  world[20][20].hasTreasure = false;

  return world;
}

function getIslandValue(x: number, y: number): number {
  let maxValue = 0;

  for (const island of ISLANDS) {
    const dx = (x - island.x) / (island.radius * island.stretchX);
    const dy = (y - island.y) / (island.radius * island.stretchY);

    const distance = Math.sqrt(dx * dx + dy * dy);
    const base = 1 - distance;

    const coastNoise =
      Math.sin(x * 0.55 + y * 0.21) * 0.22 +
      Math.sin(x * 1.15 - y * 0.42) * 0.16 +
      Math.sin((x + y) * 0.31) * 0.12;

    maxValue = Math.max(maxValue, base + coastNoise);
  }

  return maxValue;
}

function getNearestCoastDistance(x: number, y: number): number {
  let minDistance = Infinity;

  for (const island of ISLANDS) {
    const dx = (x - island.x) / island.stretchX;
    const dy = (y - island.y) / island.stretchY;

    const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
    const distanceFromCoast = Math.max(0, distanceFromCenter - island.radius);

    minDistance = Math.min(minDistance, distanceFromCoast);
  }

  return minDistance;
}

function getOceanDepth(x: number, y: number, coastDistance: number): number {
  const trench = getTrenchValue(x, y);
  const oceanNoise = getOceanNoise(x, y);

  let depth: number;

  if (coastDistance < 2) {
    depth = 35 + coastDistance * 20;
  } else if (coastDistance < 5) {
    depth = 80 + (coastDistance - 2) * 22;
  } else if (coastDistance < 10) {
    depth = 150 + (coastDistance - 5) * 20;
  } else {
    depth = 260 + (coastDistance - 10) * 14;
  }

  depth += oceanNoise * 25;
  depth += trench * 150;

  return Math.max(20, Math.floor(depth));
}

function getOceanNoise(x: number, y: number): number {
  return (
    Math.sin(x * 0.29 + y * 0.17) * 0.45 +
    Math.sin(x * 0.11 - y * 0.23) * 0.35 +
    Math.sin((x + y) * 0.09) * 0.2
  );
}

function getTrenchValue(x: number, y: number): number {
  const lineX = 23 + Math.sin(y * 0.22) * 5;
  const distance = Math.abs(x - lineX);

  if (distance > 5) return 0;

  return 1 - distance / 5;
}