# Barrana.ai Mobile App

A React Native mobile application for the Barrana.ai school management system, allowing teachers and parents to access the platform from their mobile devices.

## Features

- **Real-time Authentication**: Connect to the backend database for secure login
- **Teacher Dashboard**: Access to student management, report creation, and analytics
- **Parent Dashboard**: View child progress, reports, and communicate with teachers
- **Secure Token Storage**: Uses Expo SecureStore for secure authentication token storage
- **Offline Support**: Caches user data for offline access
- **Cross-platform**: Works on both iOS and Android

## Prerequisites

- Node.js (v16 or higher)
- Expo CLI (`npm install -g @expo/cli`)
- Backend server running on port 5050
- MongoDB database with test users

## Setup Instructions

### 1. Install Dependencies

```bash
cd BarranaMobileApp
npm install
```

### 2. Add Test Users to Database

First, ensure your backend server is running, then add test users:

```bash
cd ../backend
node add_mobile_test_teachers.js
```

This will create test users with the following credentials:

**Teachers:**
- Email: `teacher@demo.com` / Password: `demo12345`
- Email: `michael.chen@demo.com` / Password: `demo12345`
- Email: `sarah.johnson@demo.com` / Password: `demo12345`

**Parents:**
- Email: `parent@demo.com` / Password: `demo12345`
- Email: `david.wilson@demo.com` / Password: `demo12345`

### 3. Configure API Endpoint

Update the API base URL in `apiService.ts` if needed:

```typescript
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:5050/api' 
  : 'https://your-production-domain.com/api';
```

### 4. Start the Mobile App

```bash
npm start
```

This will open the Expo development server. You can then:

- Press `i` to open in iOS simulator
- Press `a` to open in Android emulator
- Scan the QR code with Expo Go app on your physical device

## Usage

### Authentication

1. **Login**: Use the test credentials provided above
2. **Demo Login**: Use the quick demo buttons for instant access
3. **Logout**: Tap the logout button in the header

### Teacher Features

- **Create Report**: Record student progress and observations
- **Voice Recording**: Record audio observations
- **View Analytics**: Access student performance data
- **Communication**: Message parents and colleagues

### Parent Features

- **My Children**: View child profiles and information
- **Progress Reports**: Access latest academic updates
- **Activities**: View daily activities and schedules
- **Messages**: Communicate with teachers

## Development

### Project Structure

```
BarranaMobileApp/
├── App.tsx                 # Main application component
├── apiService.ts           # API communication service
├── package.json            # Dependencies and scripts
└── README.md              # This file
```

### Key Components

- **App.tsx**: Main application with authentication flow and dashboard
- **apiService.ts**: Handles all API communication with the backend
- **SecureStore**: Used for secure token and user data storage

### API Integration

The mobile app communicates with the backend through the following endpoints:

- `POST /api/auth/login` - User authentication
- `GET /api/auth/me` - Get current user data
- `POST /api/auth/logout` - User logout
- `GET /api/teachers/dashboard` - Teacher dashboard data
- `GET /api/teachers/students` - Get teacher's students
- `POST /api/reports` - Create new reports
- `GET /api/reports` - Get user's reports

### Environment Configuration

The app automatically detects development vs production environment:

- **Development**: Uses `http://localhost:5050/api`
- **Production**: Uses your production domain (update in `apiService.ts`)

## Troubleshooting

### Common Issues

1. **Connection Error**: Ensure the backend server is running on port 5050
2. **Authentication Failed**: Verify test users exist in the database
3. **CORS Error**: Check that the backend CORS configuration includes mobile app origins
4. **Token Expired**: The app automatically handles token refresh and logout

### Debug Mode

To enable debug logging, add this to your development environment:

```typescript
// In apiService.ts
console.log('API Request:', config);
console.log('API Response:', response.data);
```

## Security Features

- **Secure Token Storage**: Uses Expo SecureStore for encrypted token storage
- **Automatic Token Refresh**: Handles token expiration gracefully
- **Input Validation**: Client-side validation for all forms
- **Error Handling**: Comprehensive error handling and user feedback

## Production Deployment

1. Update the API base URL in `apiService.ts`
2. Configure production environment variables
3. Build the app using Expo's build service
4. Deploy to App Store and Google Play Store

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For technical support or questions, please contact the development team or create an issue in the repository. 