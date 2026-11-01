import test from 'node:test';
import assert from 'node:assert/strict';
import { findSpans } from '../src/index.mjs';
import { stubEvaluate } from '../src/testing.mjs';
import { piiKinds, redact } from '../examples/pii.mjs';

test('finds every instance of each kind, one per round, and stops when nothing is left', async () => {
  const text = 'Alex Smith referred me. I am Maya Chen 👋, call 07700 900123 or email maya@example.com.';
  const evaluate = stubEvaluate({ text, values: { name: ['Alex Smith', 'Maya Chen'], phone: '07700 900123', email: 'maya@example.com' } });
  const { spans, calls } = await findSpans({ text, kinds: piiKinds, evaluate });
  assert.deepEqual(spans.map(s => [s.label, s.value]), [['name', 'Alex Smith'], ['name', 'Maya Chen'], ['phone', '07700 900123'], ['email', 'maya@example.com']]);
  for (const s of spans) assert.equal(text.slice(s.start, s.end), s.value);
  assert.equal(calls, 3);
  assert.equal(redact(text, spans), '[name] referred me. I am [name] 👋, call [phone] or email [email].');
});

test('a kind that points back at blanked text is done, and the round cap holds', async () => {
  const evaluate = async ({ state }) => ({ answers: { name: { text: state.slice(0, 4), span: [0, 4], found: 0.9 } } });
  const stuck = await findSpans({ text: 'Maya and Maya', kinds: { name: 'A name.' }, evaluate });
  assert.deepEqual([stuck.calls, stuck.spans.map(s => s.value)], [2, ['Maya']]);
  const text = 'Ann, Bob, Cat and Dan.';
  const capped = await findSpans({ text, kinds: { name: 'A name.' }, rounds: 2, evaluate: stubEvaluate({ text, values: { name: ['Ann', 'Bob', 'Cat', 'Dan'] } }) });
  assert.deepEqual(capped.spans.map(s => s.value), ['Ann', 'Bob']);
});

test('when two kinds claim the same text in one round, the first keeps it', async () => {
  const text = 'Call 07700 900123 today.';
  const evaluate = stubEvaluate({ text, values: { phone: '07700 900123', id: '07700 900123' } });
  const { spans, calls } = await findSpans({ text, kinds: { phone: 'A phone number.', id: 'An ID number.' }, evaluate });
  assert.deepEqual([spans.map(s => s.label), calls], [['phone'], 2]);
});

test('bad input is refused before the model is asked', async () => {
  const evaluate = () => assert.fail('the model should not be asked');
  await assert.rejects(findSpans({ text: 'x', kinds: { 'e-mail': 'An email.' }, evaluate }), e => e.code === 'invalid_input');
  await assert.rejects(findSpans({ text: 'x', kinds: {}, evaluate }), e => e.code === 'invalid_input');
  await assert.rejects(findSpans({ text: 'x', kinds: { name: 'A name.' }, rounds: 0, evaluate }), e => e.code === 'invalid_input');
  assert.equal((await findSpans({ text: ' ', kinds: { name: 'A name.' }, evaluate })).calls, 0);
});
