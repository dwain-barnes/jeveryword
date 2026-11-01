// Field extraction. Start server/d1_server.py, then run:
//   node examples/extract.mjs
import { extractSpans, createLocalClient } from '../src/index.mjs';

const text = "Alex Smith sent me your way. I'm Maya Chen, a software engineer at Fern Labs. My email is maya.old@example.com, actually use maya.chen@example.com.";
const { results, calls } = await extractSpans({
  text,
  evaluate: createLocalClient(),
  fields: [
    { id: 'name', description: "The speaker's full name, not somebody else's." },
    { id: 'role', description: "The speaker's job title, without a leading article." },
    { id: 'email', description: "The speaker's current email. Respect explicit corrections." },
    { id: 'phone', description: "The speaker's phone number." },
  ],
});
for (const [id, r] of Object.entries(results)) console.log(id.padEnd(6), `${Math.round(r.probability * 100)}%`.padStart(4), r.status === 'extracted' ? `${JSON.stringify(r.value)} [${r.start}, ${r.end})` : r.status);
console.error(`${calls} call(s)`);
