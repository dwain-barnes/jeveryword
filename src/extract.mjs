// Field extraction with d1's text reads: one question per field, all in one request. d1 answers
// each with the exact span it read, or nothing when the value is not in the text, so there is no
// token numbering or boundary search to do here.
import { fail, readSpan } from './core.mjs';

export async function extractSpans({ text, fields, evaluate }) {
  if (typeof text !== 'string' || text.length > 20_000) throw fail('invalid_input', `text must be a string of at most 20,000 characters (got ${typeof text === 'string' ? `${text.length} characters` : typeof text}).`);
  if (typeof evaluate !== 'function') throw fail('invalid_input', 'evaluate must be a function ({ state, questions }) => Promise<{ answers }>.');
  if (!Array.isArray(fields) || !fields.length || fields.length > 16) throw fail('invalid_input', 'fields must be an array of 1 to 16 { id, description } objects.');
  fields.forEach((f, i) => {
    if (typeof f?.id !== 'string' || !/^[a-z][a-z0-9_]*$/i.test(f.id)) throw fail('invalid_input', `fields[${i}].id ${JSON.stringify(f?.id)} must start with a letter and contain only letters, digits and underscores.`);
    if (fields.findIndex(g => g?.id === f.id) !== i) throw fail('invalid_input', `fields[${i}].id ${JSON.stringify(f.id)} is used more than once.`);
    if (typeof f.description !== 'string' || !f.description.trim()) throw fail('invalid_input', `fields[${i}] (${f.id}) needs a non-empty description.`);
  });
  const started = performance.now();
  if (!text.trim()) {
    const results = Object.fromEntries(fields.map(f => [f.id, { status: 'missing', value: null, probability: 1 }]));
    return { results, calls: 0, inputTokens: 0, durationMs: 0 };
  }
  const questions = Object.fromEntries(fields.map(f => [f.id, { type: 'text', instructions: f.description }]));
  const response = await evaluate({ state: text, questions });
  const results = Object.fromEntries(fields.map(f => {
    const { found, value, start, end } = readSpan(text, response.answers?.[f.id], `field "${f.id}"`);
    return [f.id, value === null ? { status: 'missing', value: null, probability: 1 - found } : { status: 'extracted', value, start, end, probability: found }];
  }));
  return { results, calls: 1, inputTokens: response.usage?.input_tokens ?? 0, durationMs: Math.round(performance.now() - started) };
}
