import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSpans, findSpans, classifyChunks, mergeChunks } from '../src/index.mjs';
import { stubEvaluate } from '../src/testing.mjs';

test('stubEvaluate drives extractSpans and findSpans', async () => {
  const text = 'Table for six, under Dana Whitfield. Dana will pay.';
  const fields = [{ id: 'name', description: 'full name' }, { id: 'phone', description: 'phone number' }, { id: 'size', description: 'party size' }];
  const { results } = await extractSpans({ text, fields, evaluate: stubEvaluate({ text, values: { name: 'Dana Whitfield', size: 'six', phone: null } }) });
  assert.deepEqual([results.name.value, results.size.value, results.phone.status], ['Dana Whitfield', 'six', 'missing']);
  const { spans } = await findSpans({ text, kinds: { name: 'A name.' }, evaluate: stubEvaluate({ text, values: { name: ['Dana Whitfield', 'Dana'] } }) });
  assert.deepEqual(spans.map(s => [s.value, s.start]), [['Dana Whitfield', 21], ['Dana', 37]]);
  assert.throws(() => stubEvaluate({ text: 'abc', values: { name: 'zzz' } }), /not in the text/);
});

test('stubEvaluate drives classifyChunks', async () => {
  const text = 'Call Dana Whitfield on 07700 900123.';
  const scan = await classifyChunks({ text, labels: { none: 'other', name: 'a name', phone: 'a phone number' },
    evaluate: stubEvaluate({ text, labels: { Dana: 'name', Whitfield: 'name', '07700': 'phone', '900123': 'phone' } }) });
  assert.deepEqual(mergeChunks(text, scan.detections).map(s => [s.label, s.value]), [['name', 'Dana Whitfield'], ['phone', '07700 900123']]);
});
