const Event = require('../models/Event');
const { logger } = require('../utils/logger');

/**
 * Generate recurring event instances based on the parent event's recurrence pattern
 * @param {Object} parentEvent - The parent recurring event
 * @returns {Array} - Array of event instances to be created
 */
const generateRecurringInstances = async (parentEvent) => {
  const instances = [];
  const startDate = new Date(parentEvent.startDate);
  const endDate = parentEvent.recurrenceEndDate ? new Date(parentEvent.recurrenceEndDate) : null;
  const maxOccurrences = parentEvent.recurrenceCount || 52; // Default to 52 weeks (1 year)
  
  let currentDate = new Date(startDate);
  let occurrenceCount = 0;
  
  // Calculate event duration
  const eventDuration = new Date(parentEvent.endDate) - new Date(parentEvent.startDate);
  
  while (occurrenceCount < maxOccurrences) {
    // Check if we've reached the end date
    if (endDate && currentDate > endDate) {
      break;
    }
    
    // Check if this date is in the exceptions list
    const isException = parentEvent.recurringExceptions.some(exceptionDate => 
      new Date(exceptionDate).toDateString() === currentDate.toDateString()
    );
    
    if (!isException) {
      // Create instance data
      const instanceStartDate = new Date(currentDate);
      const instanceEndDate = new Date(currentDate.getTime() + eventDuration);
      
      instances.push({
        title: parentEvent.title,
        description: parentEvent.description,
        startDate: instanceStartDate,
        endDate: instanceEndDate,
        isMultiDay: parentEvent.isMultiDay,
        reminderTime: parentEvent.reminderTime,
        category: parentEvent.category,
        location: parentEvent.location,
        targetType: parentEvent.targetType,
        targetGrade: parentEvent.targetGrade,
        targetClass: parentEvent.targetClass,
        targetGroup: parentEvent.targetGroup,
        schoolId: parentEvent.schoolId,
        createdBy: parentEvent.createdBy,
        isRecurringInstance: true,
        parentEventId: parentEvent._id,
        isRecurring: false,
        recurrencePattern: 'none'
      });
      
      occurrenceCount++;
    }
    
    // Move to next occurrence based on pattern
    currentDate = getNextOccurrence(currentDate, parentEvent);
    
    // Safety check to prevent infinite loops
    if (occurrenceCount > 1000) {
      logger.warn('Stopped recurring-event generation at the safety limit', { limit: 1000 });
      break;
    }
  }
  
  return instances;
};

/**
 * Calculate the next occurrence date based on recurrence pattern
 * @param {Date} currentDate - Current occurrence date
 * @param {Object} parentEvent - Parent event with recurrence settings
 * @returns {Date} - Next occurrence date
 */
const getNextOccurrence = (currentDate, parentEvent) => {
  const nextDate = new Date(currentDate);
  
  switch (parentEvent.recurrencePattern) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + parentEvent.recurrenceInterval);
      break;
      
    case 'weekly':
      if (parentEvent.recurrenceDays && parentEvent.recurrenceDays.length > 0) {
        // Find next day in the week that matches recurrenceDays
        nextDate.setDate(nextDate.getDate() + 1);
        while (!parentEvent.recurrenceDays.includes(nextDate.getDay())) {
          nextDate.setDate(nextDate.getDate() + 1);
        }
      } else {
        // Default to same day next week
        nextDate.setDate(nextDate.getDate() + (7 * parentEvent.recurrenceInterval));
      }
      break;
      
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
      
    case 'monthly':
      // Keep the same day of month
      nextDate.setMonth(nextDate.getMonth() + parentEvent.recurrenceInterval);
      break;
      
    case 'custom':
      // For custom patterns, use the interval as days
      nextDate.setDate(nextDate.getDate() + parentEvent.recurrenceInterval);
      break;
      
    default:
      nextDate.setDate(nextDate.getDate() + 7); // Default to weekly
  }
  
  return nextDate;
};

/**
 * Create recurring event instances in the database
 * @param {Object} parentEvent - The parent recurring event
 * @returns {Promise<Array>} - Array of created event instances
 */
const createRecurringInstances = async (parentEvent) => {
  try {
    const instances = await generateRecurringInstances(parentEvent);
    
    if (instances.length === 0) {
      logger.warn('No recurring-event instances were generated');
      return [];
    }
    
    // Create all instances in the database
    const createdInstances = await Event.insertMany(instances);
    
    logger.info('Recurring-event instances created', { count: createdInstances.length });
    
    return createdInstances;
  } catch (error) {
    logger.error('Error creating recurring instances:', error);
    throw error;
  }
};

/**
 * Update all future instances of a recurring event
 * @param {String} parentEventId - ID of the parent event
 * @param {Object} updateData - Data to update
 * @returns {Promise<Number>} - Number of instances updated
 */
const updateRecurringInstances = async (parentEventId, updateData) => {
  try {
    const now = new Date();
    
    // Update all future instances
    const result = await Event.updateMany(
      {
        parentEventId: parentEventId,
        isRecurringInstance: true,
        startDate: { $gte: now }
      },
      updateData
    );
    
    logger.info('Future recurring-event instances updated', { count: result.modifiedCount });
    
    return result.modifiedCount;
  } catch (error) {
    logger.error('Error updating recurring instances:', error);
    throw error;
  }
};

/**
 * Delete all future instances of a recurring event
 * @param {String} parentEventId - ID of the parent event
 * @returns {Promise<Number>} - Number of instances deleted
 */
const deleteRecurringInstances = async (parentEventId) => {
  try {
    const now = new Date();
    
    // Soft delete all future instances
    const result = await Event.updateMany(
      {
        parentEventId: parentEventId,
        isRecurringInstance: true,
        startDate: { $gte: now }
      },
      {
        isActive: false,
        isCancelled: true
      }
    );
    
    logger.info('Future recurring-event instances deleted', { count: result.modifiedCount });
    
    return result.modifiedCount;
  } catch (error) {
    logger.error('Error deleting recurring instances:', error);
    throw error;
  }
};

/**
 * Add exception date to recurring event and delete that instance
 * @param {String} parentEventId - ID of the parent event
 * @param {Date} exceptionDate - Date to skip
 * @returns {Promise<void>}
 */
const addRecurringException = async (parentEventId, exceptionDate) => {
  try {
    // Add exception to parent event
    await Event.findByIdAndUpdate(parentEventId, {
      $push: { recurringExceptions: exceptionDate }
    });
    
    // Delete the instance for that date
    await Event.updateOne(
      {
        parentEventId: parentEventId,
        isRecurringInstance: true,
        startDate: {
          $gte: new Date(exceptionDate.setHours(0, 0, 0, 0)),
          $lt: new Date(exceptionDate.setHours(23, 59, 59, 999))
        }
      },
      {
        isActive: false,
        isCancelled: true
      }
    );
    
    logger.info('Recurring-event exception added and matching instance deleted');
  } catch (error) {
    logger.error('Error adding recurring exception:', error);
    throw error;
  }
};

/**
 * Get all instances of a recurring event
 * @param {String} parentEventId - ID of the parent event
 * @returns {Promise<Array>} - Array of event instances
 */
const getRecurringInstances = async (parentEventId) => {
  try {
    const instances = await Event.find({
      parentEventId: parentEventId,
      isRecurringInstance: true,
      isActive: true
    }).sort({ startDate: 1 });
    
    return instances;
  } catch (error) {
    logger.error('Error getting recurring instances:', error);
    throw error;
  }
};

module.exports = {
  generateRecurringInstances,
  createRecurringInstances,
  updateRecurringInstances,
  deleteRecurringInstances,
  addRecurringException,
  getRecurringInstances,
  getNextOccurrence
};

