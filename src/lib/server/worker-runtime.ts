export interface WorkerRuntimeState {
  ownerId: string
  started: boolean
  intervalId: ReturnType<typeof setInterval> | null
  activeCount: number
}

export function createWorkerRuntimeState(ownerId: string): WorkerRuntimeState {
  return {
    ownerId,
    started: false,
    intervalId: null,
    activeCount: 0,
  }
}

export function shouldReplaceWorkerRuntime(
  state: WorkerRuntimeState | undefined,
  ownerId: string,
) {
  return !state || state.ownerId !== ownerId
}
