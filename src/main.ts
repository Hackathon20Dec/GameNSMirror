import Phaser from "phaser";
import "./style.css";
import BootScene from "./scenes/BootScene";
import TitleScene from "./scenes/TitleScene";
import GameScene from "./scenes/GameScene";

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: "app",
    backgroundColor: "#0f0f10",
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: window.innerWidth,
        height: window.innerHeight,
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 0, x: 0 },
            debug: false,
        },
    },
    scene: [BootScene, TitleScene, GameScene],
    pixelArt: true,
    render: {
        antialias: false,
    },
};

const game = new Phaser.Game(config);

// With RESIZE mode, Phaser handles most of this, but keeping a resize hook is harmless
// and ensures the canvas matches the container on every browser.
window.addEventListener("resize", () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});
