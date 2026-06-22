import Phaser from "phaser";
import { SeaScene } from "./game/SeaScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 41 * 16,
  height: 41 * 16,
  backgroundColor: "#000000",
  parent: "app",
  scene: [SeaScene],
};

new Phaser.Game(config);