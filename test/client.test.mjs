import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalClient } from '../src/client.mjs';

test('posts the request unchanged to the local server and refuses redirects', async t => {
  const request = { state: 'Hi Maya', questions: { name: { type: 'text', instructions: 'A name.' } } };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:8411/v1/systemone');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), request);
    return Response.json({ model: 'd1-2B', answers: { name: { text: 'Maya', span: [3, 7], found: 0.97 } }, usage: { input_tokens: 9, output_tokens: 0 } });
  });
  const result = await createLocalClient()(request);
  assert.deepEqual([result.provider, result.usage.input_tokens, result.answers.name.text], ['local', 9, 'Maya']);
});

test('will not send text off this machine', () => {
  assert.throws(() => createLocalClient({ url: 'https://api.typesafe.ai/v1/systemone' }), /not to api\.typesafe\.ai/);
  assert.throws(() => createLocalClient({ url: 'http://127.0.0.1.example.com/v1/systemone' }), /only sends text to this machine/);
  for (const url of ['http://localhost:9000/v1/systemone', 'http://[::1]:8411/v1/systemone']) assert.equal(createLocalClient({ url }).endpoint, url);
});

test('errors carry the token-limit code but never the response body', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'max_tokens_exceeded', echo: 'private source text' }, { status: 413 }));
  await assert.rejects(createLocalClient()({ state: 'x', questions: {} }), e => e.code === 'max_tokens_exceeded' && !e.message.includes('private'));
});
