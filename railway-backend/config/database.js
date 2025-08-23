const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

const connectDB = async () => {
  try {
    // Debug: Log environment variables
    logger.info(`🔍 Environment variables check:`);
    logger.info(`MONGODB_URI: ${process.env.MONGODB_URI ? 'SET' : 'NOT SET'}`);
    logger.info(`MONGODB_URI_PROD: ${process.env.MONGODB_URI_PROD ? 'SET' : 'NOT SET'}`);
    
    const mongoURI = process.env.MONGODB_URI || process.env.MONGODB_URI_PROD || 'mongodb://localhost:27017/barrana_ai';
    logger.info(`🔗 Using MongoDB URI: ${mongoURI.substring(0, 20)}...`);

    const conn = await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    });

    logger.info(`📊 MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
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
    logger.error('Database connection failed:', error);
    // Don't exit the process, let the server continue without database
    // The app can still serve static files and basic functionality
    logger.warn('Server will continue without database connection. Please configure MONGODB_URI environment variable.');
  }
};

module.exports = connectDB; 