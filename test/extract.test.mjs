import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, partition, extractSpans } from '../src/index.mjs';
import { stubEvaluate } from '../src/testing.mjs';

const chunksOf = text => tokenize(text).chunks;
const sentences = text => tokenize(text).sentences();

test('tokens preserve Unicode and exact offsets', () => {
  const source = '👋  José van der Berg; a@b.com';
  for (const t of chunksOf(source)) assert.equal(source.slice(t.start, t.end), t.text);
});

test('joined capitalized names split without inserting spaces', () => {
  const text = '👋 my name is JustinKessler';
  const tokens = chunksOf(text);
  assert.deepEqual(tokens.slice(-2).map(t => t.text), ['Justin', 'Kessler']);
  for (const t of tokens) assert.equal(text.slice(t.start, t.end), t.text);
  assert.deepEqual(chunksOf('JoséKessler McDonald JUSTIN').map(t => t.text), ['José', 'Kessler', 'Mc', 'Donald', 'JUSTIN']);
});

test('partitions cover the full interval with no gaps or overlaps', () => {
  for (let n = 1; n < 300; n++) for (const x of [2, 8, 253]) {
    const groups = partition(0, n - 1, x);
    assert.deepEqual(groups.flatMap(g => Array.from({ length: g.hi - g.lo + 1 }, (_, j) => g.lo + j)), Array.from({ length: n }, (_, i) => i));
  }
});

test('sentences split conservatively and keep emails, decimals and abbreviations whole', () => {
  const text = 'Dr. Ada Lovelace paid $3.50 to ada@example.com. Was it late? No!\nSecond line';
  assert.deepEqual(sentences(text).map(s => s.text), ['Dr. Ada Lovelace paid $3.50 to ada@example.com.', 'Was it late?', 'No!', 'Second line']);
});

test('one request with a text question per field; values come back as exact spans after emoji', async () => {
  const text = '👋 I am José van  der Berg, call me on 07700 900123.';
  const fields = [{ id: 'name', description: 'full name' }, { id: 'phone', description: 'phone number' }, { id: 'email', description: 'email' }];
  const stub = stubEvaluate({ text, values: { name: 'José van  der Berg', phone: '07700 900123', email: null } });
  const requests = [];
  const { results, calls } = await extractSpans({ text, fields, evaluate: req => { requests.push(req); return stub(req); } });
  assert.equal(calls, 1);
  assert.deepEqual(requests[0], { state: text, questions: { name: { type: 'text', instructions: 'full name' }, phone: { type: 'text', instructions: 'phone number' }, email: { type: 'text', instructions: 'email' } } });
  assert.equal(results.name.value, 'José van  der Berg');
  assert.equal(text.slice(results.phone.start, results.phone.end), '07700 900123');
  assert.deepEqual(results.email, { status: 'missing', value: null, probability: 1 });
});

test('empty text skips the model, and answers that do not match the text fail closed', async () => {
  const fields = [{ id: 'name', description: 'name' }];
  const empty = await extractSpans({ text: '  ', fields, evaluate: () => assert.fail('the model should not be asked') });
  assert.deepEqual([empty.calls, empty.results.name.status], [0, 'missing']);
  const answering = answer => async () => ({ answers: { name: answer } });
  for (const bad of [{ text: 'Maya', span: [0, 4], found: 0.9 }, { text: 'Maya', span: [5, 99], found: 0.9 }, { choice: 'yes' }]) {
    await assert.rejects(extractSpans({ text: 'I am Maya', fields, evaluate: answering(bad) }), e => e.code === 'invalid_answer');
  }
  await assert.rejects(extractSpans({ text: 'name', fields: [{ id: 'phone-number', description: 'x' }], evaluate: async () => ({}) }), e => e.code === 'invalid_input' && /fields\[0\]\.id "phone-number"/.test(e.message));
});
