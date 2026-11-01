# jeveryword (local)

A fork of [jkrup/jeveryword](https://github.com/jkrup/jeveryword) that runs on
[LiquidAI/d1-2B](https://huggingface.co/LiquidAI/d1-2B) on your own machine instead of
TypeSafe's hosted Jev. The text you scan never leaves the machine.

Jev can only pick from options, so the original numbers the words of a text and has Jev pick
numbers. d1 can read a span straight out of the text, so this fork asks for values directly.
Field extraction is one request. Finding every name, email or account number takes a few:
ask for each kind, blank out what came back, and ask again until nothing new turns up.

Every result is a substring of your input, and `text.slice(start, end) === value` holds for all
of them. An answer whose span does not hold its value is refused, not used.

> Experimental. Checked on a handful of hand-written messages in English and Welsh, not
> benchmarked. Run your own data through it before relying on it.

## Setup

The model runs in a small Python server that only listens on 127.0.0.1. Download the model
once, then start the server:

```sh
pip install -r server/requirements.txt
hf download LiquidAI/d1-2B --revision 97c57047d5852d77e02dfac211f8768aff77a8b2
python server/d1_server.py
```

The server sets `HF_HUB_OFFLINE=1`, so nothing is fetched after the download. It uses a CUDA
or Apple GPU when there is one. On CPU it works, but a message takes a few seconds. Set
`D1_PORT` to move it off 8411.

The JavaScript side has no dependencies and needs Node 20 or later. Its client,
`createLocalClient()`, only accepts a localhost address, refuses redirects and has no fallback:
if the server is down, a call fails rather than the text going anywhere else.

## Finding PII

```js
import { findSpans, createLocalClient } from 'jeveryword';

const text = "Hi, it's Gareth Jones. My NI number is QQ 12 34 56 C. Ring me on 07700 900123.";
const { spans } = await findSpans({
  text,
  evaluate: createLocalClient(),
  kinds: {
    name: 'The name of a person mentioned in the text.',
    ni: 'A National Insurance or Social Security number.',
    phone: 'A telephone number.',
  },
});
// [{ label: 'name',  value: 'Gareth Jones',  start: 9,  end: 21, score: 0.99 },
//  { label: 'ni',    value: 'QQ 12 34 56 C', start: 39, end: 52, score: 1 },
//  { label: 'phone', value: '07700 900123',  start: 65, end: 77, score: 0.99 }]
```

Give each type of data its own kind. A broad one such as "a password or PIN" keeps pointing at
its first match and misses the rest. When two kinds claim the same text in a round, the one
listed first keeps it. [examples/pii.mjs](examples/pii.mjs) has 16 kinds for UK and US
personal data and a `redact` helper:

```sh
node examples/pii.mjs "Pay from account 31926819, sort code 20-00-00. The PIN is 4921."
```

Up to 16 kinds and 20,000 characters per call. Each round finds at most one more of each kind,
and `rounds` (default 50) caps how many it makes.

## Field extraction

```js
import { extractSpans, createLocalClient } from 'jeveryword';

const text = "Alex Smith sent me your way. I'm Maya Chen, a software engineer at Fern Labs. " +
  'My email is maya.old@example.com, actually use maya.chen@example.com.';

const { results } = await extractSpans({
  text,
  evaluate: createLocalClient(),
  fields: [
    { id: 'name',  description: "The speaker's full name, not somebody else's." },
    { id: 'email', description: "The speaker's current email. Respect explicit corrections." },
    { id: 'phone', description: "The speaker's phone number." },
  ],
});
// results.name   { status: 'extracted', value: 'Maya Chen', start: 33, end: 42, probability: 0.99 }
// results.email  { status: 'extracted', value: 'maya.chen@example.com', start: 125, end: 146, probability: 1 }
// results.phone  { status: 'missing', value: null, probability: 1 }
```

The description is the whole question, so say whose value you mean and which one when there
are several. Up to 16 fields and 20,000 characters per call.

## Your own questions

Every function takes `evaluate`, a function `({ state, questions }) => Promise<{ answers }>`.
`createLocalClient()` is one, and you can call it with any question d1 understands. For a
`text` question, `readSpan` turns the answer into JavaScript string offsets:

```js
import { createLocalClient, readSpan } from 'jeveryword';

const text = 'Please send the recieved invoices to accounting before Friday.';
const { answers } = await createLocalClient()({ state: text, questions: { typo: { type: 'text', instructions: 'A misspelled word.' } } });
readSpan(text, answers.typo, 'typo');   // { found: 0.92, value: 'recieved', start: 16, end: 24 }
```

`classifyChunks`, which labels every word, is still here and runs on d1. d1 scores ordinary
words too high for it to separate PII from the rest, so use `findSpans` for that.

Tests use a stand-in model from `jeveryword/testing` and need no server: `npm test`.

## Licence

The code is MIT, as upstream. d1-2B is under the
[LFM Open License v1.0](https://huggingface.co/LiquidAI/d1-2B/blob/main/LICENSE), which allows
commercial use only for organisations under $10M annual revenue.
