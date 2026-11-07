/**
 * Stockfish is a Web Worker speaking UCI. We deliberately keep it behind a
 * serialized promise queue: a worker has a single message stream, so two
 * overlapping `go` commands would interleave their `bestmove` answers.
 *
 * The assets live in `public/chess/stockfish/` (no CDN dependency, no third
 * party request at play time). If the worker fails to start — unsupported
 * browser, blocked WASM — the caller falls back to a random legal move so the
 * local game never freezes.
 */

const WORKER_URL = "/chess/stockfish/stockfish.js";

export interface StockfishOptions {
  /** Thinking time in milliseconds. Stockfish may answer a bit later. */
  movetime?: number;
  /** UCI Skill Level, 0 (worst) to 20 (full strength). */
  skill?: number;
}

export class StockfishEngine {
  private worker: Worker | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private disposed = false;
  private activeReject: ((error: Error) => void) | null = null;

  bestMove(fen: string, options: StockfishOptions = {}): Promise<string | null> {
    const run = this.chain.then(() => this.request(fen, options));
    // Keep the chain alive even when a request rejects: the next call must
    // still be able to run.
    this.chain = run.catch(() => undefined);
    return run;
  }

  dispose(): void {
    this.disposed = true;
    this.activeReject?.(new Error("Moteur arrêté"));
    this.activeReject = null;
    this.worker?.terminate();
    this.worker = null;
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;

    this.worker = new Worker(WORKER_URL);
    return this.worker;
  }

  private request(
    fen: string,
    { movetime = 1000, skill = 10 }: StockfishOptions,
  ): Promise<string | null> {
    if (this.disposed) return Promise.reject(new Error("Moteur arrêté"));

    const worker = this.ensureWorker();

    return new Promise<string | null>((resolve, reject) => {
      let settled = false;
      let stage: "uci" | "ready" | "search" = "uci";

      const finish = (move: string | null) => {
        if (settled) return;
        settled = true;
        this.activeReject = null;
        window.clearTimeout(timeout);
        worker.onmessage = null;
        worker.onerror = null;
        resolve(move);
      };

      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        this.activeReject = null;
        window.clearTimeout(timeout);
        worker.onmessage = null;
        worker.onerror = null;
        reject(new Error(message));
      };

      this.activeReject = (error) => fail(error.message);

      const timeout = window.setTimeout(() => {
        fail("Stockfish n'a pas répondu à temps");
      }, Math.max(4000, movetime + 4000));

      worker.onerror = (event) => {
        fail(event.message || "Impossible de charger Stockfish");
      };

      worker.onmessage = (event: MessageEvent) => {
        const line = typeof event.data === "string" ? event.data : "";
        if (!line) return;

        if (stage === "uci" && line.includes("uciok")) {
          stage = "ready";
          worker.postMessage(`setoption name Skill Level value ${skill}`);
          worker.postMessage("isready");
          return;
        }

        if (stage === "ready" && line.includes("readyok")) {
          stage = "search";
          worker.postMessage(`position fen ${fen}`);
          worker.postMessage(`go movetime ${movetime}`);
          return;
        }

        if (stage === "search" && line.startsWith("bestmove")) {
          const move = line.split(/\s+/)[1];
          finish(!move || move === "(none)" ? null : move);
        }
      };

      worker.postMessage("uci");
    });
  }
}
