// PII redaction: findSpans() with one plain description per kind. Start server/d1_server.py, then:
//   node examples/pii.mjs "Call Maya Chen on 07700 900123."
import { pathToFileURL } from 'node:url';
import { findSpans } from '../src/index.mjs';

// One kind per type of data. A broad kind ("a password or PIN") keeps pointing at its first match
// and misses the rest. Order matters: when two kinds claim the same text in one round, the earlier
// one keeps it, so an account number is not taken for an NI number.
export const piiKinds = {
  name: 'The name of a person mentioned in the text.',
  email: 'An email address.',
  phone: 'A telephone number.',
  address: 'A street address, town or postcode where a person lives.',
  dob: "A person's date of birth.",
  account: 'A bank account number.',
  sort_code: 'A sort code.',
  card: 'A payment card number.',
  ni: 'A National Insurance or Social Security number.',
  nhs: 'An NHS number.',
  passport: 'A passport or driving licence number.',
  health: 'A health condition or medical detail about a person.',
  pin: 'A PIN.',
  password: 'A password.',
  key: 'An API key or access token.',
  id: 'Any other customer, patient or account reference number.',
};

// findSpans returns spans sorted and never overlapping, so they can be replaced back to front.
export function redact(text, spans) {
  return spans.reduceRight((out, s) => out.slice(0, s.start) + `[${s.label}]` + out.slice(s.end), text);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { createLocalClient } = await import('../src/client.mjs');
  const text = process.argv[2] ?? "Hi, it's Gareth Jones. My NI number is QQ 12 34 56 C. I live at 14 Heol y Coed, Cardiff CF14 2AB. Ring me on 07700 900123, I'm off work with depression.";
  const { spans, calls, durationMs } = await findSpans({ text, kinds: piiKinds, evaluate: createLocalClient() });
  for (const s of spans) console.log(`${s.label.padEnd(10)} ${String(Math.round(s.score * 100)).padStart(3)}%  ${s.value}`);
  console.log(`\n${redact(text, spans)}`);
  console.error(`${calls} call(s), ${durationMs} ms`);
}
