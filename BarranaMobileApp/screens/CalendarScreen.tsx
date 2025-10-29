import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format, isSameDay, parseISO } from 'date-fns';
import apiService from '../apiService';
import { useBranding } from '../contexts/BrandingContext';
import EventDetailModal from '../components/EventDetailModal';

const { width } = Dimensions.get('window');

interface Event {
  _id: string;
  title: string;
  description?: string;
  category?: string;
  startDate: string;
  endDate?: string;
  location?: string;
  attachments?: any[];
  targetAudience?: any;
}

const CalendarScreen: React.FC = () => {
  const { branding } = useBranding();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);

  const primaryColor = branding?.branding.primaryColor || '#667eea';
  const secondaryColor = branding?.branding.secondaryColor || '#764ba2';

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const response = await apiService.makeRequest<{ success: boolean; data: Event[] }>(
        '/parents/me/events'
      );

      if (response.success && response.data) {
        setEvents(response.data);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const getCategoryColor = (category?: string) => {
    switch (category?.toLowerCase()) {
      case 'academic':
        return '#10b981';
      case 'sports':
        return '#f59e0b';
      case 'cultural':
        return '#8b5cf6';
      case 'trip':
        return '#06b6d4';
      case 'meeting':
        return '#ef4444';
      default:
        return primaryColor;
    }
  };

  const getCategoryIcon = (category?: string): any => {
    switch (category?.toLowerCase()) {
      case 'academic':
        return 'school-outline';
      case 'sports':
        return 'trophy-outline';
      case 'cultural':
        return 'color-palette-outline';
      case 'trip':
        return 'airplane-outline';
      case 'meeting':
        return 'people-outline';
      default:
        return 'calendar-outline';
    }
  };

  // Create marked dates for calendar
  const getMarkedDates = () => {
    const marked: any = {};

    events.forEach((event) => {
      const dateKey = format(new Date(event.startDate), 'yyyy-MM-dd');
      const color = getCategoryColor(event.category);

      if (!marked[dateKey]) {
        marked[dateKey] = { dots: [], marked: true };
      }

      marked[dateKey].dots.push({
        color: color,
        selectedDotColor: color,
      });
    });

    // Highlight selected date
    marked[selectedDate] = {
      ...marked[selectedDate],
      selected: true,
      selectedColor: primaryColor,
    };

    return marked;
  };

  // Get events for selected date
  const getEventsForSelectedDate = () => {
    return events.filter((event) =>
      isSameDay(new Date(event.startDate), new Date(selectedDate))
    );
  };

  const selectedDateEvents = getEventsForSelectedDate();

  const handleEventPress = (event: Event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Loading calendar...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Calendar */}
      <View style={styles.calendarContainer}>
        <Calendar
          current={selectedDate}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markingType={'multi-dot'}
          markedDates={getMarkedDates()}
          theme={{
            backgroundColor: '#ffffff',
            calendarBackground: '#ffffff',
            textSectionTitleColor: '#b6c1cd',
            selectedDayBackgroundColor: primaryColor,
            selectedDayTextColor: '#ffffff',
            todayTextColor: primaryColor,
            dayTextColor: '#2d4150',
            textDisabledColor: '#d9e1e8',
            dotColor: primaryColor,
            selectedDotColor: '#ffffff',
            arrowColor: primaryColor,
            monthTextColor: '#333',
            textDayFontWeight: '400',
            textMonthFontWeight: '700',
            textDayHeaderFontWeight: '600',
            textDayFontSize: 15,
            textMonthFontSize: 18,
            textDayHeaderFontSize: 13,
          }}
        />
      </View>

      {/* Events List */}
      <View style={styles.eventsContainer}>
        <View style={styles.eventsHeader}>
          <Text style={styles.eventsTitle}>
            {format(new Date(selectedDate), 'MMMM dd, yyyy')}
          </Text>
          {selectedDateEvents.length > 0 && (
            <View style={[styles.eventCountBadge, { backgroundColor: primaryColor }]}>
              <Text style={styles.eventCountText}>{selectedDateEvents.length}</Text>
            </View>
          )}
        </View>

        <ScrollView
          style={styles.eventsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={primaryColor}
            />
          }
        >
          {selectedDateEvents.length > 0 ? (
            selectedDateEvents.map((event) => (
              <TouchableOpacity
                key={event._id}
                style={styles.eventCard}
                onPress={() => handleEventPress(event)}
                activeOpacity={0.7}
              >
                <View style={[styles.eventColorBar, { backgroundColor: getCategoryColor(event.category) }]} />
                
                <View style={styles.eventContent}>
                  <View style={styles.eventHeader}>
                    <View style={[styles.eventIconContainer, { backgroundColor: `${getCategoryColor(event.category)}15` }]}>
                      <Ionicons
                        name={getCategoryIcon(event.category)}
                        size={20}
                        color={getCategoryColor(event.category)}
                      />
                    </View>
                    
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {event.title}
                      </Text>
                      <View style={styles.eventMeta}>
                        <Ionicons name="time-outline" size={14} color="#999" />
                        <Text style={styles.eventTime}>
                          {format(new Date(event.startDate), 'h:mm a')}
                          {event.endDate && ` - ${format(new Date(event.endDate), 'h:mm a')}`}
                        </Text>
                      </View>
                    </View>

                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                  </View>

                  {event.location && (
                    <View style={styles.eventLocation}>
                      <Ionicons name="location-outline" size={14} color="#999" />
                      <Text style={styles.eventLocationText} numberOfLines={1}>
                        {event.location}
                      </Text>
                    </View>
                  )}

                  {event.description && (
                    <Text style={styles.eventDescription} numberOfLines={2}>
                      {event.description}
                    </Text>
                  )}

                  {event.attachments && event.attachments.length > 0 && (
                    <View style={styles.attachmentIndicator}>
                      <Ionicons name="attach" size={14} color={primaryColor} />
                      <Text style={[styles.attachmentText, { color: primaryColor }]}>
                        {event.attachments.length} attachment{event.attachments.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={80} color="#e0e0e0" />
              <Text style={styles.emptyTitle}>No Events</Text>
              <Text style={styles.emptyText}>
                There are no events scheduled for this date
              </Text>
            </View>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>
      </View>

      {/* Event Detail Modal */}
      <EventDetailModal
        visible={showEventModal}
        event={selectedEvent}
        onClose={() => setShowEventModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  calendarContainer: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  eventsContainer: {
    flex: 1,
    paddingTop: 15,
  },
  eventsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  eventsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  eventCountBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  eventCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  eventsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    flexDirection: 'row',
  },
  eventColorBar: {
    width: 4,
  },
  eventContent: {
    flex: 1,
    padding: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  eventIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventTime: {
    fontSize: 14,
    color: '#999',
    marginLeft: 6,
  },
  eventLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventLocationText: {
    fontSize: 14,
    color: '#999',
    marginLeft: 6,
    flex: 1,
  },
  eventDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 10,
  },
  attachmentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachmentText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#999',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#bbb',
    textAlign: 'center',
  },
});

export default CalendarScreen;

