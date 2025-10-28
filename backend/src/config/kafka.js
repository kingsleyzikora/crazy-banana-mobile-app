const { Kafka, logLevel } = require('kafkajs');

let kafka = null;
let producer = null;
let consumer = null;

async function initKafka() {
  try {
    kafka = new Kafka({
      clientId: 'user-registration-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      logLevel: logLevel.ERROR,
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    producer = kafka.producer();
    await producer.connect();
    console.log('Kafka producer connected');

    // Initialize consumer for processing user data
    consumer = kafka.consumer({ groupId: 'user-registration-group' });
    await consumer.connect();
    await consumer.subscribe({ topic: 'user-registration', fromBeginning: false });

    console.log('Kafka consumer connected and subscribed');

    // Start consuming messages
    await startConsumer();

    return { producer, consumer };
  } catch (error) {
    console.error('Failed to initialize Kafka:', error);
    throw error;
  }
}

async function startConsumer() {
  const { saveUserToDatabase } = require('../services/userService');

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const userData = JSON.parse(message.value.toString());
        console.log('Processing user registration from Kafka:', userData);

        // Save to PostgreSQL database
        await saveUserToDatabase(userData);
        console.log('User saved to database:', userData.email);
      } catch (error) {
        console.error('Error processing Kafka message:', error);
        // In production, you might want to send this to a dead-letter queue
      }
    },
  });
}

async function sendMessage(topic, message) {
  if (!producer) {
    throw new Error('Kafka producer not initialized');
  }

  try {
    await producer.send({
      topic,
      messages: [
        {
          value: JSON.stringify(message),
          timestamp: Date.now().toString()
        },
      ],
    });
    console.log(`Message sent to Kafka topic: ${topic}`);
  } catch (error) {
    console.error('Error sending message to Kafka:', error);
    throw error;
  }
}

async function disconnectKafka() {
  if (producer) {
    await producer.disconnect();
    console.log('Kafka producer disconnected');
  }
  if (consumer) {
    await consumer.disconnect();
    console.log('Kafka consumer disconnected');
  }
}

function getProducer() {
  if (!producer) {
    throw new Error('Kafka producer not initialized');
  }
  return producer;
}

module.exports = {
  initKafka,
  sendMessage,
  disconnectKafka,
  getProducer
};
