# 🎓 Barrana.ai School Management System

**AI-Powered School Management System with Voice-to-Text Reporting**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/barrana-ai/school-management-system)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![React](https://img.shields.io/badge/React-18.2.0-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9.5-blue)](https://www.typescriptlang.org/)

## 🚀 Features

### ✨ Core Features
- **AI-Powered Voice Transcription** - Convert teacher voice notes to text using OpenAI Whisper
- **Intelligent Report Generation** - Generate comprehensive student reports using GPT-4
- **Multi-Language Support** - 5 languages (English, Spanish, French, Arabic, Chinese)
- **Real-time Data Export** - CSV export with actual file generation
- **Bulk Data Import** - CSV import with preview and validation
- **Role-Based Access Control** - Admin, Teacher, Parent, and Super Admin dashboards

### 🎯 User Interfaces
- **Admin Dashboard** - Comprehensive school management with analytics
- **Teacher Dashboard** - Voice recording and AI report generation
- **Parent Dashboard** - View child progress and reports
- **Super Admin Dashboard** - Multi-tenant platform management

### 🤖 AI Integration
- **Voice-to-Text** - Real-time transcription of teacher observations
- **Report Generation** - AI-powered comprehensive student reports
- **Smart Analytics** - Predictive insights and trend analysis
- **Multi-language Reports** - Automatic translation of reports

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern React with hooks and context
- **TypeScript** - Type-safe development
- **Material-UI v5** - Beautiful, responsive UI components
- **React Router v6** - Client-side routing
- **React Hot Toast** - User notifications
- **WebRTC** - Voice recording capabilities

### Backend Services
- **Node.js** - Server-side JavaScript
- **MongoDB** - NoSQL database
- **Redis** - Caching and session management
- **OpenAI API** - AI transcription and report generation
- **Email Service** - Automated email notifications

### DevOps
- **Docker** - Containerization
- **Nginx** - Reverse proxy and static file serving
- **Prometheus** - Monitoring and metrics
- **Grafana** - Data visualization

## 📦 Installation

### Prerequisites
- Node.js 16+ 
- npm 8+
- Docker & Docker Compose (for production)
- MongoDB (for production)
- OpenAI API Key

### Development Setup

1. **Clone the repository**
```bash
git clone https://github.com/barrana-ai/school-management-system.git
cd school-management-system
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Configuration**
```bash
cp .env.example .env
```

Edit `.env` file with your configuration:
```env
# OpenAI Configuration
REACT_APP_OPENAI_API_KEY=your_openai_api_key

# Database Configuration
REACT_APP_MONGODB_URI=mongodb://localhost:27017/barrana_school

# Email Configuration
REACT_APP_EMAIL_HOST=smtp.gmail.com
REACT_APP_EMAIL_PORT=587
REACT_APP_EMAIL_USER=your_email@gmail.com
REACT_APP_EMAIL_PASS=your_email_password

# JWT Configuration
REACT_APP_JWT_SECRET=your_super_secret_jwt_key
```

4. **Start development server**
```bash
npm start
```

The application will be available at `http://localhost:3000`

### Production Deployment

#### Option 1: Docker Deployment (Recommended)

1. **Build and run with Docker Compose**
```bash
docker-compose up -d
```

2. **Access the application**
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`
- Grafana Dashboard: `http://localhost:3001`

#### Option 2: Manual Deployment

1. **Build the application**
```bash
npm run build:production
```

2. **Deploy to your server**
```bash
npm run deploy:production
```

## 🔐 Authentication

### Demo Users

| Role | Email | Password | Access |
|------|-------|----------|---------|
| School Admin | admin@school.com | admin123 | Full school management |
| Teacher | teacher@school.com | teacher123 | Voice recording, reports |
| Parent | parent@email.com | parent123 | View child progress |
| Super Admin | super@barrana.ai | super123 | Platform management |

## 📊 Features Overview

### 🎤 Voice Recording & AI Transcription
- **Real-time Recording** - Teachers can record voice notes for students
- **AI Transcription** - Automatic conversion to text using OpenAI Whisper
- **Multi-language Support** - Transcription in 5 languages
- **Quality Control** - Teachers can review and edit transcriptions

### 📝 AI Report Generation
- **Comprehensive Reports** - AI-generated reports with academic and social insights
- **Customizable Templates** - School-specific report formats
- **Multi-language Reports** - Automatic translation for parents
- **Progress Tracking** - Historical report comparison

### 📈 Advanced Analytics
- **Student Performance** - Individual and class-level analytics
- **Teacher Efficiency** - Performance metrics and insights
- **Predictive Analytics** - AI-powered trend predictions
- **Engagement Tracking** - Parent and teacher engagement metrics

### 🌍 Multi-language Support
- **UI Translation** - Complete interface in 5 languages
- **Report Translation** - Automatic report translation
- **Voice Recognition** - Multi-language voice transcription
- **Email Templates** - Localized email communications

## 🔧 Configuration

### AI Service Configuration
```typescript
// Initialize AI service
import aiService from './services/aiService';

aiService.initialize('your_openai_api_key');

// Test connection
const test = await aiService.testConnection();
```

### Database Configuration
```typescript
// Initialize database
import databaseService from './services/databaseService';

await databaseService.initialize({
  uri: 'mongodb://localhost:27017/barrana_school',
  database: 'barrana_school'
});
```

### Email Service Configuration
```typescript
// Initialize email service
import emailService from './services/emailService';

emailService.initialize({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your_email@gmail.com',
    pass: 'your_email_password'
  },
  from: 'noreply@barrana.ai'
});
```

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── admin/          # Admin dashboard components
│   ├── teachers/       # Teacher dashboard components
│   ├── parents/        # Parent dashboard components
│   ├── super-admin/    # Super admin components
│   └── common/         # Shared components
├── contexts/           # React contexts
│   ├── AuthContext.tsx # Authentication context
│   ├── DataContext.tsx # Data management context
│   └── LanguageContext.tsx # Multi-language context
├── services/           # Service layer
│   ├── aiService.ts    # AI integration service
│   ├── databaseService.ts # Database operations
│   └── emailService.ts # Email service
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

## 🚀 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Students
- `GET /api/students` - Get all students
- `POST /api/students` - Create student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

### Reports
- `GET /api/reports` - Get all reports
- `POST /api/reports` - Create report
- `POST /api/reports/transcribe` - Transcribe voice
- `POST /api/reports/generate` - Generate AI report

## 🔍 Monitoring & Analytics

### Prometheus Metrics
- Application performance metrics
- API response times
- Error rates and success rates
- User activity metrics

### Grafana Dashboards
- Real-time system monitoring
- User engagement analytics
- AI service performance
- Database performance metrics

## 🛡️ Security Features

- **JWT Authentication** - Secure token-based authentication
- **Role-Based Access Control** - Granular permissions
- **Input Validation** - Comprehensive data validation
- **XSS Protection** - Cross-site scripting protection
- **CSRF Protection** - Cross-site request forgery protection
- **Rate Limiting** - API rate limiting
- **Data Encryption** - Sensitive data encryption

## 🧪 Testing

### Run Tests
```bash
# Unit tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint

# Build test
npm run build
```

### Test Coverage
- Unit tests for all components
- Integration tests for services
- End-to-end tests for critical flows
- Performance testing

## 📈 Performance Optimization

- **Code Splitting** - Lazy loading of components
- **Bundle Optimization** - Optimized webpack configuration
- **Caching** - Redis caching for API responses
- **CDN** - Static asset delivery
- **Gzip Compression** - Compressed responses
- **Image Optimization** - Optimized images and icons

## 🌐 Deployment Options

### Cloud Platforms
- **AWS** - EC2, ECS, or Lambda deployment
- **Google Cloud** - GKE or Cloud Run
- **Azure** - AKS or App Service
- **Vercel** - Frontend deployment
- **Netlify** - Static site hosting

### Self-Hosted
- **Docker** - Containerized deployment
- **Kubernetes** - Orchestrated deployment
- **Traditional VPS** - Manual server setup

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs.barrana.ai](https://docs.barrana.ai)
- **Email**: support@barrana.ai
- **Discord**: [Barrana.ai Community](https://discord.gg/barrana)
- **GitHub Issues**: [Report a bug](https://github.com/barrana-ai/school-management-system/issues)

## 🙏 Acknowledgments

- OpenAI for AI services
- Material-UI for the beautiful component library
- React team for the amazing framework
- All contributors and beta testers

---

**Made with ❤️ by the Barrana.ai Team**

*Transforming Education with AI* 