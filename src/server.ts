import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import 'dotenv/config';

import listings from './routes/listings';
import purchase from './routes/purchase';
import delivery from './routes/delivery';
import auth from './routes/auth';

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

  const port = Number(process.env.PORT || 4000);
  app.listen(port);
}

start().catch(() => {
  process.exit(1);
});