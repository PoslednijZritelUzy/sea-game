import type { Cell } from "./types";

export const MAP_SIZE = 41;

type Island = {
  x: number;
  y: number;
  radius: number;
  stretchX: number;
  stretchY: number;
  noisePower: number;
};

const ISLANDS: Island[] = [
  { x: 6, y: 6, radius: 6.6, stretchX: 1.35, stretchY: 1.0, noisePower: 0.23 },
  { x: 20, y: 6, radius: 5.4, stretchX: 1.1, stretchY: 1.25, noisePower: 0.2 },
  { x: 34, y: 7, radius: 6.2, stretchX: 1.0, stretchY: 1.35, noisePower: 0.24 },

  { x: 8, y: 20, radius: 5.8, stretchX: 1.45, stretchY: 0.95, noisePower: 0.25 },
  { x: 22, y: 20, radius: 7.0, stretchX: 1.35, stretchY: 1.05, noisePower: 0.27 },
  { x: 34, y: 21, radius: 5.5, stretchX: 0.95, stretchY: 1.45, noisePower: 0.22 },

  { x: 6, y: 34, radius: 6.4, stretchX: 1.25, stretchY: 1.1, noisePower: 0.24 },
  { x: 20, y: 34, radius: 5.5, stretchX: 1.2, stretchY: 1.25, noisePower: 0.21 },
  { x: 34, y: 34, radius: 6.0, stretchX: 1.05, stretchY: 1.35, noisePower: 0.24 },
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
          coastDistance > 1.2 &&
          coastDistance < 5.5 &&
          Math.random() < 0.045,
      });
    }

    world.push(row);
  }

  ensureStartCellIsSea(world);

  return world;
}

function ensureStartCellIsSea(world: Cell[][]) {
  const safeCells: Point[] = [
    { x: 20, y: 20 },
    { x: 19, y: 20 },
    { x: 21, y: 20 },
    { x: 20, y: 19 },
    { x: 20, y: 21 },
  ];

  for (const point of safeCells) {
    world[point.y][point.x].type = "sea";
    world[point.y][point.x].depth = 140;
    world[point.y][point.x].hasTreasure = false;
  }
}

type Point = {
  x: number;
  y: number;
};

function getIslandValue(x: number, y: number): number {
  let maxValue = 0;

  for (const island of ISLANDS) {
    const dx = (x - island.x) / (island.radius * island.stretchX);
    const dy = (y - island.y) / (island.radius * island.stretchY);

    const distance = Math.sqrt(dx * dx + dy * dy);
    const base = 1 - distance;

    const coastNoise =
      Math.sin(x * 0.47 + y * 0.19) * island.noisePower +
      Math.sin(x * 1.09 - y * 0.37) * island.noisePower * 0.75 +
      Math.sin((x + y) * 0.27) * island.noisePower * 0.55 +
      Math.sin((x - y) * 0.61) * island.noisePower * 0.35;

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
  const shelfNoise = getShelfNoise(x, y);
  const ridge = getRidgeValue(x, y);
  const trenchA = getTrenchValue(x, y, 25, 0.22, 4.8);
  const trenchB = getTrenchValue(y, x, 14, 0.17, 3.8);
  const basin = getBasinValue(x, y);

  let depth: number;

  if (coastDistance < 1.5) {
    depth = 30 + coastDistance * 22;
  } else if (coastDistance < 4) {
    depth = 75 + (coastDistance - 1.5) * 28;
  } else if (coastDistance < 8) {
    depth = 145 + (coastDistance - 4) * 30;
  } else {
    depth = 275 + (coastDistance - 8) * 18;
  }

  depth += shelfNoise * 55;
  depth += trenchA * 180;
  depth += trenchB * 120;
  depth += basin * 130;
  depth -= ridge * 90;

  return Math.max(18, Math.floor(depth));
}

function getShelfNoise(x: number, y: number): number {
  return (
    Math.sin(x * 0.31 + y * 0.13) * 0.36 +
    Math.sin(x * 0.18 - y * 0.41) * 0.31 +
    Math.sin((x + y) * 0.12) * 0.24 +
    Math.sin((x - y) * 0.52) * 0.18
  );
}

function getTrenchValue(
  x: number,
  y: number,
  baseLine: number,
  wave: number,
  width: number
): number {
  const line = baseLine + Math.sin(y * wave) * 5 + Math.sin(y * 0.07) * 3;
  const distance = Math.abs(x - line);

  if (distance > width) return 0;

  return 1 - distance / width;
}

function getRidgeValue(x: number, y: number): number {
  const lineY = 22 + Math.sin(x * 0.24) * 4;
  const distance = Math.abs(y - lineY);

  if (distance > 4.5) return 0;

  return 1 - distance / 4.5;
}

function getBasinValue(x: number, y: number): number {
  const dx = (x - 29) / 8;
  const dy = (y - 16) / 6;

  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > 1.4) return 0;

  return 1 - distance / 1.4;
}