/**
 * Imperative Three.js controller for the 3D chess board.
 *
 * The original `test/3D-Chess-Game` demo is a page-wide script with global
 * mutable state. This port keeps the same asset pipeline (GLB + KTX2 + EXR)
 * and the same GSAP-driven feel, but owns everything inside a class tied to
 * one container, so React can mount/unmount it safely. The React layer never
 * touches Three.js objects: it only reads snapshots and sends intentions
 * (start, promotion choice, reset, flip).
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import gsap from "gsap";

import { ChessGame, type ChessGameMove } from "../engine/chess-game";
import { StockfishEngine } from "../engine/stockfish-engine";
import type {
  ChessColor,
  ChessMode,
  ChessPromotionPiece,
  ChessSceneOptions,
} from "../types";

type ColorName = "White" | "Black";

/** FEN piece letters → GLB node names (registered as `userData.Name`). */
const PIECE_NAMES: Record<string, string> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

interface PieceUserData {
  NowAt: string;
  StartAt: string;
  color: ColorName;
  Name: string;
  MainPosition: THREE.Vector3;
  MainScale: THREE.Vector3;
  MainRotation: THREE.Euler;
  originalColor?: THREE.Color;
}

type Piece3D = THREE.Object3D & { userData: PieceUserData };

const TEXTURES = {
  Floor: "/chess/textures/Background.ktx2",
  Black: "/chess/textures/BlackPiece.ktx2",
  Others: "/chess/textures/Others.ktx2",
  Square: "/chess/textures/TheSquares.ktx2",
  Tables: "/chess/textures/TheWoods.ktx2",
  White: "/chess/textures/WhitePicese.ktx2",
  TheFlowers: "/chess/textures/SideItemsGrass.ktx2",
  SideItems: "/chess/textures/NewSideItems.ktx2",
} as const;

const GLB_URL = "/chess/ChessGLB.glb";
const HDR_URL = "/chess/TheHdr.exr";

function squareSuffix(name: string): string | null {
  const match = /([a-h][1-8])$/.exec(name);
  return match ? match[1] : null;
}

function colorNameOf(color: ChessColor): ColorName {
  return color === "w" ? "White" : "Black";
}

function materialOf(object: THREE.Object3D): THREE.Material | null {
  const material = (object as THREE.Mesh).material;
  if (!material) return null;
  return Array.isArray(material) ? material[0] : material;
}

function colorMaterialOf(object: THREE.Object3D): THREE.MeshStandardMaterial | null {
  const material = materialOf(object);
  return material instanceof THREE.MeshStandardMaterial ? material : null;
}

function disposeMaterial(material: THREE.Material, disposedTextures: Set<THREE.Texture>): void {
  const record = material as THREE.Material & Record<string, unknown>;
  for (const value of Object.values(record)) {
    if (value instanceof THREE.Texture && !disposedTextures.has(value)) {
      disposedTextures.add(value);
      value.dispose();
    }
  }
  material.dispose();
}

export class ChessScene {
  private readonly container: HTMLElement;
  private readonly options: ChessSceneOptions;
  private readonly game = new ChessGame();

  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private model: THREE.Group | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private frameId: number | null = null;
  private disposed = false;
  private mounted = false;
  private contextLost = false;
  private ready = false;
  private startRequested: ChessMode | null = null;
  private onlineRequest: { color: ChessColor | null; fen: string } | null = null;

  private mode: ChessMode | null = null;
  private online = false;
  private onlineFinished = false;
  private humanSides = new Set<ChessColor>();
  private botSide: ChessColor | null = null;
  private viewSide: ChessColor = "w";
  private token = 0;
  private busy = false;
  private selected: string | null = null;
  private legalTargets: string[] = [];
  private pendingPromotion: { from: string; to: string } | null = null;
  private intentTimer: number | null = null;
  /** Serialises remote moves so a fast reply never overlaps an animation. */
  private remoteQueue: Promise<void> = Promise.resolve();

  private pieces: Piece3D[] = [];
  private originalPieces: Piece3D[] = [];
  private promotedPieces: Piece3D[] = [];
  private capturedPieces: { piece: Piece3D; color: ColorName }[] = [];
  private squares = new Map<string, THREE.Object3D>();
  private storages: Record<ColorName, THREE.Object3D[]> = { White: [], Black: [] };
  private storageCursor: Record<ColorName, number> = { White: 0, Black: 0 };
  private basePieces = new Map<string, Piece3D>();
  private pickables: THREE.Object3D[] = [];
  private turnIndicators: { w: THREE.Object3D | null; b: THREE.Object3D | null } = {
    w: null,
    b: null,
  };
  private checkPiece: Piece3D | null = null;

  private tweens: gsap.core.Tween[] = [];
  private botTimer: number | null = null;
  private pointerDown: { x: number; y: number; time: number } | null = null;
  private hovered: THREE.Object3D | null = null;

  private envTarget: THREE.WebGLRenderTarget | null = null;
  private pmrem: THREE.PMREMGenerator | null = null;
  private dracoLoader: DRACOLoader | null = null;
  private ktx2Loader: KTX2Loader | null = null;
  private gltfLoader: GLTFLoader | null = null;
  private textureCache = new Map<string, THREE.Texture>();
  private readonly stockfish = new StockfishEngine();

  constructor(container: HTMLElement, options: ChessSceneOptions = {}) {
    this.container = container;
    this.options = options;
  }

  async mount(): Promise<void> {
    if (this.mounted || this.disposed) return;
    this.mounted = true;

    try {
      this.setupRenderer();
      this.setupScene();
      this.attachEvents();
      this.startLoop();

      await this.loadEnvironment();
      if (this.disposed) return;

      await this.loadModel();
      if (this.disposed) return;

      this.ready = true;
      this.options.onProgress?.(1);
      this.options.onReady?.();

      if (this.onlineRequest) {
        const request = this.onlineRequest;
        this.onlineRequest = null;
        this.startOnline(request.color, request.fen);
      } else if (this.startRequested) {
        const mode = this.startRequested;
        this.startRequested = null;
        this.startGame(mode);
      }
    } catch (error) {
      if (this.disposed) return;
      console.error("[chess] scene mount failed", error);
      this.options.onError?.(
        "Impossible de charger l'échiquier 3D. Vérifie ta connexion puis recharge la page.",
      );
    }
  }

  startGame(mode: ChessMode): void {
    if (!this.ready) {
      this.startRequested = mode;
      return;
    }

    this.token += 1;
    this.clearBotTimer();
    this.clearIntentTimer();
    this.resetBoard();

    this.online = false;
    this.onlineFinished = false;
    this.mode = mode;
    this.humanSides.clear();
    this.botSide = null;

    if (mode === "hotseat") {
      this.humanSides.add("w");
      this.humanSides.add("b");
    } else if (mode === "vs-bot-white") {
      this.humanSides.add("w");
      this.botSide = "b";
    } else {
      this.humanSides.add("b");
      this.botSide = "w";
    }

    this.setView(mode === "vs-bot-black" ? "b" : "w");
    this.syncSnapshot();
    this.scheduleBot();
  }

  /** Leaves the current mode without clearing the board (menu overlay). */
  stopGame(): void {
    this.token += 1;
    this.clearBotTimer();
    this.clearIntentTimer();
    this.busy = true;
    this.clearSelection();
    this.pendingPromotion = null;
    this.mode = null;
    this.online = false;
    this.onlineFinished = false;
    this.humanSides.clear();
    this.botSide = null;
  }

  /**
   * Online entry point. The room owns the position: the scene mirrors the
   * FEN, sends intents, and only animates moves the server broadcasts back.
   * A null colour means the viewer is a spectator (board is read-only).
   */
  startOnline(color: ChessColor | null, fen: string): void {
    if (!this.ready) {
      this.onlineRequest = { color, fen };
      return;
    }

    this.token += 1;
    this.clearBotTimer();
    this.clearIntentTimer();
    this.resetBoard();

    this.online = true;
    this.onlineFinished = false;
    this.mode = null;
    this.botSide = null;
    this.humanSides.clear();
    if (color) this.humanSides.add(color);

    this.setView(color ?? "w");
    if (fen) this.layoutFromFen(fen);
    this.syncSnapshot();
  }

  /** Update the controllable side without restarting the board. */
  setOnlineColor(color: ChessColor | null): void {
    if (!this.online) return;
    this.humanSides.clear();
    if (color) this.humanSides.add(color);
  }

  /** Lock interactions once the room reports a result. */
  setOnlineFinished(finished: boolean): void {
    this.onlineFinished = finished;
  }

  /**
   * Adopt the server's position wholesale. Used on first load and as a
   * safety resync when the local mirror and the room disagree.
   */
  applyPosition(fen: string): void {
    if (!this.ready || !fen || this.disposed) return;
    this.resetBoard();
    this.layoutFromFen(fen);
    this.syncSnapshot();
  }

  /** Animate a move the server accepted. The room already applied it. */
  applyRemoteMove(move: ChessGameMove): void {
    if (!this.online || this.disposed) return;
    this.clearIntentTimer();
    const token = this.token;
    this.remoteQueue = this.remoteQueue
      .then(() => {
        // A reset/resync happened while the move was queued: the FEN is
        // already authoritative, never replay a stale move on top of it.
        if (this.disposed || token !== this.token) return;
        return this.performMove(move);
      })
      .catch(() => {
        // `performMove` already repairs the mirror; keep the queue alive.
      });
  }

  /**
   * The server refused the move, or the acknowledgement never came. Drop the
   * "waiting for the room" lock so the player can try again.
   */
  clearPendingIntent(): void {
    this.clearIntentTimer();
    this.busy = false;
    this.clearSelection();
    this.syncSnapshot();
  }

  /** The mirror's current FEN, for reconciliation against the room state. */
  getFen(): string {
    return this.game.fen();
  }

  resolvePromotion(piece: ChessPromotionPiece): void {
    if (!this.pendingPromotion) return;
    const { from, to } = this.pendingPromotion;
    this.pendingPromotion = null;

    if (this.online) {
      this.busy = true;
      this.clearSelection();
      this.options.onMoveIntent?.({ from, to, promotion: piece });
      this.armIntentTimer();
      return;
    }

    this.busy = false;
    void this.performMove({ from, to, promotion: piece });
  }

  cancelPromotion(): void {
    this.pendingPromotion = null;
    this.busy = false;
    this.syncSnapshot();
  }

  flipView(): void {
    this.setView(this.viewSide === "w" ? "b" : "w");
  }

  resetGame(): void {
    this.token += 1;
    this.clearBotTimer();
    this.resetBoard();
    if (this.mode) {
      this.setView(this.mode === "vs-bot-black" ? "b" : "w");
      this.syncSnapshot();
      this.scheduleBot();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ready = false;
    this.token += 1;

    this.stopLoop();

    this.clearBotTimer();
    this.clearIntentTimer();
    this.onlineRequest = null;
    this.killTweens();
    this.stockfish.dispose();

    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.canvas?.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas?.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas?.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas?.removeEventListener("pointerleave", this.handlePointerLeave);
    this.canvas?.removeEventListener("contextmenu", this.handleContextMenu);
    this.canvas?.removeEventListener("webglcontextlost", this.handleContextLost);
    this.canvas?.removeEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
    );

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    this.controls?.dispose();
    this.controls = null;

    if (this.canvas?.parentElement === this.container) {
      this.container.removeChild(this.canvas);
    }
    this.canvas = null;

    const disposedTextures = new Set<THREE.Texture>();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (!material) return;
      if (Array.isArray(material)) {
        for (const item of material) disposeMaterial(item, disposedTextures);
      } else {
        disposeMaterial(material, disposedTextures);
      }
    });

    this.textureCache.forEach((texture) => texture.dispose());
    this.textureCache.clear();
    this.envTarget?.dispose();
    this.envTarget = null;
    this.pmrem?.dispose();
    this.pmrem = null;

    this.ktx2Loader?.dispose();
    this.ktx2Loader = null;
    this.dracoLoader?.dispose();
    this.dracoLoader = null;
    this.gltfLoader = null;

    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = null;

    this.scene.clear();
    this.pieces = [];
    this.originalPieces = [];
    this.promotedPieces = [];
    this.capturedPieces = [];
    this.squares.clear();
    this.storages = { White: [], Black: [] };
    this.basePieces.clear();
    this.pickables = [];
  }

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  private setupRenderer(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 2.5;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.setAttribute("aria-label", "Échiquier 3D interactif");
    renderer.domElement.setAttribute("role", "img");

    this.container.appendChild(renderer.domElement);
    this.renderer = renderer;
    this.canvas = renderer.domElement;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.02, 100);
    // The GLB contains a whole room: the board itself is only ~0.48 world
    // units wide. Framing it from the original demo's room-wide distance made
    // the board a miniature. Start close to the board, from the white side
    // (the model is rotated 180°, so White lives at negative z).
    this.camera.position.set(0, 0.6, -0.6);
    this.camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(this.camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI / 2 - 0.29;
    controls.minDistance = 0.35;
    controls.maxDistance = 2.6;
    controls.zoomSpeed = 2;
    controls.update();
    this.controls = controls;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  private setupScene(): void {
    this.scene.background = new THREE.Color(0x7692e7);

    const ambient = new THREE.AmbientLight(0xffe4b6, 0.5);
    this.scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffe4b6, 1);
    directional.position.set(18.13, 15.78, 17.95);
    this.scene.add(directional);
  }

  private attachEvents(): void {
    if (!this.canvas) return;
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerleave", this.handlePointerLeave);
    this.canvas.addEventListener("contextmenu", this.handleContextMenu);
    this.canvas.addEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.addEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
    );
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private resize(): void {
    if (!this.renderer || !this.camera) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private startLoop(): void {
    if (
      this.frameId !== null ||
      this.disposed ||
      this.contextLost ||
      document.hidden
    ) {
      return;
    }

    const loop = () => {
      this.frameId = null;
      if (this.disposed || this.contextLost || document.hidden) return;
      this.frameId = requestAnimationFrame(loop);
      this.controls?.update();
      if (this.renderer && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    this.frameId = requestAnimationFrame(loop);
  }

  private stopLoop(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) this.stopLoop();
    else if (!this.disposed && !this.contextLost) this.startLoop();
  };

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  private async loadEnvironment(): Promise<void> {
    if (!this.renderer) return;
    try {
      const texture = await new EXRLoader().loadAsync(HDR_URL);
      if (this.disposed) {
        texture.dispose();
        return;
      }
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const target = pmrem.fromEquirectangular(texture);
      this.scene.environment = target.texture;
      this.scene.background = target.texture;
      this.envTarget?.dispose();
      this.envTarget = target;
      this.pmrem?.dispose();
      this.pmrem = pmrem;
      texture.dispose();
    } catch (error) {
      console.warn("[chess] environment map unavailable", error);
    }
  }

  private async loadModel(): Promise<void> {
    if (!this.renderer) return;

    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => {
      const ratio = total > 0 ? loaded / total : 0;
      this.options.onProgress?.(0.1 + ratio * 0.35);
    };

    this.dracoLoader = new DRACOLoader().setDecoderPath("/chess/draco/");
    this.ktx2Loader = new KTX2Loader()
      .setTranscoderPath("/chess/basis/")
      .detectSupport(this.renderer);

    this.gltfLoader = new GLTFLoader(manager).setDRACOLoader(this.dracoLoader);
    this.options.onProgress?.(0.08);

    const gltf = await this.gltfLoader.loadAsync(GLB_URL);
    if (this.disposed) {
      this.disposeLoadedObject(gltf.scene);
      return;
    }

    const model = gltf.scene;
    model.position.set(0, -1, 0);
    this.model = model;
    this.scene.add(model);
    this.options.onProgress?.(0.45);

    const textureEntries: { mesh: THREE.Mesh; path: string }[] = [];

    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;

      const name = mesh.name;

      for (const [key, path] of Object.entries(TEXTURES)) {
        if (name.includes(key)) {
          textureEntries.push({ mesh, path });
          break;
        }
      }

      if (name.includes("BTurn") || name.includes("WTurn")) {
        this.saveTransform(mesh);
        const material = colorMaterialOf(mesh)?.clone();
        if (material) {
          material.color.setHex(0xefefef);
          mesh.material = material;
        }
        if (name.includes("WTurn")) this.turnIndicators.w = mesh;
        else this.turnIndicators.b = mesh;
        return;
      }

      if (name.includes("ChessBack")) {
        const material = colorMaterialOf(mesh)?.clone();
        if (material) {
          material.color.setHex(0x000000);
          mesh.material = material;
        }
        return;
      }

      if (name.includes("Piece")) {
        this.registerPiece(mesh);
        return;
      }

      if (name.includes("Square")) {
        this.registerSquare(mesh);
        return;
      }

      if (name.includes("BStorage") || name.includes("WStorage")) {
        const match = /^([BW])Storage(\d+)$/.exec(name);
        if (match) {
          const color = match[1] === "W" ? "White" : "Black";
          this.storages[color][Number(match[2])] = mesh;
        }
        return;
      }

      if (name.includes("Flower") || name.includes("vaze")) {
        this.saveTransform(mesh);
      }
    });

    await this.applyTextures(textureEntries);
    if (this.disposed) return;

    for (const piece of this.originalPieces) {
      const material = colorMaterialOf(piece);
      if (material) piece.userData.originalColor = material.color.clone();
    }
    for (const square of this.squares.values()) {
      const material = colorMaterialOf(square);
      if (material) square.userData.originalColor = material.color.clone();
    }

    this.pickables = [...this.squares.values(), ...this.pieces];
    this.setTurnIndicator("w", false);

    if (this.renderer && this.camera) {
      if (typeof this.renderer.compileAsync === "function") {
        await this.renderer.compileAsync(this.scene, this.camera);
      } else {
        this.renderer.compile(this.scene, this.camera);
      }
    }
    if (this.disposed) return;
    this.options.onProgress?.(1);
  }

  private async applyTextures(entries: { mesh: THREE.Mesh; path: string }[]): Promise<void> {
    if (!this.ktx2Loader || !this.renderer) return;

    const remaining = new Set(entries.map((entry) => entry.path));
    const total = Math.max(1, remaining.size);
    let done = 0;

    const loadOne = async (path: string) => {
      try {
        if (!this.textureCache.has(path)) {
          const texture = await this.ktx2Loader!.loadAsync(path);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.anisotropy = Math.min(
            8,
            this.renderer?.capabilities.getMaxAnisotropy() ?? 1,
          );
          this.textureCache.set(path, texture);
        }
      } catch (error) {
        console.warn(`[chess] texture unavailable: ${path}`, error);
      } finally {
        done += 1;
        this.options.onProgress?.(0.45 + (done / total) * 0.5);
      }
    };

    await Promise.all([...remaining].map((path) => loadOne(path)));
    if (this.disposed) return;

    for (const { mesh, path } of entries) {
      const texture = this.textureCache.get(path);
      if (!texture) continue;
      this.applyMaterial(mesh, texture);
    }
  }

  private applyMaterial(mesh: THREE.Mesh, texture: THREE.Texture): void {
    const name = mesh.name;
    let roughness = 0.85;
    let metalness = 0;

    if (name.includes("Piece")) {
      roughness = 0.24;
      metalness = 0.35;
    } else if (name.includes("Square")) {
      roughness = 0.95;
      metalness = 0;
    } else if (name.includes("Floor")) {
      roughness = 0.72;
      metalness = 0;
    } else if (name.includes("Tables") || name.includes("Table")) {
      roughness = 0.55;
      metalness = 0.05;
    }

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      roughness,
      metalness,
    });
    mesh.material = material;
    if (!mesh.geometry.attributes.normal) {
      mesh.geometry.computeVertexNormals();
    }
  }

  private registerPiece(mesh: THREE.Mesh): void {
    const name = mesh.name;
    const square = squareSuffix(name);
    const typeMatch = /Piece[_\s]([A-Za-z]+)[_\s]/.exec(name);
    if (!square || !typeMatch) return;

    const color: ColorName = name.startsWith("Black") ? "Black" : "White";
    const typeName = typeMatch[1];
    const piece = mesh as unknown as Piece3D;

    piece.userData.NowAt = square;
    piece.userData.StartAt = square;
    piece.userData.color = color;
    piece.userData.Name = typeName;
    this.saveTransform(piece);

    const key = `${color}_${typeName}`;
    if (!this.basePieces.has(key)) this.basePieces.set(key, piece);

    this.originalPieces.push(piece);
    this.pieces.push(piece);
    this.addPieceShadow(piece);
  }

  private registerSquare(mesh: THREE.Mesh): void {
    const square = squareSuffix(mesh.name);
    if (!square) return;

    this.saveTransform(mesh);
    const material = colorMaterialOf(mesh)?.clone();
    if (material) mesh.material = material;
    this.squares.set(square, mesh);
  }

  private addPieceShadow(piece: Piece3D): void {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uOpacity: { value: 1 },
        uColor: { value: new THREE.Color(0x000000) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uOpacity;
        uniform vec3 uColor;
        void main() {
          float dist = distance(vUv, vec2(0.5));
          float alpha = smoothstep(0.5, 0.0, dist);
          gl_FragColor = vec4(uColor, alpha * uOpacity);
        }
      `,
    });

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.047, 0.047), material);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.001;
    shadow.name = "shadowPlane";
    piece.add(shadow);
  }

  private saveTransform(object: THREE.Object3D): void {
    object.userData.MainPosition = object.position.clone();
    object.userData.MainScale = object.scale.clone();
    object.userData.MainRotation = object.rotation.clone();
  }

  private disposeLoadedObject(root: THREE.Object3D): void {
    const textures = new Set<THREE.Texture>();
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (!material) return;
      if (Array.isArray(material)) {
        for (const item of material) disposeMaterial(item, textures);
      } else {
        disposeMaterial(material, textures);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Board state
  // -------------------------------------------------------------------------

  private resetBoard(): void {
    this.killTweens();
    // Drop any queued remote move: the board is about to be rebuilt from an
    // authoritative position, so replaying it would be wrong.
    this.remoteQueue = Promise.resolve();
    this.token += 1;
    this.selected = null;
    this.legalTargets = [];
    this.clearCheckHighlight();
    this.pendingPromotion = null;
    this.busy = false;

    for (const clone of this.promotedPieces) {
      clone.parent?.remove(clone);
      // Clones own their material copies (including the shadow child), so
      // dispose every mesh material; geometries stay shared with the base.
      clone.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const material of materials) material.dispose();
      });
      this.removePickable(clone);
    }
    this.promotedPieces = [];

    this.pieces = [];
    this.capturedPieces = [];
    this.storageCursor = { White: 0, Black: 0 };
    this.pickables = [...this.squares.values()];

    for (const piece of this.originalPieces) {
      piece.visible = true;
      piece.position.copy(piece.userData.MainPosition);
      piece.scale.copy(piece.userData.MainScale);
      piece.rotation.copy(piece.userData.MainRotation);
      piece.userData.NowAt = piece.userData.StartAt;
      this.pieces.push(piece);
      this.addPickable(piece);
    }

    for (const square of this.squares.values()) {
      square.position.copy(square.userData.MainPosition);
      const material = colorMaterialOf(square);
      if (material && square.userData.originalColor) {
        material.color.copy(square.userData.originalColor);
      }
    }

    this.game.reset();
    this.setTurnIndicator("w", false);
  }

  /**
   * Rebuild the visual board from a FEN. Originals are reused when the same
   * colour/type exists, so no piece materialises out of nowhere; promotions
   * that add extra queens/rooks/etc. clone a base piece. Any original not
   * found in the FEN is simply hidden — it was captured.
   */
  private layoutFromFen(fen: string): void {
    if (!this.game.load(fen)) return;

    for (const piece of this.originalPieces) {
      piece.visible = false;
      piece.userData.NowAt = "";
    }
    this.pieces = [];
    this.capturedPieces = [];
    this.storageCursor = { White: 0, Black: 0 };
    this.pickables = [...this.squares.values()];

    for (const { square, color, type } of this.game.boardPieces()) {
      const colorName = colorNameOf(color);
      const name = PIECE_NAMES[type];
      if (!name) continue;

      let piece =
        this.originalPieces.find(
          (candidate) =>
            !candidate.visible &&
            candidate.userData.color === colorName &&
            candidate.userData.Name === name &&
            candidate.userData.StartAt === square,
        ) ??
        this.originalPieces.find(
          (candidate) =>
            !candidate.visible &&
            candidate.userData.color === colorName &&
            candidate.userData.Name === name,
        ) ??
        null;

      if (!piece) piece = this.cloneBasePiece(colorName, name, square);
      if (!piece) continue;

      piece.visible = true;
      piece.scale.copy(piece.userData.MainScale);
      piece.rotation.copy(piece.userData.MainRotation);
      piece.userData.NowAt = square;

      const target = this.squares.get(square)?.userData.MainPosition as
        | THREE.Vector3
        | undefined;
      if (target) piece.position.copy(target);

      this.pieces.push(piece);
      this.addPickable(piece);
    }

    this.setTurnIndicator(this.game.turn(), false);
    this.applyCheckHighlight();
  }

  private cloneBasePiece(
    color: ColorName,
    name: string,
    square: string,
  ): Piece3D | null {
    const base = this.basePieces.get(`${color}_${name}`);
    if (!base || !this.model) return null;

    const clone = base.clone(true) as Piece3D;
    clone.name = `${color}-Piece_${name}_${square}`;
    clone.visible = true;
    clone.scale.copy(base.userData.MainScale);
    clone.rotation.copy(base.userData.MainRotation);
    clone.userData.NowAt = square;
    clone.userData.StartAt = square;
    clone.userData.color = color;
    clone.userData.Name = name;
    clone.userData.MainPosition = base.userData.MainPosition.clone();
    clone.userData.MainScale = base.userData.MainScale.clone();
    clone.userData.MainRotation = base.userData.MainRotation.clone();

    // Clone materials so disposals never reach the pristine base piece.
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const standard = colorMaterialOf(mesh)?.clone();
      if (standard) {
        mesh.material = standard;
        return;
      }
      const generic = materialOf(mesh)?.clone();
      if (generic) mesh.material = generic;
    });

    (base.parent ?? this.model).add(clone);
    this.promotedPieces.push(clone);
    return clone;
  }

  private findPieceAt(square: string): Piece3D | null {
    return this.pieces.find((piece) => piece.userData.NowAt === square) ?? null;
  }

  // -------------------------------------------------------------------------
  // Interaction
  // -------------------------------------------------------------------------

  private handlePointerMove = (event: PointerEvent): void => {
    this.updatePointer(event);
    this.updateHover();
  };

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.pointerDown = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    };
  };

  private handlePointerUp = (event: PointerEvent): void => {
    const down = this.pointerDown;
    this.pointerDown = null;
    if (!down || event.button !== 0) return;

    const distance = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    const duration = performance.now() - down.time;
    if (distance > 6 || duration > 700) return;

    this.updatePointer(event);
    const object = this.pick();
    if (!object) {
      this.clearSelection();
      return;
    }

    const square = this.squareOf(object);
    if (square) this.handleSquareClick(square);
  };

  private handlePointerLeave = (): void => {
    this.pointerDown = null;
    if (this.hovered) this.hovered = null;
    if (this.canvas) this.canvas.style.cursor = "grab";
  };

  private handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.stopLoop();
    this.options.onError?.(
      "Le rendu 3D a été interrompu par le navigateur. Restauration automatique en cours…",
    );
  };

  private handleContextRestored = (): void => {
    if (this.disposed) return;
    this.contextLost = false;
    this.options.onContextRestored?.();

    // A restored context keeps geometries and textures (Three re-uploads them),
    // but the PMREM render target is empty because its pixels only lived on the
    // GPU. Reload the EXR so the room keeps its lighting instead of turning
    // black.
    if (this.ready) void this.loadEnvironment();

    this.startLoop();
  };

  private updatePointer(event: PointerEvent): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private pick(): THREE.Object3D | null {
    if (!this.camera || this.pickables.length === 0) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, true);
    return hits.length > 0 ? hits[0].object : null;
  }

  private updateHover(): void {
    if (!this.canvas || !this.ready || this.busy) return;
    const object = this.pick();
    this.hovered = object;
    this.canvas.style.cursor = object ? "pointer" : "grab";
  }

  private squareOf(object: THREE.Object3D): string | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (typeof current.userData.NowAt === "string" && current.userData.NowAt) {
        return current.userData.NowAt;
      }
      if (current.name.includes("Square")) {
        return squareSuffix(current.name);
      }
      current = current.parent;
    }
    return null;
  }

  private handleSquareClick(square: string): void {
    if (
      this.busy ||
      (!this.mode && !this.online) ||
      this.onlineFinished ||
      this.game.isGameOver() ||
      this.pendingPromotion
    ) {
      return;
    }

    const turn = this.game.turn();
    if (!this.humanSides.has(turn)) return;

    if (this.selected) {
      if (square === this.selected) {
        this.clearSelection();
        return;
      }
      if (this.legalTargets.includes(square)) {
        this.requestMove(this.selected, square);
        return;
      }
    }

    const piece = this.game.pieceAt(square);
    if (piece && piece.color === turn) {
      this.selectSquare(square);
      return;
    }

    this.clearSelection();
  }

  private selectSquare(square: string): void {
    this.clearSelection();
    this.selected = square;
    this.legalTargets = [
      ...new Set(this.game.legalMovesFrom(square).map((move) => move.to)),
    ];

    const piece = this.findPieceAt(square);
    if (piece) {
      this.animate(piece.scale, {
        x: 1.12,
        y: 1.12,
        z: 1.12,
        duration: 0.18,
        ease: "power3.out",
      });
    }

    for (const target of this.legalTargets) {
      const squareMesh = this.squares.get(target);
      if (!squareMesh) continue;
      const material = colorMaterialOf(squareMesh);
      const occupant = this.game.pieceAt(target);
      if (material) {
        material.color.setHex(occupant ? 0xca1313 : 0x1f9d55);
      }
      this.animate(squareMesh.position, {
        y: squareMesh.userData.MainPosition.y + 0.01,
        duration: 0.2,
        ease: "power3.out",
      });
      const targetPiece = this.findPieceAt(target);
      if (targetPiece) {
        this.animate(targetPiece.position, {
          y: targetPiece.userData.MainPosition.y + 0.01,
          duration: 0.2,
          ease: "power3.out",
        });
      }
    }
  }

  private clearSelection(): void {
    if (this.selected) {
      const piece = this.findPieceAt(this.selected);
      if (piece) {
        this.animate(piece.scale, {
          x: 1,
          y: 1,
          z: 1,
          duration: 0.16,
          ease: "power3.out",
        });
      }
    }

    for (const target of this.legalTargets) {
      const squareMesh = this.squares.get(target);
      if (!squareMesh) continue;
      const material = colorMaterialOf(squareMesh);
      if (material && squareMesh.userData.originalColor) {
        material.color.copy(squareMesh.userData.originalColor);
      }
      this.animate(squareMesh.position, {
        y: squareMesh.userData.MainPosition.y,
        duration: 0.16,
        ease: "power3.out",
      });
      const targetPiece = this.findPieceAt(target);
      if (targetPiece) {
        this.animate(targetPiece.position, {
          y: targetPiece.userData.MainPosition.y,
          duration: 0.16,
          ease: "power3.out",
        });
      }
    }

    this.selected = null;
    this.legalTargets = [];
  }

  // -------------------------------------------------------------------------
  // Moves
  // -------------------------------------------------------------------------

  private requestMove(from: string, to: string): void {
    if (this.game.needsPromotion(from, to)) {
      this.pendingPromotion = { from, to };
      this.busy = true;
      this.clearSelection();
      this.options.onPromotion?.(from, to);
      return;
    }

    if (this.online) {
      // Never apply locally: send the intent and wait for the room.
      this.busy = true;
      this.clearSelection();
      this.options.onMoveIntent?.({ from, to });
      this.armIntentTimer();
      return;
    }

    void this.performMove({ from, to });
  }

  private async performMove(move: ChessGameMove): Promise<void> {
    if (this.disposed) return;
    this.clearIntentTimer();
    const token = this.token;

    let result: ReturnType<ChessGame["move"]>;
    try {
      result = this.game.move(move);
    } catch {
      // Online mirrors can drift if a broadcast was missed. Refuse to touch
      // the board; the view's FEN reconciliation will repair it.
      this.busy = false;
      this.clearSelection();
      this.syncSnapshot();
      return;
    }

    if (!result) {
      this.busy = false;
      this.clearSelection();
      this.syncSnapshot();
      return;
    }

    this.busy = true;
    this.clearSelection();
    this.clearCheckHighlight();

    const fromSquare = this.squares.get(result.from);
    const toSquare = this.squares.get(result.to);
    const movingPiece = this.findPieceAt(result.from);
    const capturedSquare = result.isEnPassant()
      ? `${result.to[0]}${result.from[1]}`
      : result.to;
    const capturedPiece = result.captured ? this.findPieceAt(capturedSquare) : null;

    if (capturedPiece) {
      this.capturePiece(capturedPiece);
    }

    let moveDuration = 0.3;

    if (movingPiece && fromSquare && toSquare) {
      movingPiece.userData.NowAt = "";
      const target = toSquare.userData.MainPosition.clone();
      moveDuration = movingPiece.userData.Name === "Knight" ? 0.36 : 0.3;

      this.animate(movingPiece.position, {
        x: target.x,
        z: target.z,
        duration: moveDuration,
        ease: "power3.inOut",
        onComplete: () => {
          movingPiece.position.x = target.x;
          movingPiece.position.z = target.z;
          if (!result.promotion) movingPiece.userData.NowAt = result.to;
        },
      });
      this.animate(movingPiece.position, {
        y: target.y + (movingPiece.userData.Name === "Knight" ? 0.07 : 0.025),
        duration: moveDuration / 2,
        yoyo: true,
        repeat: 1,
        ease: "power1.out",
      });

      if (result.promotion) {
        this.promotePiece(movingPiece, result, target, moveDuration);
      }
    }

    if (result.isKingsideCastle() || result.isQueensideCastle()) {
      const kingside = result.isKingsideCastle();
      const color = result.color;
      const rookFrom = kingside ? (color === "w" ? "h1" : "h8") : color === "w" ? "a1" : "a8";
      const rookTo = kingside ? (color === "w" ? "f1" : "f8") : color === "w" ? "d1" : "d8";
      const rook = this.findPieceAt(rookFrom);
      const targetSquare = this.squares.get(rookTo);
      if (rook && targetSquare) {
        const target = targetSquare.userData.MainPosition.clone();
        rook.userData.NowAt = "";
        this.animate(rook.position, {
          x: target.x,
          z: target.z,
          duration: moveDuration,
          ease: "power3.inOut",
          onComplete: () => {
            rook.position.x = target.x;
            rook.position.z = target.z;
            rook.userData.NowAt = rookTo;
          },
        });
      }
    }

    this.syncSnapshot();
    await this.wait(moveDuration * 1000 + 60);
    if (token !== this.token || this.disposed) return;

    this.busy = false;
    this.setTurnIndicator(this.game.isGameOver() ? null : this.game.turn());
    this.applyCheckHighlight();
    this.syncSnapshot();

    if (this.game.isGameOver()) {
      this.celebrate();
      return;
    }

    this.scheduleBot();
  }

  private capturePiece(piece: Piece3D): void {
    const color = piece.userData.color;
    this.removeFromPieces(piece);
    this.removePickable(piece);
    this.capturedPieces.push({ piece, color });
    piece.userData.NowAt = "";

    const storage = this.storages[color];
    const slot = storage[this.storageCursor[color] + 1];
    this.storageCursor[color] += 1;

    this.animate(piece.scale, {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.24,
      ease: "back.in",
      onComplete: () => {
        if (slot) {
          piece.position.copy(slot.position);
          piece.scale.set(0.7, 0.7, 0.7);
          piece.rotation.copy(slot.rotation);
          piece.visible = true;
        } else {
          piece.visible = false;
        }
      },
    });
  }

  private promotePiece(
    pawn: Piece3D,
    result: ReturnType<ChessGame["move"]>,
    target: THREE.Vector3,
    moveDuration: number,
  ): void {
    if (!result?.promotion || !this.model) return;

    const color = result.color === "w" ? "White" : "Black";
    const names: Record<ChessPromotionPiece, string> = {
      q: "Queen",
      r: "Rook",
      b: "Bishop",
      n: "Knight",
    };
    const promotion = result.promotion as ChessPromotionPiece;
    const base = this.basePieces.get(`${color}_${names[promotion]}`);
    if (!base) return;

    const clone = base.clone(true) as Piece3D;
    clone.name = `${color}-Piece_${names[promotion]}_${result.to}`;
    clone.position.copy(target);
    clone.scale.set(0, 0, 0);
    clone.visible = true;
    clone.userData.NowAt = result.to;
    clone.userData.StartAt = result.to;
    clone.userData.color = color;
    clone.userData.Name = names[promotion];
    clone.userData.MainPosition = target.clone();
    clone.userData.MainScale = new THREE.Vector3(1, 1, 1);
    clone.userData.MainRotation = new THREE.Euler(0, 0, 0);

    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const standard = colorMaterialOf(mesh)?.clone();
      if (standard) {
        mesh.material = standard;
        clone.userData.originalColor = standard.color.clone();
        return;
      }
      const generic = materialOf(mesh)?.clone();
      if (generic) mesh.material = generic;
    });

    // The pawn group (`Chess`) and the square group (`Chess.003`) carry the
    // same transform. Parent the clone to the pawn's parent so the square's
    // local position is valid; attaching it to the scene root would offset and
    // rescale it.
    (pawn.parent ?? this.model).add(clone);
    this.promotedPieces.push(clone);
    this.pieces.push(clone);
    this.addPickable(clone);

    // The clone is the piece on the board from now on. Detach the pawn
    // immediately so a capture in the next few hundred milliseconds targets
    // the promoted piece, not the shrinking pawn.
    pawn.userData.NowAt = "";
    this.removeFromPieces(pawn);
    this.removePickable(pawn);

    this.animate(clone.scale, {
      x: 1,
      y: 1,
      z: 1,
      delay: moveDuration + 0.05,
      duration: 0.28,
      ease: "back.out(1.8)",
    });

    this.animate(pawn.scale, {
      x: 0,
      y: 0,
      z: 0,
      delay: moveDuration + 0.05,
      duration: 0.2,
      ease: "back.in",
      onComplete: () => {
        pawn.visible = false;
      },
    });
  }

  private scheduleBot(): void {
    this.clearBotTimer();
    if (!this.mode || !this.botSide || this.game.isGameOver()) return;
    if (this.game.turn() !== this.botSide) return;

    const token = this.token;
    this.busy = true;
    this.syncSnapshot(true);

    this.botTimer = window.setTimeout(() => {
      void this.runBot(token);
    }, 350);
  }

  private async runBot(token: number): Promise<void> {
    if (
      token !== this.token ||
      this.disposed ||
      !this.mode ||
      !this.botSide ||
      this.game.turn() !== this.botSide
    ) {
      return;
    }

    this.syncSnapshot(true);
    let uci: string | null = null;

    try {
      uci = await this.stockfish.bestMove(this.game.fen(), {
        movetime: 900,
        skill: 10,
      });
    } catch (error) {
      console.warn("[chess] stockfish unavailable", error);
      if (token === this.token) {
        this.options.onError?.(
          "Stockfish est indisponible : l'IA joue un coup légal au hasard.",
        );
      }
    }

    if (token !== this.token || this.disposed) return;

    const move = (uci ? this.game.moveFromUci(uci) : null) ?? this.game.randomMove();
    if (!move) {
      this.busy = false;
      this.syncSnapshot();
      return;
    }

    this.busy = false;
    await this.performMove(move);
  }

  private clearBotTimer(): void {
    if (this.botTimer !== null) {
      window.clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }

  /**
   * Online intent guard: if the room never answers, the UI must not stay
   * frozen behind a `busy` flag. The server re-validates everything, so
   * simply unlocking is safe.
   */
  private armIntentTimer(): void {
    this.clearIntentTimer();
    this.intentTimer = window.setTimeout(() => {
      this.intentTimer = null;
      if (this.disposed || !this.online) return;
      this.busy = false;
      this.syncSnapshot();
    }, 6_000);
  }

  private clearIntentTimer(): void {
    if (this.intentTimer !== null) {
      window.clearTimeout(this.intentTimer);
      this.intentTimer = null;
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  // -------------------------------------------------------------------------
  // Visual state
  // -------------------------------------------------------------------------

  private syncSnapshot(thinking = false): void {
    this.options.onSnapshot?.(this.game.snapshot(thinking));
  }

  private setView(side: ChessColor): void {
    this.viewSide = side;
    if (!this.camera || !this.controls) return;

    // White pieces are at negative z once the GLB's 180° rotation is applied,
    // so the white-side camera must sit at negative z too.
    const z = side === "w" ? -0.6 : 0.6;
    this.animate(this.camera.position, {
      x: 0,
      y: 0.6,
      z,
      duration: 0.8,
      ease: "power2.inOut",
      onUpdate: () => {
        this.camera?.lookAt(0, 0, 0);
        this.controls?.update();
      },
      onComplete: () => {
        this.camera?.lookAt(0, 0, 0);
        this.controls?.update();
      },
    });
  }

  private setTurnIndicator(turn: ChessColor | null, animated = true): void {
    const entries: [ChessColor, THREE.Object3D | null][] = [
      ["w", this.turnIndicators.w],
      ["b", this.turnIndicators.b],
    ];

    for (const [side, indicator] of entries) {
      if (!indicator) continue;
      const base = indicator.userData.MainPosition as THREE.Vector3;
      const y = turn === side ? base.y + 0.01 : base.y;
      if (animated) {
        this.animate(indicator.position, {
          y,
          duration: 0.2,
          ease: "power2.inOut",
        });
      } else {
        indicator.position.y = y;
      }
    }
  }

  private applyCheckHighlight(): void {
    this.clearCheckHighlight();
    if (!this.game.isCheck()) return;

    const color = colorNameOf(this.game.turn());
    const king = this.pieces.find(
      (piece) => piece.userData.color === color && piece.userData.Name === "King",
    );
    if (!king) return;

    const material = colorMaterialOf(king);
    if (material) {
      material.emissive.setHex(0xff2222);
      material.emissiveIntensity = 0.6;
      this.checkPiece = king;
    }
  }

  private clearCheckHighlight(): void {
    if (!this.checkPiece) return;
    const material = colorMaterialOf(this.checkPiece);
    if (material) {
      material.emissive.setHex(0x000000);
      material.emissiveIntensity = 0;
    }
    this.checkPiece = null;
  }

  private celebrate(): void {
    const winner = this.game.winner();
    if (!winner) return;

    const winnerColor = colorNameOf(winner);
    for (const piece of this.pieces) {
      if (piece.userData.color === winnerColor) continue;
      this.removePickable(piece);
      this.animate(piece.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.6,
        ease: "back.in",
        onComplete: () => {
          piece.visible = false;
        },
      });
    }

    const king = this.pieces.find(
      (piece) => piece.userData.color === winnerColor && piece.userData.Name === "King",
    );
    if (!king) return;

    const base = king.userData.MainPosition.y;
    this.animate(king.position, {
      y: base + 0.03,
      duration: 1.4,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });
    this.animate(king.rotation, {
      y: "+=" + Math.PI * 2,
      duration: 3,
      repeat: -1,
      ease: "none",
    });
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  private animate(target: object, vars: gsap.TweenVars): gsap.core.Tween {
    const tween = gsap.to(target, vars);
    this.tweens.push(tween);
    return tween;
  }

  private killTweens(): void {
    for (const tween of this.tweens) tween.kill();
    this.tweens = [];
  }

  private addPickable(object: THREE.Object3D): void {
    if (!this.pickables.includes(object)) this.pickables.push(object);
  }

  private removePickable(object: THREE.Object3D): void {
    const index = this.pickables.indexOf(object);
    if (index >= 0) this.pickables.splice(index, 1);
  }

  private removeFromPieces(piece: Piece3D): void {
    const index = this.pieces.indexOf(piece);
    if (index >= 0) this.pieces.splice(index, 1);
  }
}
