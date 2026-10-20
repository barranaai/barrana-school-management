const mongoose = require('mongoose');
const { logger, safeError } = require('../utils/logger');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGODB_URI_PROD || 'mongodb://localhost:27017/barrana_ai';
    logger.info('Database connection starting', { configured: Boolean(process.env.MONGODB_URI || process.env.MONGODB_URI_PROD) });

    const conn = await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    });

    logger.info('Database connected');
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('Database connection error', safeError(err, 'DATABASE_CONNECTION_ERROR'));
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    logger.error('Database connection failed', safeError(error, 'DATABASE_CONNECTION_FAILED'));
    // Don't exit the process, let the server continue without database
    // The app can still serve static files and basic functionality
    logger.warn('Server will continue without database connection. Please configure MONGODB_URI environment variable.');
  }
};

module.exports = connectDB;
