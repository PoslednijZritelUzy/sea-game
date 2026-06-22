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
  { x: 8, y: 8, radius: 6.2, stretchX: 1.25, stretchY: 0.9 },
  { x: 31, y: 8, radius: 5.8, stretchX: 1.0, stretchY: 1.2 },
  { x: 9, y: 31, radius: 6.5, stretchX: 1.15, stretchY: 1.0 },
  { x: 31, y: 31, radius: 6.1, stretchX: 0.95, stretchY: 1.25 },
  { x: 21, y: 20, radius: 6.8, stretchX: 1.3, stretchY: 0.85 },
];

export function createWorld(): Cell[][] {
  const world: Cell[][] = [];

  for (let y = 0; y < MAP_SIZE; y++) {
    const row: Cell[] = [];

    for (let x = 0; x < MAP_SIZE; x++) {
      const islandValue = getIslandValue(x, y);
      const nearestCoastDistance = getNearestCoastDistance(x, y);

      const isIsland = islandValue >= 1;

      const depth = isIsland
        ? 0
        : getOceanDepth(x, y, nearestCoastDistance);

      row.push({
        x,
        y,
        depth,
        type: isIsland ? "island" : "sea",
        hasTreasure: !isIsland && nearestCoastDistance < 4 && Math.random() < 0.04,
      });
    }

    world.push(row);
  }

  world[20][20].type = "sea";
  world[20][20].depth = 45;
  world[20][20].hasTreasure = false;

  return world;
}

function getIslandValue(x: number, y: number): number {
  let maxValue = 0;

  for (const island of ISLANDS) {
    const dx = (x - island.x) / (island.radius * island.stretchX);
    const dy = (y - island.y) / (island.radius * island.stretchY);

    const base = 1 - Math.sqrt(dx * dx + dy * dy);

    const coastNoise =
      Math.sin(x * 0.75 + y * 0.31) * 0.12 +
      Math.sin(x * 1.37 - y * 0.58) * 0.08 +
      Math.sin((x + y) * 0.43) * 0.07;

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
    depth = 8 + coastDistance * 12;
  } else if (coastDistance < 5) {
    depth = 30 + (coastDistance - 2) * 14;
  } else if (coastDistance < 10) {
    depth = 75 + (coastDistance - 5) * 13;
  } else {
    depth = 145 + (coastDistance - 10) * 8;
  }

  depth += oceanNoise * 18;
  depth += trench * 90;

  return Math.max(1, Math.floor(depth));
}

function getOceanNoise(x: number, y: number): number {
  return (
    Math.sin(x * 0.29 + y * 0.17) * 0.45 +
    Math.sin(x * 0.11 - y * 0.23) * 0.35 +
    Math.sin((x + y) * 0.09) * 0.2
  );
}

function getTrenchValue(x: number, y: number): number {
  const lineX = 24 + Math.sin(y * 0.22) * 5;
  const distance = Math.abs(x - lineX);

  if (distance > 5) return 0;

  return 1 - distance / 5;
}