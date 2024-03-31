/// <reference types="vite/types/import-meta" />
import { Game } from "./game.js";

document.addEventListener("DOMContentLoaded", async () => {
    const game = new Game();

    if (import.meta.env.DEV) {
        try {
            await import("@babylonjs/inspector");
            // Hide/show the Inspector
            window.addEventListener("keydown", (evt) => {
                // Ctrl+I
                if (evt.ctrlKey && !evt.shiftKey && evt.key === "i") {
                    if (game.scene.debugLayer.isVisible()) {
                        game.scene.debugLayer.hide();
                    } else {
                        game.scene.debugLayer.show();
                    }
                }
            });
        } catch (e: any) {
            console.log(`Failed to load inspector: ${e.message}`);
        }
    }

    game.initGame();
});
