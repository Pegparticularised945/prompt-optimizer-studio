import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assignConversationGroup,
  type ConversationGroup,
} from '../src/lib/engine/conversation-policy'

test('pooled-3x reuses one group for first three jobs and rotates on fourth', () => {
  const groups: ConversationGroup[] = []

  const first = assignConversationGroup('pooled-3x', groups)
  assert.ok(first.group)
  groups.push(first.group)
  const second = assignConversationGroup('pooled-3x', groups)
  assert.ok(second.group)
  groups[0] = second.group
  const third = assignConversationGroup('pooled-3x', groups)
  assert.ok(third.group)
  groups[0] = third.group
  const fourth = assignConversationGroup('pooled-3x', groups)
  assert.ok(fourth.group)

  assert.equal(first.group.id, second.group.id)
  assert.equal(second.group.id, third.group.id)
  assert.notEqual(third.group.id, fourth.group.id)
  assert.equal(groups[0].jobsAssigned, 3)
  assert.equal(groups[0].retired, true)
  assert.equal(fourth.group.jobsAssigned, 1)
})

test('stateless policy never assigns a reusable group', () => {
  const result = assignConversationGroup('stateless', [])

  assert.equal(result.group, null)
})
