// src/ReadWriteLock.ts
export class ReadWriteLock {
  public lock: Int32Array
  public readonly WRITE_LOCK = 1
  public readonly READ_COUNT = 0

  constructor(sharedBuffer: SharedArrayBuffer) {
    this.lock = new Int32Array(sharedBuffer)
    // 确保初始状态原子化
    Atomics.compareExchange(this.lock, this.READ_COUNT, -1, 0)
    Atomics.compareExchange(this.lock, this.WRITE_LOCK, -1, 0)
  }

  async readLock() {
    while (true) {
      // 双重检查：获取读锁前再次验证无写操作
      const currentWriteLock = Atomics.load(this.lock, this.WRITE_LOCK)
      if (currentWriteLock === 0) {
        Atomics.add(this.lock, this.READ_COUNT, 1)

        if (Atomics.load(this.lock, this.WRITE_LOCK) === 0) {
          break
        }
        Atomics.sub(this.lock, this.READ_COUNT, 1)
      }
      const { async, value } = Atomics.waitAsync(this.lock, this.WRITE_LOCK, 0)
      if (async) {
        await value
      }
    }
  }

  readUnlock() {
    Atomics.sub(this.lock, this.READ_COUNT, 1)
    // 最后一个读锁释放时唤醒可能等待的写锁
    if (Atomics.load(this.lock, this.READ_COUNT) === 0) {
      // Atomics.notify(this.lock, this.WRITE_LOCK)
    }
  }

  async writeLock() {
    while (true) {
      const currentWriteLock = Atomics.load(this.lock, this.WRITE_LOCK)
      if (currentWriteLock === 0) {
        if (Atomics.compareExchange(this.lock, this.WRITE_LOCK, 0, 1) === 0) {
          break
        }
      }
      const { async, value } = Atomics.waitAsync(
        this.lock,
        this.WRITE_LOCK,
        currentWriteLock
      )
      if (async) {
        await value
      }
    }
  }

  writeUnlock() {
    // 先清除写锁再通知
    Atomics.store(this.lock, this.WRITE_LOCK, 0)
    // 优先唤醒写等待线程，再唤醒读线程
    Atomics.notify(this.lock, this.WRITE_LOCK)
    Atomics.notify(this.lock, this.READ_COUNT)
  }
}
