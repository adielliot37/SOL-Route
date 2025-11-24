import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import 'dotenv/config';

import listings from './routes/listings.js';
import purchase from './routes/purchase.js';
import delivery from './routes/delivery.js';
import auth from './routes/auth.js';
import reviews from './routes/reviews.js';

async function start() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI!);
  console.log('✓ Connected to MongoDB');

  // Handle MongoDB connection errors
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });
  
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  app.use('/api/listings', listings);
  app.use('/api/purchase', purchase);
  app.use('/api/delivery', delivery);
  app.use('/auth', auth);
  app.use('/api/reviews', reviews);

  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => {
    console.log(`✓ Server running on port ${port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions (ignore EPIPE errors)
process.on('uncaughtException', (error: any) => {
  if (error.code === 'EPIPE') {
    // Ignore EPIPE errors (broken pipe) - these are harmless
    return;
  }
  console.error('Uncaught Exception:', error);
});
