import { SharedData } from '../lib/main'

onmessage = async (event) => {
  const { lockBuffer, dataBuffer } = event.data
  const sharedData = new SharedData<{ counter: number }>(dataBuffer, lockBuffer)

  await sharedData.writeData((current) => {
    console.log(current.counter)
    return { ...current, counter: current.counter - 1 }
  })
  console.log(sharedData.lock)
  console.log(await sharedData.readData())

  postMessage('read')
}
