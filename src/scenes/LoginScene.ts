import Phaser from "phaser";

export default class LoginScene extends Phaser.Scene {
    private loginContainer!: HTMLDivElement;

    constructor() {
        super({ key: "LoginScene" });
    }

    create(): void {
        // Create HTML login form overlay
        this.loginContainer = document.createElement("div");
        this.loginContainer.id = "login-container";
        this.loginContainer.innerHTML = `
            <div class="login-box">
                <h1>AIRPG</h1>
                <p class="subtitle">Enter the realm</p>
                <form id="login-form">
                    <input
                        type="text"
                        id="username-input"
                        placeholder="Enter your name"
                        maxlength="20"
                        autocomplete="off"
                        required
                    />
                    <button type="submit" id="play-btn">Play</button>
                </form>
            </div>
        `;

        // Add styles
        const style = document.createElement("style");
        style.id = "login-styles";
        style.textContent = `
            #login-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                background: linear-gradient(135deg, #0f0f10 0%, #1a1a2e 50%, #16213e 100%);
                z-index: 1000;
                font-family: system-ui, -apple-system, sans-serif;
            }

            .login-box {
                background: rgba(255, 255, 255, 0.05);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 16px;
                padding: 48px;
                text-align: center;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            }

            .login-box h1 {
                color: #fff;
                font-size: 48px;
                margin: 0 0 8px 0;
                font-weight: 700;
                letter-spacing: 4px;
                text-shadow: 0 0 20px rgba(74, 222, 128, 0.5);
            }

            .login-box .subtitle {
                color: rgba(255, 255, 255, 0.6);
                font-size: 14px;
                margin: 0 0 32px 0;
                letter-spacing: 2px;
                text-transform: uppercase;
            }

            #login-form {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            #username-input {
                padding: 16px 20px;
                font-size: 16px;
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                background: rgba(0, 0, 0, 0.3);
                color: #fff;
                outline: none;
                transition: border-color 0.2s, box-shadow 0.2s;
                width: 280px;
            }

            #username-input:focus {
                border-color: #4ade80;
                box-shadow: 0 0 16px rgba(74, 222, 128, 0.3);
            }

            #username-input::placeholder {
                color: rgba(255, 255, 255, 0.4);
            }

            #play-btn {
                padding: 16px 32px;
                font-size: 18px;
                font-weight: 600;
                color: #0f0f10;
                background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
                border: none;
                border-radius: 8px;
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
                letter-spacing: 1px;
                text-transform: uppercase;
            }

            #play-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(74, 222, 128, 0.4);
            }

            #play-btn:active {
                transform: translateY(0);
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(this.loginContainer);

        // Handle form submission
        const form = document.getElementById("login-form") as HTMLFormElement;
        const input = document.getElementById("username-input") as HTMLInputElement;

        input.focus();

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const username = input.value.trim();
            if (username) {
                this.startGame(username);
            }
        });
    }

    private startGame(username: string): void {
        // Clean up login UI
        this.loginContainer.remove();
        document.getElementById("login-styles")?.remove();

        // Store username for game use
        this.registry.set("playerName", username);

        // Start game scene
        this.scene.start("GameScene");
    }
}
