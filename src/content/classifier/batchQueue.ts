import { BATCH_SIZE } from "../../shared/constants";
import type { ClassificationOutcome, SerializableCandidate } from "../../shared/types";
import { classifyBatch } from "./classifyPost";

type QueueItem = {
  candidate: SerializableCandidate & { cacheKey: string };
  resolve: (outcome: ClassificationOutcome) => void;
  reject: (error: unknown) => void;
};

export class BatchQueue {
  private readonly pageSessionId: string;
  private readonly maxConcurrentRequests: number;
  private queue: QueueItem[] = [];
  private timer: number | null = null;
  private inflight = 0;

  constructor(pageSessionId: string, maxConcurrentRequests = 3) {
    this.pageSessionId = pageSessionId;
    this.maxConcurrentRequests = maxConcurrentRequests;
  }

  enqueue(candidate: SerializableCandidate & { cacheKey: string }): Promise<ClassificationOutcome> {
    return new Promise((resolve, reject) => {
      this.queue.push({ candidate, resolve, reject });
      this.schedule();
    });
  }

  clear(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }

    for (const item of this.queue) {
      item.reject(new Error("Classification queue cleared"));
    }

    this.queue = [];
  }

  private schedule(): void {
    if (this.timer !== null) {
      return;
    }

    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, 250);
  }

  private async flush(): Promise<void> {
    if (this.inflight >= this.maxConcurrentRequests || this.queue.length === 0) {
      return;
    }

    const batch = this.queue.splice(0, BATCH_SIZE);
    this.inflight += 1;

    try {
      const results = await classifyBatch(
        this.pageSessionId,
        batch.map((item) => item.candidate)
      );

      for (const item of batch) {
        item.resolve(results[item.candidate.id] ?? { ok: false, error: "Missing classification result" });
      }
    } catch (error) {
      for (const item of batch) {
        item.reject(error);
      }
    } finally {
      this.inflight -= 1;
      if (this.queue.length > 0) {
        this.schedule();
      }
    }
  }
}
