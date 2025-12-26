import { cpus } from 'os';
import { createWorker } from 'mediasoup';
import type { Router, RouterOptions, Worker } from 'mediasoup/node/lib/types';

type WorkerEntry = {
  worker: Worker;
  routers: Set<Router>;
};

const resolveWorkerCount = () => {
  const rawCount = process.env.RTC_WORKERS || process.env.MEDIASOUP_WORKERS;
  const parsed = Number(rawCount);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;

  const cpuCount = cpus().length;
  return cpuCount > 0 ? cpuCount : 1;
};

export class WorkerPool {
  private readonly workers: WorkerEntry[] = [];
  private readonly workerCount: number;
  private nextWorkerIndex = 0;
  private started = false;
  private closing = false;
  private shutdownHookRegistered = false;

  constructor(workerCount = resolveWorkerCount()) {
    this.workerCount = workerCount;
  }

  private registerShutdownHooks() {
    if (this.shutdownHookRegistered) return;
    this.shutdownHookRegistered = true;

    const shutdown = async (signal: NodeJS.Signals) => {
      console.info(`[RTC] WorkerPool received ${signal}, shutting down mediasoup workers...`);
      await this.close();
      process.exit(0);
    };

    ['SIGINT', 'SIGTERM'].forEach((signal) => {
      process.once(signal, () => {
        void shutdown(signal as NodeJS.Signals);
      });
    });
  }

  private async createWorkerEntry() {
    const worker = await createWorker();
    const entry: WorkerEntry = { worker, routers: new Set() };

    worker.on('died', () => {
      console.error(`[RTC] mediasoup worker ${worker.pid ?? '<unknown pid>'} died, exiting in 2s...`);
      setTimeout(() => process.exit(1), 2000);
    });

    return entry;
  }

  private async ensureStarted() {
    if (this.started) return;
    this.started = true;
    this.registerShutdownHooks();

    const targetCount = Math.max(1, Math.floor(this.workerCount));
    for (let i = 0; i < targetCount; i += 1) {
      const entry = await this.createWorkerEntry();
      this.workers.push(entry);
    }
  }

  private pickWorker() {
    if (!this.workers.length) {
      throw new Error('WorkerPool wurde nicht initialisiert');
    }

    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  async createRouter(options?: RouterOptions): Promise<Router> {
    await this.ensureStarted();
    const worker = this.pickWorker();
    const router = await worker.worker.createRouter(options);

    worker.routers.add(router);
    router.observer.on('close', () => worker.routers.delete(router));

    return router;
  }

  async close() {
    if (this.closing) return;
    this.closing = true;

    await Promise.all(
      this.workers.map(async (entry) => {
        entry.routers.forEach((router) => {
          if (!router.closed) router.close();
        });
        entry.routers.clear();
        entry.worker.close();
      })
    );

    this.workers.length = 0;
  }
}

const workerPool = new WorkerPool();

export const getWorkerPool = () => workerPool;
export const rtcWorkerPool = workerPool;
