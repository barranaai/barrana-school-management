import { registerRootComponent } from 'expo';

// VERSION 8: Adding REAL ReportsScreen (Dashboard + Students + Reports all real)
import App from './App.v5-full';
// Previous versions:
// V7 (TeacherDashboard + StudentsScreen) - WORKED ✅
// V6 (StudentsScreen only) - WORKED ✅
// Full app - crashed (too complex)
// import App from './App';
// Previous test versions (all worked):
// import App from './App.v4-branding';
// import App from './App.v3-dashboard';
// import App from './App.v2-api';
// import App from './App.v1-login';
// import App from './App.minimal';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
