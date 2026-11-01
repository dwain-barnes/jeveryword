import type { Evaluate, ChoiceQuestion, ChoiceAnswer } from './index.js';
/** A model stand-in for tests. `values` maps field or kind ids to verbatim text, a list of them, or null; `labels` maps chunk text to a label. */
export function stubEvaluate(options: { text: string; values?: Record<string, string | string[] | null>; labels?: Record<string, string>; none?: string;
  fallback?: (question: ChoiceQuestion, key: string) => ChoiceAnswer }): Evaluate & { calls: number };
