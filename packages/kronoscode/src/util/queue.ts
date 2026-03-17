export class AsyncQueue<T> implements AsyncIterable<T> {
  private queue: T[] = []
  private resolvers: ((value: T) => void)[] = []

  push(item: T) {
    const resolve = this.resolvers.shift()
    if (resolve) resolve(item)
    else this.queue.push(item)
  }

  async next(): Promise<T> {
    if (this.queue.length > 0) return this.queue.shift()!
    return new Promise((resolve) => this.resolvers.push(resolve))
  }

  async *[Symbol.asyncIterator]() {
    while (true) yield await this.next()
  }
}

export async function work<T>(concurrency: number, items: T[], fn: (item: T) => Promise<void>) {
  const pending = [...items]
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (true) {
        const item = pending.pop()
        if (item === undefined) return
        await fn(item)
      }
    }),
  )
}

// Simple QueueManager implementation for job scheduling
export class QueueManagerClass {
  private jobQueues = new Map<string, AsyncQueue<any>>()

  addJob<T>(jobId: string, data: T, options: any = {}): { id: string } {
    const queue = this.jobQueues.get(jobId) || new AsyncQueue<any>()
    queue.push({ ...data, jobId, id: jobId, options })
    this.jobQueues.set(jobId, queue)

    return { id: jobId }
  }

  addSessionProvisionJob(data: any): { id: string } {
    const jobId = `session-provision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    return this.addJob(jobId, data)
  }

  async processJobs(): Promise<void> {
    for (const [jobId, queue] of this.jobQueues.entries()) {
      const job = await queue.next()
      if (job) {
        try {
          await this.processJob(job)
        } catch (error) {
          console.error(`Job processing error for ${jobId}:`, error)
        }
      }
    }
  }

  private async processJob(job: any): Promise<void> {
    const { jobId, options } = job
    const jobFn = this.jobHandlers[jobId]

    if (jobFn) {
      await jobFn(job)
    } else {
      console.warn(`No handler found for job: ${jobId}`)
    }
  }

  private jobHandlers: Record<string, (job: any) => Promise<void>> = {
    "session-lock-expiry": async (job: any) => {
      // Implementation would go here
      console.log("Lock expiry job processed:", job)
    },
  }

  async removeJob(jobId: string): Promise<void> {
    // In a real implementation, this would cancel or remove the job from the queue
    console.log(`Job removed: ${jobId}`)
  }

  getQueue(jobId: string): AsyncQueue<any> | undefined {
    return this.jobQueues.get(jobId)
  }
}

export const QueueManager = new QueueManagerClass()
