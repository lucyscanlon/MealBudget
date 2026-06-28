import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import budgetRoutes from './routes/budget.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
import mealRoutes from './routes/meals.js';
import plannerRoutes from './routes/planner.js';
import barcodeRoutes from './routes/barcode.js';
import profileRoutes from './routes/profile.js';
import weightRoutes from './routes/weight.js';
import shoppingRoutes from './routes/shopping.js';
import dailyRoutes from './routes/daily.js';
import widgetRoutes from './routes/widget.js';
import customProductRoutes from './routes/customProducts.js';
import reflectionRoutes from './routes/reflection.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(join(__dirname, '../uploads')));

// Serve built client in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../../client/dist')));
}

app.use('/api/budget', budgetRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/barcode', barcodeRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/weight', weightRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/daily', dailyRoutes);
app.use('/api/widget', widgetRoutes);
app.use('/api/custom-products', customProductRoutes);
app.use('/api/reflection', reflectionRoutes);

// Client-side routing fallback in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (_req, res) => {
    res.sendFile(join(__dirname, '../../client/dist/index.html'));
  });
}

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
