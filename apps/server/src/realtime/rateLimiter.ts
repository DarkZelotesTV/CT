type TokenBucketOptions = {
  capacity: number;
  refillRate: number;
  refillIntervalMs: number;
};

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number;
  private readonly refillIntervalMs: number;

  constructor(options: TokenBucketOptions) {
    this.capacity = options.capacity;
    this.refillRate = options.refillRate;
    this.refillIntervalMs = options.refillIntervalMs;
    this.tokens = options.capacity;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;

    const tokensToAdd = Math.floor((elapsed / this.refillIntervalMs) * this.refillRate);
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  tryRemoveToken() {
    this.refill();
    if (this.tokens <= 0) {
      return false;
    }
    this.tokens -= 1;
    return true;
  }
}

export const createDefaultTokenBucket = () =>
  new TokenBucket({
    capacity: 20,
    refillRate: 10,
    refillIntervalMs: 10_000,
  });
