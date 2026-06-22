import type { Cell } from "./types";

export const MAP_SIZE = 41;

export function createWorld(): Cell[][] {
  const world: Cell[][] = [];

  for (let y = 0; y < MAP_SIZE; y++) {
    const row: Cell[] = [];

    for (let x = 0; x < MAP_SIZE; x++) {
      const isIsland = Math.random() < 0.08;
      const hasTreasure = !isIsland && Math.random() < 0.03;

      row.push({
        x,
        y,
        depth: isIsland ? 0 : Math.floor(Math.random() * 100) + 1,
        type: isIsland ? "island" : "sea",
        hasTreasure,
      });
    }

    world.push(row);
  }

  world[20][20].type = "sea";
  world[20][20].hasTreasure = false;
  world[20][20].depth = 50;

  return world;
}