import Phaser from "phaser";
import { LobbyScene } from "./scenes/LobbyScene";
import { GameScene } from "./scenes/GameScene";
import { GameOverScene } from "./scenes/GameOverScene";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: "#1a1a2e",
  scene: [LobbyScene, GameScene, GameOverScene],
  parent: document.body,
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
});
