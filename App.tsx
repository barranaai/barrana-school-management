import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { DataProvider } from './src/contexts/DataContext';
import LoginScreen from './src/screens/LoginScreen';
import TeacherDashboard from './src/screens/teacher/TeacherDashboard';
import ParentDashboard from './src/screens/parent/ParentDashboard';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Teacher Tab Navigator with WhatsApp-like design
const TeacherTabNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName: keyof typeof Ionicons.glyphMap;

        if (route.name === 'Dashboard') {
          iconName = focused ? 'home' : 'home-outline';
        } else if (route.name === 'Voice Recording') {
          iconName = focused ? 'mic' : 'mic-outline';
        } else if (route.name === 'Students') {
          iconName = focused ? 'people' : 'people-outline';
        } else if (route.name === 'Reports') {
          iconName = focused ? 'document-text' : 'document-text-outline';
        } else if (route.name === 'Settings') {
          iconName = focused ? 'settings' : 'settings-outline';
        } else {
          iconName = 'help-outline';
        }

        return <Ionicons name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#25D366', // WhatsApp green
      tabBarInactiveTintColor: '#8E8E93',
      tabBarStyle: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 0.5,
        borderTopColor: '#E5E5EA',
        paddingBottom: Platform.OS === 'ios' ? 20 : 10,
        paddingTop: 10,
        height: Platform.OS === 'ios' ? 90 : 70,
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: -2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
      },
      tabBarLabelStyle: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 4,
      },
      headerShown: false,
    })}
  >
    <Tab.Screen 
      name="Dashboard" 
      component={TeacherDashboard}
      options={{
        tabBarLabel: 'Home',
      }}
    />
    <Tab.Screen 
      name="Voice Recording" 
      component={TeacherDashboard}
      options={{
        tabBarLabel: 'Record',
      }}
    />
    <Tab.Screen 
      name="Students" 
      component={TeacherDashboard}
      options={{
        tabBarLabel: 'Students',
      }}
    />
    <Tab.Screen 
      name="Reports" 
      component={TeacherDashboard}
      options={{
        tabBarLabel: 'Reports',
      }}
    />
    <Tab.Screen 
      name="Settings" 
      component={TeacherDashboard}
      options={{
        tabBarLabel: 'More',
      }}
    />
  </Tab.Navigator>
);

// Parent Tab Navigator with WhatsApp-like design
const ParentTabNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName: keyof typeof Ionicons.glyphMap;

        if (route.name === 'Dashboard') {
          iconName = focused ? 'home' : 'home-outline';
        } else if (route.name === 'Children') {
          iconName = focused ? 'people' : 'people-outline';
        } else if (route.name === 'Reports') {
          iconName = focused ? 'document-text' : 'document-text-outline';
        } else if (route.name === 'Communication') {
          iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
        } else if (route.name === 'Settings') {
          iconName = focused ? 'settings' : 'settings-outline';
        } else {
          iconName = 'help-outline';
        }

        return <Ionicons name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#25D366', // WhatsApp green
      tabBarInactiveTintColor: '#8E8E93',
      tabBarStyle: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 0.5,
        borderTopColor: '#E5E5EA',
        paddingBottom: Platform.OS === 'ios' ? 20 : 10,
        paddingTop: 10,
        height: Platform.OS === 'ios' ? 90 : 70,
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: -2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
      },
      tabBarLabelStyle: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 4,
      },
      headerShown: false,
    })}
  >
    <Tab.Screen 
      name="Dashboard" 
      component={ParentDashboard}
      options={{
        tabBarLabel: 'Home',
      }}
    />
    <Tab.Screen 
      name="Children" 
      component={ParentDashboard}
      options={{
        tabBarLabel: 'Children',
      }}
    />
    <Tab.Screen 
      name="Reports" 
      component={ParentDashboard}
      options={{
        tabBarLabel: 'Reports',
      }}
    />
    <Tab.Screen 
      name="Communication" 
      component={ParentDashboard}
      options={{
        tabBarLabel: 'Chat',
      }}
    />
    <Tab.Screen 
      name="Settings" 
      component={ParentDashboard}
      options={{
        tabBarLabel: 'More',
      }}
    />
  </Tab.Navigator>
);

// Main App Navigator
const AppNavigator = () => {
  const { user, isAuthenticated } = useAuth();

  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        cardStyle: { backgroundColor: '#F2F2F7' }, // iOS-like background
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          {user?.role === 'teacher' && (
            <Stack.Screen name="TeacherApp" component={TeacherTabNavigator} />
          )}
          {user?.role === 'parent' && (
            <Stack.Screen name="ParentApp" component={ParentTabNavigator} />
          )}
        </>
      )}
    </Stack.Navigator>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <NavigationContainer>
          <AppNavigator />
          <StatusBar style="dark" backgroundColor="#FFFFFF" />
        </NavigationContainer>
      </DataProvider>
    </AuthProvider>
  );
} 