import type { WorkerPoolManager } from "@pierre/diffs/worker"

export type WorkerPools = {
  unified: WorkerPoolManager | undefined
  split: WorkerPoolManager | undefined
}

export function getWorkerPools(): WorkerPools {
  return {
    unified: undefined,
    split: undefined,
  }
}
