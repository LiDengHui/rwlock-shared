import { test, beforeEach, describe, vi, expect } from 'vitest'
import { createSharedBuffers, ReadWriteLock } from '../../lib/main'

describe('ReadWriteLock', () => {
  const createLock = () => {
    const { lockBuffer } = createSharedBuffers()
    return new ReadWriteLock(lockBuffer)
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  test('初始化状态正确', () => {
    const lock = createLock()
    expect(Atomics.load(lock.lock, lock.READ_COUNT)).toBe(0)
    expect(Atomics.load(lock.lock, lock.WRITE_LOCK)).toBe(0)
  })

  test('读锁计数正常增减', async () => {
    const lock = createLock()

    await lock.readLock()
    expect(Atomics.load(lock.lock, lock.READ_COUNT)).toBe(1)

    lock.readUnlock()
    expect(Atomics.load(lock.lock, lock.READ_COUNT)).toBe(0)
  })

  test('写锁具有互斥性', async () => {
    const lock = createLock()

    // 获取写锁
    const writePromise = lock.writeLock()
    await writePromise
    expect(Atomics.load(lock.lock, lock.WRITE_LOCK)).toBe(1)

    // 验证二次获取被阻塞
    let acquired = false
    lock.writeLock().then(() => (acquired = true))
    await vi.advanceTimersByTimeAsync(10)
    expect(acquired).toBe(false)

    // 释放后应能获取
    lock.writeUnlock()
    await vi.advanceTimersByTimeAsync(0)
    expect(acquired).toBe(true)
  })

  test('写锁阻塞后续读锁', async () => {
    const lock = createLock()

    await lock.writeLock()
    let readAcquired = false
    lock.readLock().then(() => (readAcquired = true))

    // 验证读锁未立即获取
    await vi.advanceTimersByTimeAsync(10)
    expect(readAcquired).toBe(false)

    // 释放写锁后应获取成功
    lock.writeUnlock()
    await vi.advanceTimersByTimeAsync(0)
    expect(readAcquired).toBe(true)
  })

  test('读锁并行且正确释放写锁', async () => {
    const lock = createLock()

    await lock.readLock()
    await lock.readLock()

    let writeAcquired = false
    lock.writeLock().then(() => (writeAcquired = true))
    await vi.advanceTimersByTimeAsync(10)
    expect(writeAcquired).toBe(false)

    // 逐步释放读锁
    lock.readUnlock()
    await vi.advanceTimersByTimeAsync(10)
    expect(writeAcquired).toBe(false)

    lock.readUnlock()
    await vi.advanceTimersByTimeAsync(0)
    expect(writeAcquired).toBe(true)
  })

  test('写锁请求优先于后续读锁', async () => {
    const lock = createLock()

    // 先请求写锁（但尚未获取）
    let writeAcquired = false
    const writePromise = lock.writeLock().then(() => (writeAcquired = true))

    // 立即请求读锁
    let readAcquired = false
    lock.readLock().then(() => (readAcquired = true))

    // 初始状态验证
    await vi.advanceTimersByTimeAsync(50)
    expect(writeAcquired).toBe(false)
    expect(readAcquired).toBe(false)

    // 释放初始可能的锁（确保测试环境干净）
    lock.writeUnlock()
    await writePromise

    // 验证写锁优先
    expect(writeAcquired).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(readAcquired).toBe(false) // 读锁仍应等待
  })
})
