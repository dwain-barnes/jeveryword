// Every span of each kind, for PII redaction and the like. d1 reads one span per question, so ask
// for every kind at once, blank out what came back and ask again until nothing new turns up.
// Blanking keeps the length, so offsets into the blanked text are offsets into the original.
import { fail, readSpan } from './core.mjs';

const overlaps = (spans, r) => spans.some(s => s.start < r.end && r.start < s.end);

export async function findSpans({ text, kinds, evaluate, rounds = 50 }) {
  if (typeof text !== 'string' || text.length > 20_000) throw fail('invalid_input', 'text must be a string of at most 20,000 characters.');
  if (typeof evaluate !== 'function') throw fail('invalid_input', 'evaluate must be a function ({ state, questions }) => Promise<{ answers }>.');
  const ids = kinds && typeof kinds === 'object' ? Object.keys(kinds) : [];
  if (!ids.length || ids.length > 16) throw fail('invalid_input', 'kinds must map 1 to 16 ids to plain-English descriptions.');
  for (const id of ids) {
    if (!/^[a-z][a-z0-9_]*$/i.test(id)) throw fail('invalid_input', `kind ${JSON.stringify(id)} must start with a letter and contain only letters, digits and underscores.`);
    if (typeof kinds[id] !== 'string' || !kinds[id].trim()) throw fail('invalid_input', `kind "${id}" needs a non-empty description.`);
  }
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 500) throw fail('invalid_input', 'rounds must be a whole number from 1 to 500.');
  const started = performance.now();
  const spans = [];
  let masked = text, active = text.trim() ? ids : [], calls = 0, inputTokens = 0;
  while (active.length && calls < rounds) {
    const sent = masked;
    const questions = Object.fromEntries(active.map(id => [id, { type: 'text', instructions: kinds[id] }]));
    const response = await evaluate({ state: sent, questions });
    calls++;
    inputTokens += response.usage?.input_tokens ?? 0;
    const hits = [], next = [];
    for (const id of active) {
      const read = readSpan(sent, response.answers?.[id], `kind "${id}"`);
      // Nothing left of this kind, or it pointed back at text already blanked out.
      if (read.value === null || overlaps(spans, read)) continue;
      next.push(id);
      // Another kind took this text in the same round: ask again once it is blanked.
      if (!overlaps(hits, read)) hits.push({ label: id, value: read.value, start: read.start, end: read.end, score: read.found });
    }
    for (const h of hits) masked = masked.slice(0, h.start) + '█'.repeat(h.end - h.start) + masked.slice(h.end);
    spans.push(...hits);
    active = next;
  }
  spans.sort((a, b) => a.start - b.start);
  return { spans, calls, inputTokens, durationMs: Math.round(performance.now() - started) };
}
