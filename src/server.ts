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
  await mongoose.connect(process.env.MONGO_URI!);
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
  app.listen(port);
}

start().catch(() => {
  process.exit(1);
});