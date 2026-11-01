export interface Chunk { id: number; text: string; start: number; end: number }
export interface Range { lo: number; hi: number }
export interface Resolved extends Range { value: string; start: number; end: number }
export interface Sentence extends Range { id: number; text: string }
export type Chunker = (text: string) => { text: string; start: number; end: number }[];
export const chunkers: { tokens: Chunker; words: Chunker };

export interface Doc {
  readonly text: string;
  readonly chunks: Chunk[];
  readonly prefix: string;
  /** "id|chunk" lines for the model to read; optionally only some ranges. */
  list(ranges?: Range[]): string;
  /** { source_text, tokens: list() } */
  readonly state: { source_text: string; tokens: string };
  /** Bare-id options (null descriptions). Beyond `fanout` chunks they become balanced id ranges. */
  options(options?: { lo?: number; hi?: number; fanout?: number; also?: string[] }): Record<string, null>;
  /** "12" → {lo:12,hi:12}; "40-59" → {lo:40,hi:59}; anything else → null. */
  decode(choice: unknown): Range | null;
  resolve(lo: number, hi?: number, options?: { trim?: boolean }): Resolved;
  resolve(range: Range, options?: { trim?: boolean }): Resolved;
  /** decode + resolve: the text a choice points at, or null for a non-id choice such as 'none'. */
  pick(choice: unknown, options?: { trim?: boolean }): Resolved | null;
  sentences(): Sentence[];
}
export function tokenize(text: string, options?: { chunker?: Chunker; prefix?: string }): Doc;
export function partition(lo: number, hi: number, fanout: number): Range[];
export function mergeChunks<K extends string = 'label'>(text: string, detections: ({ start: number; end: number; score: number } & Record<K, string>)[],
  options?: { threshold?: number; key?: K; joinable?: RegExp }): ({ start: number; end: number; score: number; value: string } & Record<K, string>)[];

export interface Usage { input_tokens: number; output_tokens: number }
export interface ChoiceQuestion { type: 'choice'; instructions: string; criteria: Record<string, string | null> }
export interface ChoiceAnswer { choice: string; probabilities: Record<string, number>; confidence?: number }
/** A value d1 reads from the state. `span` is in code points; `readSpan` converts it. */
export interface TextQuestion { type: 'text'; instructions: string }
export interface TextAnswer { text: string | null; span: [number, number] | null; found: number }
export interface EvaluateRequest { state: unknown; questions: Record<string, ChoiceQuestion | TextQuestion> }
export interface EvaluateResponse { answers: Record<string, ChoiceAnswer | TextAnswer>; model?: string; usage?: Usage; provider?: string }
/**
 * The only thing the pipelines need from a model: `createLocalClient()`, or anything that answers
 * the same way. Throw an error with `code: 'max_tokens_exceeded'` to let classifyChunks shrink its batch.
 */
export type Evaluate = (request: EvaluateRequest) => Promise<EvaluateResponse>;
/** A text answer as offsets into `text`, checked to hold the value; `value` is null when nothing was found. */
export function readSpan(text: string, answer: TextAnswer, what: string): { found: number; value: string; start: number; end: number } | { found: number; value: null };

export interface Field { id: string; description: string }
export type FieldResult =
  | { status: 'extracted'; value: string; start: number; end: number; probability: number }
  | { status: 'missing'; value: null; probability: number };
export interface ExtractOptions { text: string; fields: Field[]; evaluate: Evaluate }
export interface ExtractResult { results: Record<string, FieldResult>; calls: number; inputTokens: number; durationMs: number }
/** Thrown errors carry `code`: 'invalid_input', 'invalid_answer', and from the bundled client 'max_tokens_exceeded'. */
export type JeverywordErrorCode = 'invalid_input' | 'invalid_answer' | 'max_tokens_exceeded';
export function extractSpans(options: ExtractOptions): Promise<ExtractResult>;

export interface Span { label: string; value: string; start: number; end: number; score: number }
export interface FindOptions {
  text: string;
  /** Kind id → plain-English description, e.g. { email: 'An email address.' }. */
  kinds: Record<string, string>;
  evaluate: Evaluate;
  /** Most requests to make. Each finds at most one more span per kind. Default 50. */
  rounds?: number;
}
export function findSpans(options: FindOptions): Promise<{ spans: Span[]; calls: number; inputTokens: number; durationMs: number }>;

export interface Detection { id: number; value: string; start: number; end: number; label: string; score: number; probabilities: Record<string, number> }
export interface ClassifyOptions {
  text: string;
  /** Option name → description. Include a "nothing of interest" option (default key 'none') to get 1 - P(none) scores. */
  labels: Record<string, string>;
  evaluate: Evaluate;
  rules?: string;
  /** Key of the "nothing of interest" label (default 'none', required in labels). Pass false to score by top probability instead. */
  none?: string | false;
  chunker?: Chunker;
  maxBatch?: number;
  onBatch?: (event: unknown) => unknown;
}
export function classifyChunks(options: ClassifyOptions): Promise<{ detections: Detection[]; calls: number; inputTokens: number; durationMs: number; trace: unknown[] }>;

export { createLocalClient, type LocalClientOptions } from './client.js';
