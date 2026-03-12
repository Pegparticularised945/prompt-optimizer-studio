import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

test('section rhythm styles avoid fixed header min-height hacks for settings and latest-results lanes', () => {
  const source = fs.readFileSync(
    '/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/.worktrees/open-source-hardening/src/styles/globals.css',
    'utf8',
  )

  assert.doesNotMatch(
    source,
    /\.settings-panel-compact\s+\.section-head\s*\{[^}]*min-height:/s,
  )

  assert.doesNotMatch(
    source,
    /\.latest-results-grid\s+\[data-ui="recent-results-column"\]\s+\.lane-header,\s*\.latest-results-grid\s+\[data-ui="history-results-column"\]\s+\.lane-header\s*\{[^}]*min-height:/s,
  )

  assert.match(source, /\.section-body-stack\s*\{/)
})
