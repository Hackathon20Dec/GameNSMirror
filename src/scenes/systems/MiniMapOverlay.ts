import Phaser from "phaser";
import { EMOJI_FONT_FAMILY } from "../../constants";

export interface MiniMapPoi {
    id: string;
    name: string;
    /**
     * Normalized position on the minimap image:
     * u=0..1 left->right, v=0..1 top->bottom
     */
    u: number;
    v: number;
}

export interface MiniMapOverlayOptions {
    textureKey: string;
    pois: MiniMapPoi[];
}

type LegendSide = "left" | "right";

interface LayoutState {
    scale: number;
    x: number;
    y: number;
    legendSide: LegendSide;
    texW: number;
    texH: number;
}

export default class MiniMapOverlay {
    private readonly scene: Phaser.Scene;
    private readonly textureKey: string;
    private readonly pois: MiniMapPoi[];

    private isExpanded = false;

    private texW = 256;
    private texH = 256;

    private backdrop!: Phaser.GameObjects.Rectangle;
    private container!: Phaser.GameObjects.Container;
    private mapImage!: Phaser.GameObjects.Image;

    private lineGfx!: Phaser.GameObjects.Graphics;
    private labelText!: Phaser.GameObjects.Text;

    private markers: Phaser.GameObjects.Arc[] = [];
    private legendButtons: Array<{
        poi: MiniMapPoi;
        button: Phaser.GameObjects.Arc;
        marker: Phaser.GameObjects.Arc;
    }> = [];

    private legendSide: LegendSide = "left";

    private hoverTween: Phaser.Tweens.Tween | null = null;
    private lineAnim = { t: 0 };
    private hoverFrom: Phaser.Math.Vector2 | null = null;
    private hoverTo: Phaser.Math.Vector2 | null = null;
    private hovered:
        | { poi: MiniMapPoi; button: Phaser.GameObjects.Arc; marker: Phaser.GameObjects.Arc }
        | null = null;

    private pinned:
        | { poi: MiniMapPoi; button: Phaser.GameObjects.Arc; marker: Phaser.GameObjects.Arc }
        | null = null;

    private layoutTween: Phaser.Tweens.Tween | null = null;

    // Visual tuning (in minimap-local pixels; container scaling handles final size)
    private readonly markerRadius = 4;
    private readonly legendRadius = 10;
    private readonly legendSpacing = 46;

    constructor(scene: Phaser.Scene, opts: MiniMapOverlayOptions) {
        this.scene = scene;
        this.textureKey = opts.textureKey;
        this.pois = opts.pois;
    }

    public mount(): void {
        this.readTextureSize();

        // Backdrop (only visible when expanded)
        this.backdrop = this.scene.add.rectangle(
            0,
            0,
            this.scene.scale.width,
            this.scene.scale.height,
            0x000000,
            0.55
        );
        this.backdrop.setOrigin(0, 0);
        this.backdrop.setScrollFactor(0);
        this.backdrop.setDepth(1800);
        this.backdrop.setVisible(false);
        this.backdrop.setAlpha(0);

        // Clicking backdrop collapses
        this.backdrop.setInteractive({ useHandCursor: true });
        this.backdrop.on("pointerdown", () => this.setExpanded(false));

        // Main UI container
        this.container = this.scene.add.container(0, 0);
        this.container.setScrollFactor(0);
        this.container.setDepth(2000);

        // Minimap image
        this.mapImage = this.scene.add.image(0, 0, this.textureKey);
        this.mapImage.setOrigin(0.5, 0.5);
        this.mapImage.setScrollFactor(0);

        // Use Phaser's default hit area (it matches the actual texture frame size),
        // which prevents "only the center is clickable" problems.
        this.mapImage.setInteractive({ useHandCursor: true });

        // Click to expand only when collapsed. When expanded, clicks on the map should NOT collapse
        // (backdrop click collapses instead), so POI markers remain easy to interact with.
        this.mapImage.on("pointerdown", () => {
            if (!this.isExpanded) this.setExpanded(true);
        });

        // Callout line graphics (drawn in minimap-local coordinates)
        this.lineGfx = this.scene.add.graphics();
        this.lineGfx.setScrollFactor(0);

        // Label (added last so it stays on top)
        this.labelText = this.scene.add.text(0, 0, "", {
            fontFamily: EMOJI_FONT_FAMILY,
            fontSize: "18px",
            color: "#ffffff",
            backgroundColor: "rgba(0,0,0,0.65)",
            padding: { left: 8, right: 8, top: 4, bottom: 4 },
        });
        this.labelText.setVisible(false);
        this.labelText.setOrigin(1, 0.5);
        this.labelText.setScrollFactor(0);

        // Assemble container (order matters)
        this.container.add([this.mapImage, this.lineGfx]);

        // POIs: on-map markers + legend buttons
        this.createPoiObjects();

        // Label on top
        this.container.add(this.labelText);

        // Initial layout (collapsed bottom-left)
        this.applyLayout(this.computeLayout(this.isExpanded), false);

        // ESC closes expanded view
        if (this.scene.input.keyboard) {
            this.scene.input.keyboard.on("keydown-ESC", this.onEscPressed, this);
        }

        // Resize handling (Scale.RESIZE in main.ts)
        this.scene.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);

        // Cleanup
        this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
        this.scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
    }

    private destroy(): void {
        this.clearHover();

        this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
        this.scene.input.keyboard?.off("keydown-ESC", this.onEscPressed, this);

        this.layoutTween?.stop();
        this.layoutTween = null;

        this.backdrop?.destroy();
        this.container?.destroy();

        // Children are destroyed with container, but guard just in case
        this.backdrop = undefined as any;
        this.container = undefined as any;
        this.mapImage = undefined as any;
        this.lineGfx = undefined as any;
        this.labelText = undefined as any;
        this.markers.length = 0;
        this.legendButtons.length = 0;
    }

    private readTextureSize(): void {
        if (!this.scene.textures.exists(this.textureKey)) return;

        const tex = this.scene.textures.get(this.textureKey);

        // Prefer Phaser-tracked base frame dimensions, then fall back to the raw source image.
        const baseFrame = tex.get();
        const fw = Number((baseFrame as any)?.width ?? 0);
        const fh = Number((baseFrame as any)?.height ?? 0);

        let w = fw;
        let h = fh;

        if (!(Number.isFinite(w) && w > 0) || !(Number.isFinite(h) && h > 0)) {
            const src = tex.getSourceImage() as any;
            const sw = Number(src?.naturalWidth ?? src?.width ?? 0);
            const sh = Number(src?.naturalHeight ?? src?.height ?? 0);

            if (Number.isFinite(sw) && sw > 0) w = sw;
            if (Number.isFinite(sh) && sh > 0) h = sh;
        }

        if (Number.isFinite(w) && w > 0) this.texW = w;
        if (Number.isFinite(h) && h > 0) this.texH = h;
    }

    private createPoiObjects(): void {
        const baseY = -((this.pois.length - 1) * this.legendSpacing) / 2;

        for (let i = 0; i < this.pois.length; i++) {
            const poi = this.pois[i]!;
            const mx = (poi.u - 0.5) * this.texW;
            const my = (poi.v - 0.5) * this.texH;

            const marker = this.scene.add
                .circle(mx, my, this.markerRadius, 0xffffff, 0.9)
                .setStrokeStyle(1, 0x000000, 0.6);
            marker.setOrigin(0.5, 0.5);
            marker.setScrollFactor(0);

            // Legend buttons start hidden (shown only when expanded)
            const button = this.scene.add
                .circle(
                    0,
                    baseY + i * this.legendSpacing,
                    this.legendRadius,
                    0x111111,
                    0.9
                )
                .setStrokeStyle(2, 0xffffff, 0.9);
            button.setScrollFactor(0);
            button.setVisible(false);
            button.setActive(false);
            button.disableInteractive();

            // Hover + click behavior (expanded mode)
            button.on("pointerover", () => this.onPoiHover(poi, button, marker));
            button.on("pointerout", () => this.onPoiOut());
            button.on("pointerdown", () => this.onPoiClick(poi, button, marker));

            // Markers on the map are also clickable (primary UX). We enable/disable interactivity
            // based on expanded state via setMarkersEnabled().
            marker.setInteractive({ useHandCursor: true });
            marker.disableInteractive();
            marker.on("pointerover", () => this.onPoiHover(poi, button, marker));
            marker.on("pointerout", () => this.onPoiOut());
            marker.on("pointerdown", () => this.onPoiClick(poi, button, marker));

            this.container.add([marker, button]);

            this.markers.push(marker);
            this.legendButtons.push({ poi, button, marker });
        }
    }

    private onResize(): void {
        // Backdrop must always match screen
        if (this.backdrop) {
            this.backdrop.width = this.scene.scale.width;
            this.backdrop.height = this.scene.scale.height;
        }

        // Recompute layout (no tween on resize)
        this.applyLayout(this.computeLayout(this.isExpanded), false);

        // If hovering, redraw the line for new layout
        if (this.hovered && this.isExpanded) {
            this.hoverFrom = new Phaser.Math.Vector2(
                this.hovered.button.x,
                this.hovered.button.y
            );
            this.hoverTo = new Phaser.Math.Vector2(
                this.hovered.marker.x,
                this.hovered.marker.y
            );
            this.drawHoverLine(this.lineAnim.t);
        }
    }

    private onEscPressed(): void {
        if (this.isExpanded) this.setExpanded(false);
    }

    private toggle(): void {
        this.setExpanded(!this.isExpanded);
    }

    private setExpanded(expanded: boolean): void {
        if (this.isExpanded === expanded) return;

        this.isExpanded = expanded;
        this.pinned = null;
        this.clearHover();

        const layout = this.computeLayout(expanded);

        // Backdrop visibility + fade
        if (expanded) {
            this.backdrop.setVisible(true);
            this.backdrop.setAlpha(0);
            this.scene.tweens.add({
                targets: this.backdrop,
                alpha: 0.55,
                duration: 220,
                ease: "Sine.easeOut",
            });
        } else {
            this.scene.tweens.add({
                targets: this.backdrop,
                alpha: 0,
                duration: 180,
                ease: "Sine.easeIn",
                onComplete: () => this.backdrop.setVisible(false),
            });
        }

        this.applyLayout(layout, true);
    }

    private computeLayout(expanded: boolean): LayoutState {
        const sw = this.scene.scale.width;
        const sh = this.scene.scale.height;
        const margin = 12;

        // Collapsed: small bottom-left
        if (!expanded) {
            const targetW = Phaser.Math.Clamp(sw * 0.26, 140, 220);
            const scale = targetW / this.texW;

            const x = margin + (this.texW * scale) / 2;
            const y = sh - margin - (this.texH * scale) / 2;

            return { scale, x, y, legendSide: "left", texW: this.texW, texH: this.texH };
        }

        // Expanded: fit within ~75% of screen
        const fitScale = Math.min((sw * 0.75) / this.texW, (sh * 0.75) / this.texH);
        const scale = Phaser.Math.Clamp(fitScale, 0.2, 3);

        const x = sw / 2;
        const y = sh / 2;

        // Decide whether to place legend on left or right based on available space
        const mapDisplayW = this.texW * scale;
        const leftSpace = x - mapDisplayW / 2;
        const rightSpace = sw - (x + mapDisplayW / 2);

        const need = 100; // space for legend + label
        let legendSide: LegendSide = "left";
        if (leftSpace < need && rightSpace >= need) legendSide = "right";

        return { scale, x, y, legendSide, texW: this.texW, texH: this.texH };
    }

    private applyLayout(layout: LayoutState, animate: boolean): void {
        this.legendSide = layout.legendSide;

        // Legend positions depend on side
        this.positionLegendButtons(layout.legendSide);

        // Enable legend + marker interactivity only in expanded state
        this.setLegendEnabled(this.isExpanded);
        this.setMarkersEnabled(this.isExpanded);

        // Place container
        this.layoutTween?.stop();
        this.layoutTween = null;

        if (!animate) {
            this.container.setPosition(layout.x, layout.y);
            this.container.setScale(layout.scale);
            return;
        }

        this.layoutTween = this.scene.tweens.add({
            targets: this.container,
            x: layout.x,
            y: layout.y,
            scaleX: layout.scale,
            scaleY: layout.scale,
            duration: 240,
            ease: "Sine.easeInOut",
            onComplete: () => {
                this.layoutTween = null;
            },
        });
    }

    private positionLegendButtons(side: LegendSide): void {
        const baseY = -((this.pois.length - 1) * this.legendSpacing) / 2;

        const x =
            side === "left" ? -this.texW / 2 - 42 : this.texW / 2 + 42;

        // Label aligns away from the map
        this.labelText.setOrigin(side === "left" ? 1 : 0, 0.5);

        for (let i = 0; i < this.legendButtons.length; i++) {
            const entry = this.legendButtons[i]!;
            entry.button.setPosition(x, baseY + i * this.legendSpacing);
        }
    }

    private setLegendEnabled(enabled: boolean): void {
        for (const entry of this.legendButtons) {
            entry.button.setVisible(enabled);
            entry.button.setActive(enabled);

            if (enabled) {
                entry.button.setInteractive({ useHandCursor: true });
            } else {
                entry.button.disableInteractive();
            }
        }
    }

    private setMarkersEnabled(enabled: boolean): void {
        for (const entry of this.legendButtons) {
            if (enabled) {
                entry.marker.setInteractive({ useHandCursor: true });
            } else {
                entry.marker.disableInteractive();
            }
        }
    }

    private onPoiHover(
        poi: MiniMapPoi,
        button: Phaser.GameObjects.Arc,
        marker: Phaser.GameObjects.Arc
    ): void {
        if (!this.isExpanded) return;
        this.applyPoiFocus(poi, button, marker, true);
    }

    private onPoiOut(): void {
        if (!this.isExpanded) return;

        if (this.pinned) {
            this.applyPoiFocus(
                this.pinned.poi,
                this.pinned.button,
                this.pinned.marker,
                false
            );
        } else {
            this.clearHover();
        }
    }

    private onPoiClick(
        poi: MiniMapPoi,
        button: Phaser.GameObjects.Arc,
        marker: Phaser.GameObjects.Arc
    ): void {
        if (!this.isExpanded) return;

        // Toggle pin
        if (this.pinned && this.pinned.poi.id === poi.id) {
            this.pinned = null;
            this.clearHover();
            return;
        }

        this.pinned = { poi, button, marker };
        this.applyPoiFocus(poi, button, marker, true);
    }

    private applyPoiFocus(
        poi: MiniMapPoi,
        button: Phaser.GameObjects.Arc,
        marker: Phaser.GameObjects.Arc,
        animateLine: boolean
    ): void {
        if (!this.isExpanded) return;

        this.clearHover();

        this.hovered = { poi, button, marker };

        // Highlight
        button.setScale(1.12);
        marker.setScale(1.35);
        marker.setFillStyle(0xffd166, 1);

        // Setup line endpoints
        this.hoverFrom = new Phaser.Math.Vector2(button.x, button.y);
        this.hoverTo = new Phaser.Math.Vector2(marker.x, marker.y);

        // Label next to legend button (away from map)
        const labelPad = 16;
        const lx =
            this.legendSide === "left" ? button.x - labelPad : button.x + labelPad;
        this.labelText.setText(poi.name);
        this.labelText.setPosition(lx, button.y);
        this.labelText.setVisible(true);

        if (!animateLine) {
            this.lineAnim.t = 1;
            this.drawHoverLine(1);
            return;
        }

        // Animate line drawing
        this.lineAnim.t = 0;
        this.drawHoverLine(0);

        this.hoverTween = this.scene.tweens.add({
            targets: this.lineAnim,
            t: 1,
            duration: 320,
            ease: "Sine.easeOut",
            onUpdate: () => this.drawHoverLine(this.lineAnim.t),
            onComplete: () => this.drawHoverLine(1),
        });
    }

    private drawHoverLine(t: number): void {
        if (!this.hoverFrom || !this.hoverTo) {
            this.lineGfx.clear();
            return;
        }

        const x = Phaser.Math.Linear(this.hoverFrom.x, this.hoverTo.x, t);
        const y = Phaser.Math.Linear(this.hoverFrom.y, this.hoverTo.y, t);

        this.lineGfx.clear();
        this.lineGfx.lineStyle(2, 0xffffff, 0.9);
        this.lineGfx.beginPath();
        this.lineGfx.moveTo(this.hoverFrom.x, this.hoverFrom.y);
        this.lineGfx.lineTo(x, y);
        this.lineGfx.strokePath();
    }

    private clearHover(): void {
        this.hoverTween?.stop();
        this.hoverTween = null;

        this.lineGfx?.clear();
        this.labelText?.setVisible(false);

        if (this.hovered) {
            this.hovered.button.setScale(1);
            this.hovered.marker.setScale(1);
            this.hovered.marker.setFillStyle(0xffffff, 0.9);
        }

        this.hovered = null;
        this.hoverFrom = null;
        this.hoverTo = null;
        this.lineAnim.t = 0;
    }
}