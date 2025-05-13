import { ReadWriteLock } from './ReadWriteLock.ts'

type DataType = Record<string, any> | Array<any>

export class SharedData<T extends DataType> {
  public lock: ReadWriteLock
  private dataBuffer: SharedArrayBuffer
  private dataView: DataView

  constructor(dataBuffer: SharedArrayBuffer, lockBuffer: SharedArrayBuffer) {
    this.lock = new ReadWriteLock(lockBuffer)
    this.dataBuffer = dataBuffer
    this.dataView = new DataView(dataBuffer)
  }

  // 安全读取数据
  async readData() {
    await this.lock.readLock()
    const result = this.deserialize()
    this.lock.readUnlock()
    return result
  }

  // 安全写入数据
  async writeData(updater: (current: T) => T) {
    try {
      await this.lock.writeLock()
      const current = this.deserialize()
      const updated = updater(current)
      this.serialize(updated)
    } finally {
      this.lock.writeUnlock()
    }
  }

  private serialize(data: T): void {
    const json = JSON.stringify(data)
    const encoder = new TextEncoder()
    const encoded = encoder.encode(json)
    this.dataView.setUint32(0, encoded.length)
    encoded.forEach((byte, i) => this.dataView.setUint8(4 + i, byte))
  }

  private deserialize(): T {
    const length = this.dataView.getUint32(0)
    const bytes = new Uint8Array(this.dataBuffer.slice(4, length + 4))

    const nonSharedUint8Array = new Uint8Array(bytes)
    const decoder = new TextDecoder()
    if (decoder.decode(nonSharedUint8Array)) {
      return JSON.parse(decoder.decode(nonSharedUint8Array) ?? '{}')
    } else {
      return {} as T
    }
  }
}
