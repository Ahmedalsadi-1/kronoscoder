import type { WorkerPoolManager } from "@pierre/diffs/worker"
import { createSimpleContext } from "./helper"

export type WorkerPools = {
  unified: WorkerPoolManager | undefined
  split: WorkerPoolManager | undefined
}

const ctx = createSimpleContext<WorkerPools, { pools: WorkerPools }>({
  name: "WorkerPool",
  init: (props) => props.pools,
})

export const WorkerPoolProvider = ctx.provider

export function useWorkerPool(style: "unified" | "split" | undefined) {
  const pools = ctx.use()
  if (style === "split") return pools.split
  return pools.unified
}
