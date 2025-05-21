import { createSharedBuffers, SharedData } from '../lib/main'
import myWorker from './worker.ts?worker&inline'
const { lockBuffer, dataBuffer } = createSharedBuffers()
const sharedData = new SharedData<DataType>(dataBuffer, lockBuffer)

interface DataType {
  counter: number
}
// 初始化数据
await sharedData.writeData(() => ({ counter: 0 }))

const COUNT = 10
// 启动Worker

for (let i = 0; i < COUNT; i++) {
  await sharedData.writeData((current) => ({
    ...current,
    counter: current.counter + 1,
  }))
}

const arr = []
for (let i = 0; i < COUNT; i++) {
  const worker = new myWorker()
  arr.push(worker)
}

let count = 0
arr.forEach((worker) => {
  worker.postMessage({ lockBuffer, dataBuffer })
  worker.onmessage = async (event) => {
    if (event.data === 'read') {
      count++
      if (count === COUNT) {
        console.dir(await sharedData.readData())
      }
    }
  }
})
