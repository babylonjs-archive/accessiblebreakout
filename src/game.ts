import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import { AssetsManager } from "@babylonjs/core/Misc/assetsManager.js";
import { Camera } from "@babylonjs/core/Cameras/camera.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { Color4 } from "@babylonjs/core/Maths/math.color.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { Engine } from "@babylonjs/core/Engines/engine.js";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem.js";
import { Scene } from "@babylonjs/core/scene.js";
import { Sound } from "@babylonjs/core/Audio/sound.js";
import { Texture } from "@babylonjs/core/Materials/Textures/texture.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import meSpeak from "mespeak";

import { Brick } from "./brick.js";
import {
    ACCESSIBLE_BALL_SPEED,
    ACCESSIBLE_PAD_TOLERANCE,
    ACCESSIBLE_PADDLE_WIDTH,
    BRICKS_ROWS,
    BRICKS_COLS,
    BRICK_WIDTH,
    BRICK_HEIGHT,
    DEFAULT_BALL_SPEED,
    DEFAULT_MUSIC_PLAYRATE,
    DEFAULT_PADDLE_WIDTH,
} from "./constants.js";

import "@babylonjs/core/Audio/audioSceneComponent.js";
import "@babylonjs/core/Collisions/collisionCoordinator.js";
import "@babylonjs/core/Loading/loadingScreen.js";

function loadStyleSheet(path: string) {
    const head = document.getElementsByTagName("head")[0];
    const link = document.createElement("link");
    link.setAttribute("href", path);
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("type", "text/css");

    let sheet: string;
    let cssRules: string;
    // get the correct properties to check for depending on the browser
    if ("sheet" in link) {
        sheet = "sheet";
        cssRules = "cssRules";
    } else {
        sheet = "styleSheet";
        cssRules = "rules";
    }

    const intervalId = setInterval(() => {
        try {
            if (
                link[sheet as "sheet"] &&
                link[sheet as "sheet"]![cssRules as "cssRules"].length
            ) {
                clearInterval(intervalId);
                clearTimeout(timeoutId);
            }
        } catch (e) {}
    }, 10);
    const timeoutId = setTimeout(() => {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
        head.removeChild(link);
    }, 15000);

    head.appendChild(link);

    return link;
}

export class Game {
    canvas: HTMLCanvasElement;
    engine: Engine;
    camera: Camera;
    scene: Scene;
    svg: SVGSVGElement;
    destroyedBricksCount = 0;
    audioAccessibility = true;
    visuallyImpaired = true;
    gameStarted = false;
    inertia = 0.8;

    private _pad: SVGRectElement;
    private _ball: SVGCircleElement;
    private _message: HTMLElement;

    private _ballRadius: number;
    private _ballX: number = 0;
    private _ballY: number = 0;
    private _previousBallPosition = { x: 0, y: 0 };
    private _ballDirectionX: number = Math.random();
    private _ballDirectionY: number = -1.0;
    private _ballSpeed = 3;

    private _viewPortWidth = 0;
    private _viewPortHeight = 0;
    private _viewPortCenter = { x: 0, y: 0 };

    // Pad
    private _padWidth = 0;
    private _padX = 0;
    private _padY = 0;
    private _padSpeed = 0;

    // Bricks
    private _bricks: Brick[] = [];
    private _bricksCount = 0;
    private _bricksMargin = 15;
    private _bricksTop = 20;

    // Misc.
    private _minX = 0;
    private _minY = 0;
    private _maxX = 0;
    private _maxY = 0;
    private _startDate: number;

    private _rafID = 0;

    private _music!: Sound;
    private _jumpSound!: Sound;

    private _chkVisualImpaired: HTMLInputElement;
    private _chkAudioAccessibility: HTMLInputElement;
    private _gameButton;

    constructor() {
        this._message = document.getElementById("message")!;
        if (!this._message) {
            throw new Error("No message element found in the DOM");
        }
        this._pad = document.getElementById("pad") as unknown as SVGRectElement;
        this._ball = document.getElementById(
            "ball",
        ) as unknown as SVGCircleElement;
        this.svg = document.getElementById(
            "svgRoot",
        ) as unknown as SVGSVGElement;
        this._chkVisualImpaired = <HTMLInputElement>(
            document.getElementById("chkVisualImpaired")
        );
        this._chkAudioAccessibility = <HTMLInputElement>(
            document.getElementById("chkAudioAccessibility")
        );
        this.canvas = <HTMLCanvasElement>(
            document.getElementById("backgroundCanvas")
        );
        this._gameButton = document.getElementById(
            "newGame",
        ) as HTMLInputElement;

        this._gameButton.addEventListener("click", () => {
            if (this.gameStarted) {
                this._gameButton.value = "Start game";
                this.stopGame();
            } else {
                this._gameButton.value = "Stop game";
                this.startGame();
            }
        });
        this._chkVisualImpaired.addEventListener("change", () => {
            this.visuallyImpaired = this._chkVisualImpaired.checked;
            if (!this.gameStarted) {
                this.initGame();
            }
        });
        this._chkAudioAccessibility.addEventListener("change", () => {
            this.audioAccessibility = this._chkAudioAccessibility.checked;
            if (!this.gameStarted) {
                this.initGame();
            }
        });

        /*
        const requiredElements = [
            "pad",
            "ball",
            "svgRoot",
            "chkVisualImpaired",
            "chkAudioAccessibility",
            "backgroundCanvas",
            "newGame",
        ];
        for (const id of requiredElements) {
            if (!document.getElementById(id)) {
                this._message.innerText = ``;
                this._message.style.visibility = "visible";
                return;
            }
        }
        */

        this._ballRadius = this._ball.r.baseVal.value;
        this._minX = this._ballRadius;
        this._minY = this._ballRadius;
        this._viewPortWidth = this.svg.viewBox.baseVal.width;
        this._viewPortHeight = this.svg.viewBox.baseVal.height;
        this._viewPortCenter = {
            x: this._viewPortWidth / 2,
            y: this._viewPortHeight / 2,
        };
        this._startDate = new Date().getTime();

        this._connectWindowHandlers();

        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight - 100;

        this.engine = new Engine(this.canvas, true);
        this.scene = new Scene(this.engine);

        // @ts-ignore Lights don't need to be accessed.
        const light = new DirectionalLight(
            "light",
            new Vector3(2, -10, 5),
            this.scene,
        );
        this.camera = new ArcRotateCamera(
            "camera",
            (3 * Math.PI) / 2.0,
            Math.PI / 4.0,
            20.0,
            new Vector3(0, 0, 0),
            this.scene,
        );

        if (Engine.isSupported()) {
            this._initBabylonEngine();
            this._initSounds();
        }

        meSpeak.loadConfig("mespeak_config.json");
        meSpeak.loadVoice("voices/en/en.json");
    }

    private _connectWindowHandlers() {
        window.addEventListener(
            "keydown",
            (evt) => {
                switch (evt.key) {
                    case "ArrowLeft":
                        this._padSpeed -= 10;
                        break;
                    case "ArrowRight":
                        this._padSpeed += 10;
                        break;
                }
            },
            true,
        );

        window.onresize = () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight - 100;
            this.engine.resize();
        };
    }

    private _initBabylonEngine() {
        // Starfield
        const starfield = new ParticleSystem("particles", 4000, this.scene);
        starfield.particleTexture = new Texture("assets/star.png", this.scene);
        starfield.minAngularSpeed = -4.5;
        starfield.maxAngularSpeed = 4.5;
        starfield.minSize = 0.5;
        starfield.maxSize = 1.0;
        starfield.minLifeTime = 0.5;
        starfield.maxLifeTime = 2.0;
        starfield.minEmitPower = 0.5;
        starfield.maxEmitPower = 1.0;
        starfield.emitRate = 600;
        starfield.blendMode = ParticleSystem.BLENDMODE_ONEONE;
        starfield.minEmitBox = new Vector3(-25, 0, -25);
        starfield.maxEmitBox = new Vector3(25, 0, 25);
        starfield.direction1 = new Vector3(0, 1, 0);
        starfield.direction2 = new Vector3(0, 1, 0);
        starfield.color1 = new Color4(0, 0, 0, 1);
        starfield.color2 = new Color4(1, 1, 1, 1);
        starfield.gravity = new Vector3(0, 5, 0);
        starfield.emitter = new Vector3(0, -2, 0);
        starfield.start();

        this.engine.runRenderLoop(() => {
            if (!this.visuallyImpaired) {
                this.scene.render();
            } else {
                // If you have visual deficiencies, we're not rendering the star field
                // and render a black frame as background
                this.engine.clear(
                    Color4.FromColor3(Color3.Black()),
                    true,
                    true,
                );
            }
        });
    }

    private _initSounds() {
        if (Engine.audioEngine?.canUseWebAudio) {
            const assetsManager = new AssetsManager(this.scene);

            const binaryTask = assetsManager.addBinaryFileTask(
                "music task",
                "sounds/techno.wav",
            );
            binaryTask.onSuccess = (task) => {
                this._music = new Sound("Music", task.data, this.scene, null, {
                    loop: true,
                    spatialSound: true,
                });
            };

            const binaryTask2 = assetsManager.addBinaryFileTask(
                "jump task",
                "sounds/jump.mp3",
            );
            binaryTask2.onSuccess = (task: any) => {
                this._jumpSound = new Sound(
                    "Jump",
                    task.data,
                    this.scene,
                    null,
                    { spatialSound: true },
                );
            };

            assetsManager.load();
        } else {
            // Creating empty sounds as fallback
            this._music = new Sound("Music", null, this.scene);
            this._jumpSound = new Sound("Jump", null, this.scene);
        }
    }

    private _collideWithWindow() {
        if (this._ballX < this._minX) {
            this._ballX = this._minX;
            this._ballDirectionX *= -1.0;
            this._playBallSound(2);
        } else if (this._ballX > this._maxX) {
            this._ballX = this._maxX;
            this._ballDirectionX *= -1.0;
            this._playBallSound(2);
        }

        if (this._ballY < this._minY) {
            this._ballY = this._minY;
            this._ballDirectionY *= -1.0;
            this._playBallSound(2);
        } else if (this._ballY > this._maxY) {
            this._ballY = this._maxY;
            this._ballDirectionY *= -1.0;
            this._lost();
        }
    }

    private _collideWithPad() {
        if (
            this._ballX + this._ballRadius < this._padX ||
            this._ballX - this._ballRadius > this._padX + this._padWidth
        )
            return;

        if (this._ballY + this._ballRadius < this._padY) {
            return;
        }

        const tolerance = this._ballRadius + this._ballY - this._padY;

        if (tolerance >= 0 && tolerance <= 4) {
            this._playBallSound(0.5);

            this._ballX = this._previousBallPosition.x;
            this._ballY = this._previousBallPosition.y;

            this._ballDirectionY *= -1.0;

            const dist = this._ballX - (this._padX + this._padWidth / 2);

            this._ballDirectionX = (2.0 * dist) / this._padWidth;

            const square = Math.sqrt(
                this._ballDirectionX * this._ballDirectionX +
                    this._ballDirectionY * this._ballDirectionY,
            );
            this._ballDirectionX /= square;
            this._ballDirectionY /= square;
        }
    }

    // Pad movement
    private _movePad() {
        this._padX += this._padSpeed;

        this._padSpeed *= this.inertia;

        if (this._padX < this._minX) {
            this._padX = this._minX;
        }

        if (this._padX + this._padWidth > this._maxX) {
            this._padX = this._maxX - this._padWidth;
        }
    }

    private _checkWindow() {
        this._maxX = this._viewPortWidth - this._minX;
        this._maxY = this._viewPortHeight - this._minY;
        this._padY = this._maxY - 30;
    }

    private _gameLoop() {
        this._movePad();

        let currentBallSpeed = this._ballSpeed;

        // If audio accessibility is being used, we're slowing down the ball speed
        // in the last 20% of the vertical screen
        if (
            this.audioAccessibility &&
            this._ballY > this._viewPortHeight * 0.8
        ) {
            currentBallSpeed /= 2;
        }

        // Movements
        this._previousBallPosition.x = this._ballX;
        this._previousBallPosition.y = this._ballY;
        this._ballX += this._ballDirectionX * currentBallSpeed;
        this._ballY += this._ballDirectionY * currentBallSpeed;

        // Collisions
        this._collideWithWindow();
        this._collideWithPad();

        // Bricks
        for (let index = 0; index < this._bricks.length; index++) {
            if (
                this._bricks[index].drawAndCollide(
                    this._ballX,
                    this._ballY,
                    this._ballRadius,
                    BRICK_WIDTH,
                    BRICK_HEIGHT,
                )
            ) {
                this.destroyedBricksCount++;
                this._bricksCount--;
                if (
                    this._bricksCount > 0 &&
                    Engine.audioEngine?.canUseWebAudio &&
                    this.audioAccessibility
                ) {
                    meSpeak.speak(this._bricksCount + ", remaining", {
                        amplitude: 100,
                        wordgap: 0,
                        pitch: 50,
                        speed: 150,
                        variant: "none",
                    });
                }

                this._playBallSound();

                // Updating ball
                this._ballX = this._previousBallPosition.x;
                this._ballY = this._previousBallPosition.y;

                this._ballDirectionY *= -1.0;
            }
        }

        if (this._bricksCount < 10) {
            // Could be a good idea to tell to the blind users
            // where the remaining bricks are located (left, right, center?)
        }

        // Ball
        this._ball.setAttribute("cx", String(this._ballX));
        this._ball.setAttribute("cy", String(this._ballY));

        // Pad
        this._pad.setAttribute("x", String(this._padX));
        this._pad.setAttribute("y", String(this._padY));

        if (this.gameStarted) {
            if (this.audioAccessibility) {
                this._updateAccessibilityMusic();
            }
            this._rafID = requestAnimationFrame(() => {
                this._gameLoop();
            });
        }

        // Victory ?
        if (this.destroyedBricksCount == this._bricks.length) {
            this._win();
        }
    }

    private _updateAccessibilityMusic() {
        let paddleX = this._padX;
        let paddleW = this._padWidth;
        const ballPosition = { x: this._ballX, y: this._ballY };
        const deltaX = paddleW * ((1 - ACCESSIBLE_PAD_TOLERANCE) / 2);

        if (
            ballPosition.x > deltaX + 10 &&
            ballPosition.x < this._viewPortWidth - (deltaX + 10)
        ) {
            paddleX += paddleW * ((1 - ACCESSIBLE_PAD_TOLERANCE) / 2);
            paddleW = paddleW * ACCESSIBLE_PAD_TOLERANCE;
        }

        // If paddle & ball aligned, sound is played on both ears (X = 0, for center)
        // If the ball is on the left, musicIndicatorX should be negative otherwise positive
        let musicIndicatorX;

        // Position coordinates are in normalized canvas coordinates
        // with -0.5 < x, y < 0.5
        if (ballPosition) {
            // Ball and paddle are vertically aligned
            if (
                ballPosition.x >= paddleX &&
                ballPosition.x <= paddleX + paddleW
            ) {
                this._music.setPlaybackRate(DEFAULT_MUSIC_PLAYRATE);
                musicIndicatorX = 0;
            } else {
                let distanceFromPaddle;
                // Ball is on the left of the paddle
                if (ballPosition.x < paddleX) {
                    distanceFromPaddle = paddleX - ballPosition.x;
                    musicIndicatorX = -30;
                } else {
                    distanceFromPaddle = ballPosition.x - paddleX - paddleW;
                    musicIndicatorX = 30;
                }
                const distanceFromPaddleNormalized =
                    distanceFromPaddle / this._viewPortWidth;
                // Slowing down the play rate based on the distance from the paddle
                this._music.setPlaybackRate(
                    0.9 * (1 - distanceFromPaddleNormalized),
                );
            }
            // Playing music on left or right speaker based on the ball position from the paddle
            this._music.setPosition(new Vector3(musicIndicatorX, 0.5, 0));
        }
    }

    private _playBallSound(playSpeed?: number) {
        const playrate = playSpeed || 1.0;
        const x = (this._ballX - this._viewPortCenter.x) / this._viewPortWidth;
        const y = (this._ballY - this._viewPortCenter.y) / this._viewPortHeight;
        this._jumpSound.setPosition(new Vector3(x * 40, y * 40, 0));
        this._jumpSound.setPlaybackRate(playrate);
        this._jumpSound.play();
    }

    private _generateBricks() {
        // Removing previous ones
        for (const brick of this._bricks) {
            brick.remove();
        }

        // Creating new ones
        let brickID = 0;

        const offset =
            (this._viewPortWidth -
                BRICKS_COLS * (BRICK_WIDTH + this._bricksMargin)) /
            2.0;

        for (let x = 0; x < BRICKS_COLS; x++) {
            for (let y = 0; y < BRICKS_ROWS; y++) {
                this._bricks[brickID++] = new Brick(
                    offset + x * (BRICK_WIDTH + this._bricksMargin),
                    y * (BRICK_HEIGHT + this._bricksMargin) + this._bricksTop,
                    x + 1,
                    this.visuallyImpaired,
                    this.svg,
                );
            }
        }

        this._bricksCount = brickID;
    }

    private _lost() {
        this._music.stop();
        this.gameStarted = false;
        this._gameButton.innerHTML = "Start game";

        if (Engine.audioEngine?.canUseWebAudio && this.audioAccessibility) {
            meSpeak.speak("Game over!", {
                amplitude: 100,
                wordgap: 0,
                pitch: 50,
                speed: 150,
                variant: "none",
            });
        }
        this._message.innerText = "Game over !";
        this._message.style.visibility = "visible";
    }

    private _win() {
        this._music.stop();
        this.gameStarted = false;
        this._gameButton.innerHTML = "Start game";

        const end = new Date().getTime();

        this._message.innerText =
            "Victory ! (" + Math.round((end - this._startDate) / 1000) + "s)";
        if (Engine.audioEngine?.canUseWebAudio && this.audioAccessibility) {
            meSpeak.speak(
                "Victory ! In " +
                    Math.round((end - this._startDate) / 1000) +
                    " seconds",
                {
                    amplitude: 100,
                    wordgap: 0,
                    pitch: 50,
                    speed: 150,
                    variant: "none",
                },
            );
        }

        this._message.style.visibility = "visible";
    }

    public initGame() {
        if (this.audioAccessibility) {
            this._pad.width.baseVal.value = ACCESSIBLE_PADDLE_WIDTH;
            this._ballSpeed = ACCESSIBLE_BALL_SPEED;
        } else {
            this._pad.width.baseVal.value = DEFAULT_PADDLE_WIDTH;
            this._ballSpeed = DEFAULT_BALL_SPEED;
        }

        if (this.visuallyImpaired) {
            loadStyleSheet("css/indexvi.css");
        } else {
            loadStyleSheet("css/index.css");
        }

        this._padWidth = this._pad.width.baseVal.value;
        this._message.style.visibility = "hidden";

        this._checkWindow();

        this._padX = (this._viewPortWidth - this._padWidth) / 2.0;
        this._ballX = this._viewPortWidth / 2.0;
        this._ballY = this._maxY - 60;
        this._previousBallPosition.x = this._ballX;
        this._previousBallPosition.y = this._ballY;
        this._padSpeed = 0;

        this._generateBricks();
        this._gameLoop();
    }

    public stopGame() {
        cancelAnimationFrame(this._rafID);
        this.gameStarted = false;
        this._music.stop();
        this.initGame();
    }

    startGame() {
        cancelAnimationFrame(this._rafID);

        if (Engine.audioEngine?.canUseWebAudio && this.audioAccessibility) {
            meSpeak.speak("Starting game", {
                amplitude: 100,
                wordgap: 0,
                pitch: 50,
                speed: 150,
                variant: "none",
            });
        }

        this.initGame();
        this.gameStarted = true;
        this._music.setPlaybackRate(DEFAULT_MUSIC_PLAYRATE);
        this._music.play();

        this.destroyedBricksCount = 0;

        this._startDate = new Date().getTime();
        this._rafID = requestAnimationFrame(() => {
            this._gameLoop();
        });
    }
}
