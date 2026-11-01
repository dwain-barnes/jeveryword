import type { Evaluate } from './index.js';
export interface LocalClientOptions {
  /** Where server/d1_server.py listens. Must be 127.0.0.1, localhost or [::1]. */
  url?: string;
  /** Per-request timeout. Default 120,000 ms, since a CPU-only machine is slow. */
  timeoutMs?: number;
}
export function createLocalClient(options?: LocalClientOptions): Evaluate & { readonly endpoint: string; readonly model: string; readonly provider: 'local' };
