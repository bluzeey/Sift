import type { ClassificationOutcome } from "../../shared/types";

export class SessionCache {
  private outcomes = new Map<string, ClassificationOutcome>();
  private inflight = new Map<string, Promise<ClassificationOutcome>>();

  get(key: string): ClassificationOutcome | undefined {
    return this.outcomes.get(key);
  }

  getInFlight(key: string): Promise<ClassificationOutcome> | undefined {
    return this.inflight.get(key);
  }

  track(key: string, promise: Promise<ClassificationOutcome>): void {
    this.inflight.set(key, promise);
  }

  resolve(key: string, outcome: ClassificationOutcome): void {
    this.inflight.delete(key);
    this.outcomes.set(key, outcome);
  }

  delete(key: string): void {
    this.inflight.delete(key);
    this.outcomes.delete(key);
  }

  clear(): void {
    this.inflight.clear();
    this.outcomes.clear();
  }
}
