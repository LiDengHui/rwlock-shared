export { ReadWriteLock } from './ReadWriteLock'
export { SharedData } from './SharedData'
export function createSharedBuffers(
  lockSize: number = Int32Array.BYTES_PER_ELEMENT * 3, // 3个int32 = 12字节
  dataSize: number = 1024 // 默认1KB数据空间
): { lockBuffer: SharedArrayBuffer; dataBuffer: SharedArrayBuffer } {
  return {
    lockBuffer: new SharedArrayBuffer(lockSize),
    dataBuffer: new SharedArrayBuffer(dataSize),
  }
}
