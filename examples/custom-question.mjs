// Ask your own question about a text and get the exact text back. Here: "which word is
// misspelled?" Nothing in the library knows about spelling. Start server/d1_server.py, then run:
//   node examples/custom-question.mjs
import { createLocalClient, readSpan } from '../src/index.mjs';

const text = 'Please send the recieved invoices to accounting before Friday.';
const evaluate = createLocalClient();
const { answers } = await evaluate({ state: text, questions: { typo: { type: 'text', instructions: 'A misspelled word.' } } });

const typo = readSpan(text, answers.typo, 'typo');
console.log(typo.value === null ? 'no typo found' : typo);
