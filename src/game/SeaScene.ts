import Phaser from "phaser";
import { createWorld, MAP_SIZE } from "./world";
import type { Cell, Ship } from "./types";

const TILE_SIZE = 16;
const PLAYER_MOVE_DELAY = 18;
const NPC_MOVE_DELAY = 320;
const NPC_COUNT = 0;

type Point = { x: number; y: number };
type SmoothPoint = { px: number; py: number };

type TrailPoint = {
  px: number;
  py: number;
  createdAt: number;
};

type NpcShip = {
  x: number;
  y: number;
  px: number;
  py: number;
  route: Point[];
  isMoving: boolean;
};

export class SeaScene extends Phaser.Scene {
  private world: Cell[][] = [];

  private ship: Ship = { x: 20, y: 20 };
  private shipPx = 20 * TILE_SIZE + TILE_SIZE / 2;
  private shipPy = 20 * TILE_SIZE + TILE_SIZE / 2;
  private isPlayerMoving = false;

  private npcs: NpcShip[] = [];

  private smoothRoute: SmoothPoint[] = [];
  private target?: Point;

  private shipPath: TrailPoint[] = [
    {
      px: 20 * TILE_SIZE + TILE_SIZE / 2,
      py: 20 * TILE_SIZE + TILE_SIZE / 2,
      createdAt: 0,
    },
  ];

  private spaceKey?: Phaser.Input.Keyboard.Key;
  private graphics?: Phaser.GameObjects.Graphics;
  private hudText?: Phaser.GameObjects.Text;
  private treasuresFound = 0;

  constructor() {
    super("SeaScene");
  }

  create() {
    this.world = createWorld();
    this.shipPath[0].createdAt = this.time.now;

    this.createNpcShips();

    this.spaceKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );

    this.graphics = this.add.graphics();

    this.hudText = this.add.text(8, 8, "", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#ffffff",
      backgroundColor: "#000000",
      padding: { x: 6, y: 4 },
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.selectTarget(pointer);
    });
  }

  update() {
    this.followSmoothRoute();
    this.updateNpcShips();

    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.dig();
    }

    this.drawWorld();
    this.updateHud();
  }

  private cellToPx(value: number): number {
    return value * TILE_SIZE + TILE_SIZE / 2;
  }

  private pixelToCell(value: number): number {
    return Phaser.Math.Clamp(Math.floor(value / TILE_SIZE), 0, MAP_SIZE - 1);
  }

  private createNpcShips() {
    for (let i = 0; i < NPC_COUNT; i++) {
      const point = this.getRandomSeaPoint();

      this.npcs.push({
        x: point.x,
        y: point.y,
        px: this.cellToPx(point.x),
        py: this.cellToPx(point.y),
        route: [],
        isMoving: false,
      });
    }
  }

  private updateNpcShips() {
    for (const npc of this.npcs) {
      if (npc.isMoving) continue;

      if (npc.route.length === 0) {
        const target = this.getRandomSeaPoint();
        npc.route = this.findGridPath({ x: npc.x, y: npc.y }, target);
      }

      const next = npc.route.shift();
      if (!next) continue;

      npc.isMoving = true;

      this.tweens.add({
        targets: npc,
        px: this.cellToPx(next.x),
        py: this.cellToPx(next.y),
        duration: NPC_MOVE_DELAY,
        ease: "Sine.easeInOut",
        onComplete: () => {
          npc.x = next.x;
          npc.y = next.y;
          npc.isMoving = false;
        },
      });
    }
  }

  private getRandomSeaPoint(): Point {
    while (true) {
      const x = Phaser.Math.Between(0, MAP_SIZE - 1);
      const y = Phaser.Math.Between(0, MAP_SIZE - 1);

      if (this.world[y][x].type === "sea") {
        return { x, y };
      }
    }
  }

  private selectTarget(pointer: Phaser.Input.Pointer) {
    const x = Math.floor(pointer.x / TILE_SIZE);
    const y = Math.floor(pointer.y / TILE_SIZE);

    if (x < 0 || x >= MAP_SIZE) return;
    if (y < 0 || y >= MAP_SIZE) return;

    if (this.world[y][x].type === "island") {
      console.log("Cannot sail to island.");
      return;
    }

    const start = {
      x: this.pixelToCell(this.shipPx),
      y: this.pixelToCell(this.shipPy),
    };

    const gridPath = this.findGridPath(start, { x, y });

    if (gridPath.length === 0) {
      console.log("No route found.");
      return;
    }

    this.target = { x, y };

    const fullGridPath = [start, ...gridPath];
    const simplified = this.simplifyByLineOfSight(fullGridPath);

    this.smoothRoute = this.buildCatmullRomRoute(simplified);
  }

  private followSmoothRoute() {
    if (this.isPlayerMoving) return;
    if (this.smoothRoute.length === 0) return;

    const next = this.smoothRoute.shift();
    if (!next) return;

    this.isPlayerMoving = true;

    this.shipPath.push({
      px: next.px,
      py: next.py,
      createdAt: this.time.now,
    });

    this.tweens.add({
      targets: this,
      shipPx: next.px,
      shipPy: next.py,
      duration: PLAYER_MOVE_DELAY,
      ease: "Linear",
      onComplete: () => {
        this.isPlayerMoving = false;

        const cellX = this.pixelToCell(this.shipPx);
        const cellY = this.pixelToCell(this.shipPy);

        if (this.world[cellY][cellX].type === "sea") {
          this.ship.x = cellX;
          this.ship.y = cellY;
        }

        if (
          this.target &&
          Math.abs(this.shipPx - this.cellToPx(this.target.x)) < 1 &&
          Math.abs(this.shipPy - this.cellToPx(this.target.y)) < 1
        ) {
          this.ship.x = this.target.x;
          this.ship.y = this.target.y;
          this.target = undefined;
        }
      },
    });
  }

  private findGridPath(start: Point, goal: Point): Point[] {
    const queue: Point[] = [start];
    const cameFrom = new Map<string, Point | null>();

    cameFrom.set(this.pointKey(start), null);

    const directions: Point[] = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.x === goal.x && current.y === goal.y) break;

      for (const direction of directions) {
        const next: Point = {
          x: current.x + direction.x,
          y: current.y + direction.y,
        };

        if (next.x < 0 || next.x >= MAP_SIZE) continue;
        if (next.y < 0 || next.y >= MAP_SIZE) continue;
        if (this.world[next.y][next.x].type === "island") continue;

        const key = this.pointKey(next);
        if (cameFrom.has(key)) continue;

        cameFrom.set(key, current);
        queue.push(next);
      }
    }

    if (!cameFrom.has(this.pointKey(goal))) return [];

    const path: Point[] = [];
    let current: Point | null = goal;

    while (current !== null) {
      path.push(current);
      current = cameFrom.get(this.pointKey(current)) ?? null;
    }

    path.reverse();
    return path.slice(1);
  }

  private simplifyByLineOfSight(path: Point[]): Point[] {
    if (path.length <= 2) return path;

    const result: Point[] = [path[0]];
    let anchorIndex = 0;

    for (let i = 2; i < path.length; i++) {
      const anchor = path[anchorIndex];
      const candidate = path[i];

      if (!this.hasSeaLine(anchor, candidate)) {
        result.push(path[i - 1]);
        anchorIndex = i - 1;
      }
    }

    result.push(path[path.length - 1]);
    return result;
  }

  private hasSeaLine(from: Point, to: Point): boolean {
    const fromPx = this.cellToPx(from.x);
    const fromPy = this.cellToPx(from.y);
    const toPx = this.cellToPx(to.x);
    const toPy = this.cellToPx(to.y);

    const distance = Phaser.Math.Distance.Between(fromPx, fromPy, toPx, toPy);
    const steps = Math.max(2, Math.ceil(distance / 4));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = Phaser.Math.Linear(fromPx, toPx, t);
      const py = Phaser.Math.Linear(fromPy, toPy, t);

      const cellX = this.pixelToCell(px);
      const cellY = this.pixelToCell(py);

      if (this.world[cellY][cellX].type === "island") {
        return false;
      }
    }

    return true;
  }

  private buildCatmullRomRoute(points: Point[]): SmoothPoint[] {
    if (points.length < 2) return [];

    const pixelPoints: SmoothPoint[] = points.map((point) => ({
      px: this.cellToPx(point.x),
      py: this.cellToPx(point.y),
    }));

    const result: SmoothPoint[] = [];

    for (let i = 0; i < pixelPoints.length - 1; i++) {
      const p0 = pixelPoints[Math.max(0, i - 1)];
      const p1 = pixelPoints[i];
      const p2 = pixelPoints[i + 1];
      const p3 = pixelPoints[Math.min(pixelPoints.length - 1, i + 2)];

      const distance = Phaser.Math.Distance.Between(p1.px, p1.py, p2.px, p2.py);
      const steps = Math.max(8, Math.ceil(distance / 3));

      for (let step = 1; step <= steps; step++) {
        const t = step / steps;

        const px = this.catmullRom(p0.px, p1.px, p2.px, p3.px, t);
        const py = this.catmullRom(p0.py, p1.py, p2.py, p3.py, t);

        if (this.isSeaPixel(px, py)) {
          result.push({ px, py });
        } else {
          result.push({
            px: Phaser.Math.Linear(p1.px, p2.px, t),
            py: Phaser.Math.Linear(p1.py, p2.py, t),
          });
        }
      }
    }

    return result;
  }

  private catmullRom(
    p0: number,
    p1: number,
    p2: number,
    p3: number,
    t: number
  ): number {
    const t2 = t * t;
    const t3 = t2 * t;

    return (
      0.5 *
      (2 * p1 +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
    );
  }

  private isSeaPixel(px: number, py: number): boolean {
    const x = this.pixelToCell(px);
    const y = this.pixelToCell(py);

    return this.world[y][x].type === "sea";
  }

  private pointKey(point: Point): string {
    return `${point.x},${point.y}`;
  }

  private dig() {
    const cell = this.getCurrentCell();

    if (!cell.hasTreasure) return;

    cell.hasTreasure = false;
    this.treasuresFound++;
  }

  private getCurrentCell(): Cell {
    return this.world[this.ship.y][this.ship.x];
  }

  private updateHud() {
    if (!this.hudText) return;

    const cell = this.getCurrentCell();

    this.hudText.setText(
      [
        `X: ${this.ship.x} Y: ${this.ship.y}`,
        `Depth: ${cell.depth}`,
        `Treasures: ${this.treasuresFound}`,
        `NPC ships: ${this.npcs.length}`,
        `Click: choose destination`,
        `Space: dig`,
        `Smooth route: ${this.smoothRoute.length}`,
      ].join("\n")
    );
  }

  private drawWorld() {
    if (!this.graphics) return;

    this.graphics.clear();

    this.drawMap();
    this.drawShipPath();
    this.drawSmoothRoutePreview();
    this.drawTarget();
    this.drawNpcShips();
    this.drawPlayerShip();
  }

  private drawMap() {
    if (!this.graphics) return;

    for (const row of this.world) {
      for (const cell of row) {
        let color = 0x0077be;

        if (cell.type === "island") color = 0x2f7d32;
else if (cell.hasTreasure) color = 0xffd700;
else if (cell.depth < 55) color = 0x8eeeff;
else if (cell.depth < 110) color = 0x3bc7e6;
else if (cell.depth < 190) color = 0x1291cf;
else if (cell.depth < 300) color = 0x075aa5;
else if (cell.depth < 430) color = 0x03367a;
else color = 0x01183f;

        this.graphics.fillStyle(color);
        this.graphics.fillRect(
          cell.x * TILE_SIZE,
          cell.y * TILE_SIZE,
          TILE_SIZE - 1,
          TILE_SIZE - 1
        );
      }
    }
  }

  private drawPlayerShip() {
    if (!this.graphics) return;

    this.graphics.fillStyle(0xffffff);
    this.graphics.fillCircle(this.shipPx, this.shipPy, TILE_SIZE / 2 - 2);
  }

  private drawNpcShips() {
    if (!this.graphics) return;

    for (const npc of this.npcs) {
      this.graphics.fillStyle(0xff3333);
      this.graphics.fillCircle(npc.px, npc.py, TILE_SIZE / 2 - 3);
    }
  }

  private drawSmoothRoutePreview() {
    if (!this.graphics) return;
    if (this.smoothRoute.length === 0) return;

    this.graphics.lineStyle(2, 0xffffff, 0.45);
    this.graphics.beginPath();
    this.graphics.moveTo(this.shipPx, this.shipPy);

    for (const point of this.smoothRoute) {
      this.graphics.lineTo(point.px, point.py);
    }

    this.graphics.strokePath();
  }

  private drawTarget() {
    if (!this.graphics) return;
    if (!this.target) return;

    this.graphics.lineStyle(2, 0xff0000, 1);
    this.graphics.strokeRect(
      this.target.x * TILE_SIZE,
      this.target.y * TILE_SIZE,
      TILE_SIZE - 1,
      TILE_SIZE - 1
    );
  }

  private drawShipPath() {
    if (!this.graphics) return;

    const lifetime = 6000;
    const now = this.time.now;

    this.shipPath = this.shipPath.filter((point) => {
      return now - point.createdAt < lifetime;
    });

    if (this.shipPath.length < 2) return;

    this.graphics.lineStyle(4, 0x66ccff, 0.65);
    this.graphics.beginPath();
    this.graphics.moveTo(this.shipPath[0].px, this.shipPath[0].py);

    for (let i = 1; i < this.shipPath.length; i++) {
      const point = this.shipPath[i];
      this.graphics.lineTo(point.px, point.py);
    }

    this.graphics.strokePath();
  }
}