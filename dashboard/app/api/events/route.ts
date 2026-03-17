import { NextResponse } from 'next/server'
import { Kafka } from 'kafkajs'

const kafka = new Kafka({
  clientId: 'viize-dashboard',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
})

let cachedEvents: any[] = []

// Consumer singleton
const consumer = kafka.consumer({ groupId: 'dashboard-group' })
let connected = false

async function startConsumer() {
  if (connected) return
  await consumer.connect()
  await consumer.subscribe({
    topic: process.env.KAFKA_TOPIC || 'quickstart-events',
    fromBeginning: false,
  })
  await consumer.run({
    eachMessage: async ({ message }) => {
      const val = message.value?.toString()
      if (val) {
        const parsed = JSON.parse(val)
        cachedEvents.unshift({ ...parsed, ts: new Date().toISOString() })
        if (cachedEvents.length > 100) cachedEvents.pop()
      }
    },
  })
  connected = true
}

startConsumer().catch(console.error)

export async function GET() {
  return NextResponse.json({ events: cachedEvents })
}
