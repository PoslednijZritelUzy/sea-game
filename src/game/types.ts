export type CellType = "sea" | "island";

export interface Cell {
  x: number;
  y: number;
  depth: number;
  type: CellType;
  hasTreasure: boolean;
}

export interface Ship {
  x: number;
  y: number;
}