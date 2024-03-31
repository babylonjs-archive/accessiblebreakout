import { BRICK_WIDTH, BRICK_HEIGHT } from "./constants.js";

interface Position {
    x: number;
    y: number;
    col: number;
}

export class Brick {
    private _isDead = false;
    private _position: Position;
    private _rect: SVGRectElement;
    private _svg: SVGElement | null;

    constructor(
        x: number,
        y: number,
        col: number,
        visuallyImpaired: boolean,
        svg: SVGElement | null,
    ) {
        this._svg = svg;
        this._position = { x: x, y: y, col: col };
        this._rect = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
        );
        this._svg?.appendChild(this._rect);

        this._rect.setAttribute("width", BRICK_WIDTH.toString());
        this._rect.setAttribute("height", BRICK_HEIGHT.toString());

        if (!visuallyImpaired) {
            // Random green color
            var chars = "456789abcdef";
            var color = "";
            for (var i = 0; i < 2; i++) {
                var rnd = Math.floor(chars.length * Math.random());
                color += chars.charAt(rnd);
            }
            this._rect.setAttribute("fill", "#00" + color + "00");
        } else {
            this._rect.setAttribute("fill", "Yellow");
        }
    }

    public drawAndCollide(
        ballX: number,
        ballY: number,
        ballRadius: number,
        brickWidth: number,
        brickHeight: number,
    ): boolean {
        if (this._isDead) return false;
        // Drawing
        this._rect.setAttribute("x", String(this._position.x));
        this._rect.setAttribute("y", String(this._position.y));

        // Collision
        if (
            ballX + ballRadius < this._position.x ||
            ballX - ballRadius > this._position.x + brickWidth
        ) {
            return false;
        }

        if (
            ballY + ballRadius < this._position.y ||
            ballY - ballRadius > this._position.y + brickHeight
        ) {
            return false;
        }

        // Dead
        this.remove();
        this._isDead = true;
        return true;
    }

    public remove() {
        if (this._isDead) {
            return;
        }
        this._svg?.removeChild(this._rect);
    }
}
