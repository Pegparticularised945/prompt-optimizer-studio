import assert from 'node:assert/strict'
import test from 'node:test'

import { getPromptPreview, getTaskModelLabel, resolveLatestFullPrompt } from '../src/lib/presentation'

test('task model label collapses identical optimizer and judge models', () => {
  assert.equal(getTaskModelLabel('gpt-5.2', 'gpt-5.2'), 'gpt-5.2')
})

test('task model label exposes mixed legacy jobs safely', () => {
  assert.equal(getTaskModelLabel('gpt-5.4', 'gemini-3.1-pro'), '混合：gpt-5.4 / gemini-3.1-pro')
})

test('latest full prompt prefers the newest candidate prompt', () => {
  assert.equal(resolveLatestFullPrompt('raw prompt', [
    { optimizedPrompt: 'round 3 prompt' },
    { optimizedPrompt: 'round 2 prompt' },
  ]), 'round 3 prompt')
})

test('latest full prompt falls back to raw prompt when no candidate exists', () => {
  assert.equal(resolveLatestFullPrompt('raw prompt', []), 'raw prompt')
})

test('prompt preview compresses the latest full prompt for card display', () => {
  const preview = getPromptPreview('Line one.\n\nLine two with more details.\n\nLine three.', 24)
  assert.equal(preview, 'Line one. Line two with...')
})
