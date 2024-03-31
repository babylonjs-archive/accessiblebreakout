declare module "mespeak" {
    export interface SpeakOptions {
        amplitude: number;
        wordgap: number;
        pitch: number;
        speed: number;
        variant: string;
    }

    export function loadConfig(url: string): void;
    export function loadVoice(url: string);
    export function speak(text: string, options: any): void;
}
