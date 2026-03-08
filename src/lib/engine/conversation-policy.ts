export type ConversationPolicy = 'stateless' | 'pooled-3x'

export interface ConversationGroup {
  id: string
  jobsAssigned: number
  maxJobs: number
  retired: boolean
  createdAt: string
  retiredAt: string | null
}

export function assignConversationGroup(
  policy: ConversationPolicy,
  existingGroups: ConversationGroup[],
  existingGroupId?: string | null,
): { group: ConversationGroup | null } {
  if (policy === 'stateless') {
    return { group: null }
  }

  if (existingGroupId) {
    const existing = existingGroups.find((group) => group.id === existingGroupId)
    if (existing) {
      return { group: existing }
    }
  }

  const activeGroup = existingGroups.find((group) => !group.retired && group.jobsAssigned < group.maxJobs)
  if (activeGroup) {
    const jobsAssigned = activeGroup.jobsAssigned + 1
    return {
      group: {
        ...activeGroup,
        jobsAssigned,
        retired: jobsAssigned >= activeGroup.maxJobs,
        retiredAt: jobsAssigned >= activeGroup.maxJobs ? new Date().toISOString() : null,
      },
    }
  }

  return {
    group: {
      id: crypto.randomUUID(),
      jobsAssigned: 1,
      maxJobs: 3,
      retired: false,
      createdAt: new Date().toISOString(),
      retiredAt: null,
    },
  }
}
