import { SharedData } from '../lib/main'

onmessage = async (event) => {
  const { lockBuffer, dataBuffer } = event.data
  const sharedData = new SharedData<{ counter: number }>(dataBuffer, lockBuffer)

  await sharedData.writeData((current) => {
    console.log('write', current.counter)
    return { ...current, counter: current.counter - 1 }
  })
  console.log(await sharedData.readData(), sharedData.lock.state.toString())

  postMessage('read')
}
