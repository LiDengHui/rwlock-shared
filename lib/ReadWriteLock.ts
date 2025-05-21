// ReadWriteLock with writer-priority using SharedArrayBuffer and Atomics
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
export class ReadWriteLock {
  public state: Int32Array

  // Index constants for clarity
  static readonly READERS = 0
  static readonly WRITER = 1
  static readonly WAITERS = 2

  timeout: number = 500

  constructor(
    sharedBuffer: SharedArrayBuffer,
    config: { timeout?: number } = {}
  ) {
    // Shared buffer: [readers, writerFlag, waitingWriters]
    this.state = new Int32Array(sharedBuffer)
    this.timeout = config.timeout || this.timeout
  }

  /** Acquire a read lock (async). Blocks if a writer is active or waiting. */
  async readLock(): Promise<void> {
    while (true) {
      const writerFlag = Atomics.load(this.state, ReadWriteLock.WRITER)
      const waitingWriters = Atomics.load(this.state, ReadWriteLock.WAITERS)
      // If no writer holds or is waiting, increment readers count and proceed
      if (writerFlag === 0 && waitingWriters === 0) {
        Atomics.add(this.state, ReadWriteLock.READERS, 1)
        return
      }
      // Otherwise wait (sleep) on the writer flag index until notified
      await Atomics.waitAsync(this.state, ReadWriteLock.WRITER, 0, this.timeout)
        .value
      await delay(0)
      // After wake-up, loop and recheck conditions
    }
  }

  /** Release a read lock. Wakes a waiting writer if this was the last reader. */
  readUnlock(): void {
    // Decrement reader count atomically
    Atomics.sub(this.state, ReadWriteLock.READERS, 1)
    // If there are no more active readers and writers are waiting, wake one writer
    const waitingWriters = Atomics.load(this.state, ReadWriteLock.WAITERS)
    if (waitingWriters > 0) {
      Atomics.notify(this.state, ReadWriteLock.READERS)
    }
  }

  /** Acquire a write lock (async). Blocks until no readers or writers are active. */
  async writeLock(): Promise<void> {
    // Mark this thread as a waiting writer
    Atomics.add(this.state, ReadWriteLock.WAITERS, 1)
    while (true) {
      const readers = Atomics.load(this.state, ReadWriteLock.READERS)
      // If no readers or writer, acquire the write lock by setting writerFlag = 1
      if (
        readers === 0 &&
        Atomics.compareExchange(this.state, ReadWriteLock.WRITER, 0, 1) === 0
      ) {
        break
      }
      // Otherwise wait: prefer waiting on readers index if readers exist
      if (readers > 0) {
        await Atomics.waitAsync(
          this.state,
          ReadWriteLock.READERS,
          0,
          this.timeout
        ).value
      } else {
        await Atomics.waitAsync(
          this.state,
          ReadWriteLock.WRITER,
          0,
          this.timeout
        ).value
      }

      await delay(0)
      // Loop to recheck conditions after waking
    }
    // Done waiting: no longer queued
    Atomics.sub(this.state, ReadWriteLock.WAITERS, 1)
  }

  /** Release the write lock. Wakes the next waiter(s) based on priority. */
  writeUnlock(): void {
    // Clear the writer flag
    Atomics.store(this.state, ReadWriteLock.WRITER, 0)

    // If writers are waiting, wake one writer; otherwise wake all waiting readers
    const waitingWriters = Atomics.load(this.state, ReadWriteLock.WAITERS)

    if (waitingWriters > 0) {
      Atomics.notify(this.state, ReadWriteLock.WRITER, 1)
    } else {
      Atomics.notify(this.state, ReadWriteLock.WRITER, Number.POSITIVE_INFINITY)
    }
  }
}
