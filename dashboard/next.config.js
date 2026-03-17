/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    KAFKA_BROKER: process.env.KAFKA_BROKER || 'localhost:9092',
    KAFKA_TOPIC: process.env.KAFKA_TOPIC || 'quickstart-events',
  },
}
module.exports = nextConfig
