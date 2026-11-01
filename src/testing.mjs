// A stand-in for the model, so code built on jeveryword can be tested without the local server.
// You say what the right answers are; it answers the library's questions accordingly.
import { chunkers } from './core.mjs';

// stubEvaluate({ text, values: { name: 'Maya Chen', phone: null } })      for extractSpans
// stubEvaluate({ text, values: { name: ['Alex Smith', 'Maya Chen'] } })   for findSpans
// stubEvaluate({ text, labels: { Maya: 'name', Chen: 'name' } })          for classifyChunks
// A value must appear verbatim in the text; null or an absent id is answered as not found. Chunks
// not listed in `labels` answer `none`. Other questions get `fallback(question, key)` if you pass one.
export function stubEvaluate({ text, values = {}, labels = {}, none = 'none', fallback } = {}) {
  for (const v of Object.values(values).flat()) {
    if (v !== null && !text.includes(v)) throw new Error(`stubEvaluate: ${JSON.stringify(v)} is not in the text.`);
  }
  const evaluate = async ({ state, questions }) => {
    evaluate.calls++;
    return { model: 'stub', usage: { input_tokens: 0, output_tokens: 0 }, answers: Object.fromEntries(Object.entries(questions).map(([key, q]) => {
      if (q.type === 'text') {
        // The first listed value still visible: findSpans blanks out what it has found.
        const value = [values[key]].flat().find(v => typeof v === 'string' && state.includes(v));
        if (value === undefined) return [key, { text: null, span: null, found: 0 }];
        const at = Array.from(state.slice(0, state.indexOf(value))).length;
        return [key, { text: value, span: [at, at + Array.from(value).length], found: 1 }];
      }
      const chunk = /^Chunk c\d+: (".*")$/s.exec(q.instructions);
      if (chunk) {
        const label = labels[JSON.parse(chunk[1])] ?? none;
        return [key, { choice: label, probabilities: Object.fromEntries(Object.keys(q.criteria).map(k => [k, k === label ? 1 : 0])) }];
      }
      if (fallback) return [key, fallback(q, key)];
      throw new Error(`stubEvaluate: no answer for question ${key}: ${q.instructions.slice(0, 80)}`);
    })) };
  };
  evaluate.calls = 0;
  return evaluate;
}
export { chunkers };
