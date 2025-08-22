const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const config = require('../production-config');
const multer = require('multer');

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

// Production server with advanced features
class ProductionServer {
  constructor() {
    this.port = config.server.port;
    this.host = config.server.host;
    this.environment = config.server.environment;
    this.startTime = new Date();
    this.requestCount = 0;
    this.errorCount = 0;
    this.activeConnections = 0;
    
    // Initialize server
    this.server = http.createServer(this.handleRequest.bind(this));
    this.setupServer();
  }

  setupServer() {
    // Handle server events
    this.server.on('connection', (socket) => {
      this.activeConnections++;
      socket.on('close', () => {
        this.activeConnections--;
      });
    });

    this.server.on('error', (error) => {
      console.error('Server error:', error);
      this.errorCount++;
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
  }

  async handleRequest(req, res) {
    this.requestCount++;
    
    // Set CORS headers
    this.setCORSHeaders(res);
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;

    try {
      // Log request
      this.logRequest(req, res);

      // Route handling
      await this.routeRequest(req, res, path, method, parsedUrl);
      
    } catch (error) {
      console.error('Request error:', error);
      this.errorCount++;
      this.sendErrorResponse(res, 500, 'Internal Server Error');
    }
  }

  setCORSHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', config.server.cors.origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  async routeRequest(req, res, path, method, parsedUrl) {
    // Health check
    if (path === '/api/health' && method === 'GET') {
      return this.handleHealthCheck(req, res);
    }

    // API routes
    if (path.startsWith('/api/')) {
      return this.handleAPIRoute(req, res, path, method, parsedUrl);
    }

    // Static files (for production build)
    if (method === 'GET' && !path.startsWith('/api/')) {
      return this.serveStaticFiles(req, res, path);
    }

    // 404 handler
    return this.sendErrorResponse(res, 404, 'Route not found');
  }

  async handleHealthCheck(req, res) {
    const healthData = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.environment,
      version: '1.0.0',
      startTime: this.startTime.toISOString(),
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      activeConnections: this.activeConnections,
      memory: process.memoryUsage(),
      features: config.features
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(healthData));
  }

  async handleAPIRoute(req, res, path, method, parsedUrl) {
    const body = await this.parseBody(req);

    // Auth routes
    if (path === '/api/auth/login' && method === 'POST') {
      return this.handleLogin(req, res, body);
    }

    if (path === '/api/auth/register' && method === 'POST') {
      return this.handleRegister(req, res, body);
    }

    if (path === '/api/auth/me' && method === 'GET') {
      return this.handleGetCurrentUser(req, res);
    }

    // Data routes
    if (path === '/api/students' && method === 'GET') {
      return this.handleGetStudents(req, res);
    }

    if (path === '/api/teachers' && method === 'GET') {
      return this.handleGetTeachers(req, res);
    }

    if (path === '/api/schools' && method === 'GET') {
      return this.handleGetSchools(req, res);
    }

    // AI routes
    if (path === '/api/ai/generate-report' && method === 'POST') {
      return this.handleGenerateReport(req, res, body);
    }

    if (path === '/api/ai/process-voice' && method === 'POST') {
      return this.handleProcessVoiceWithUpload(req, res);
    }

    if (path === '/api/ai/upload-audio' && method === 'POST') {
      return this.handleUploadAudioWithUpload(req, res);
    }

    if (path === '/api/ai/insights' && method === 'GET') {
      return this.handleGetInsights(req, res);
    }

    // Report Templates routes
    if (path === '/api/report-templates' && method === 'GET') {
      return this.handleGetReportTemplates(req, res);
    }

    // Reports routes
    if (path === '/api/reports' && method === 'POST') {
      return this.handleCreateReport(req, res, body);
    }

    if (path.match(/^\/api\/reports\/[^\/]+\/approve$/) && method === 'PUT') {
      const reportId = path.split('/')[3];
      return this.handleApproveReport(req, res, reportId, body);
    }

    if (path.match(/^\/api\/reports\/[^\/]+\/send$/) && method === 'POST') {
      const reportId = path.split('/')[3];
      return this.handleSendReport(req, res, reportId, body);
    }

    // Analytics routes
    if (path === '/api/analytics/dashboard' && method === 'GET') {
      return this.handleGetAnalytics(req, res);
    }

    if (path === '/api/analytics/performance' && method === 'GET') {
      return this.handleGetPerformance(req, res);
    }

    if (path === '/api/analytics/predictive' && method === 'GET') {
      return this.handleGetPredictive(req, res);
    }

    // Communication routes
    if (path === '/api/communication/messages' && method === 'GET') {
      return this.handleGetMessages(req, res);
    }

    if (path === '/api/communication/notifications' && method === 'GET') {
      return this.handleGetNotifications(req, res);
    }

    // Static file serving for uploaded audio files
    if (path.startsWith('/uploads/audio/') && method === 'GET') {
      return this.serveAudioFile(req, res, path);
    }

    // Real-time routes
    if (path === '/api/realtime/status' && method === 'GET') {
      return this.handleGetRealtimeStatus(req, res);
    }

    if (path === '/api/realtime/updates' && method === 'GET') {
      return this.handleGetRealtimeUpdates(req, res);
    }

    // 404 for API routes
    return this.sendErrorResponse(res, 404, 'API endpoint not found');
  }

  async parseBody(req) {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({});
        }
      });
    });
  }

  // Mock data handlers
  handleLogin(req, res, body) {
    const { email, password } = body;
    const users = this.getMockUsers();
    const user = users.find(u => u.email === email);

    if (user && password === 'password') {
      const response = {
        success: true,
        message: 'Login successful',
        data: {
          user,
          token: 'mock-jwt-token-for-production'
        }
      };
      this.sendJSONResponse(res, 200, response);
    } else {
      this.sendErrorResponse(res, 401, 'Invalid credentials');
    }
  }

  handleRegister(req, res, body) {
    const { firstName, lastName, email, password, role } = body;
    const newUser = {
      id: Date.now().toString(),
      firstName,
      lastName,
      email,
      role,
      schoolId: 'school1',
      isEmailVerified: false
    };

    const response = {
      success: true,
      message: 'User registered successfully',
      data: {
        user: newUser,
        token: 'mock-jwt-token-for-production'
      }
    };
    this.sendJSONResponse(res, 201, response);
  }

  handleGetCurrentUser(req, res) {
    const users = this.getMockUsers();
    const user = users[0]; // Return admin user
    this.sendJSONResponse(res, 200, { success: true, data: user });
  }

  handleGetStudents(req, res) {
    const students = this.getMockStudents();
    this.sendJSONResponse(res, 200, { success: true, data: students });
  }

  handleGetTeachers(req, res) {
    const teachers = this.getMockTeachers();
    this.sendJSONResponse(res, 200, { success: true, data: teachers });
  }

  handleGetSchools(req, res) {
    const schools = this.getMockSchools();
    this.sendJSONResponse(res, 200, { success: true, data: schools });
  }

  async handleGenerateReport(req, res, body) {
    try {
      console.log('🤖 AI Report Generation Request:', body);
      
      const { transcription, studentName, grade, template, templateId, timestamp } = body;
      
      if (!transcription || !studentName) {
        return this.sendErrorResponse(res, 400, 'Missing required fields: transcription and studentName');
      }
      
      // Try to fetch the template from database if templateId is provided
      let templateData = null;
      if (templateId) {
        try {
          const ReportTemplate = require('./models/ReportTemplate');
          templateData = await ReportTemplate.findById(templateId);
          console.log('🔍 Found template:', templateData ? templateData.name : 'Not found');
          console.log('🔍 Template has AI prompt:', !!templateData?.aiPrompt);
        } catch (error) {
          console.error('Error fetching template:', error);
          // Continue with static template if database fetch fails
        }
      }
      
      // Generate a properly formatted report based on the transcription
      const reportContent = await this.generateStructuredReport(transcription, studentName, grade, template, templateData);

      this.sendJSONResponse(res, 200, {
        success: true,
        message: 'Report generated successfully',
        data: reportContent
      });
    } catch (error) {
      console.error('Error generating report:', error);
      this.sendErrorResponse(res, 500, 'Failed to generate report');
    }
  }

  async generateStructuredReport(transcription, studentName, grade, template, templateData) {
    // Check if we have a template with content or AI prompt for intelligent generation
    if (templateData && (templateData.content || templateData.aiPrompt)) {
      console.log('🤖 Using intelligent template-based report generation');
      return await this.generateReportWithCustomPrompt(transcription, studentName, grade, templateData);
    }
    
    console.log('🤖 Using default static template for report generation');
    // Fall back to the original static template
    const report = `
# Student Progress Report

**Student Name:** ${studentName}  
**Grade:** ${grade}  
**Report Type:** ${template}  
**Date:** ${new Date().toLocaleDateString()}

## Academic Performance Summary

${studentName} has shown **Good** overall academic progress this period. Here's a breakdown by subject:

- **Mathematics:** Developing - Shows potential with continued practice
- **Reading:** Good - Demonstrates solid comprehension skills
- **Science:** Excellent - Shows strong analytical thinking
- **Social Studies:** Good - Engages well with historical concepts

## Social-Emotional Development

**Peer Interactions:** Good - Works well with classmates and participates in group activities  
**Communication:** Excellent - Expresses ideas clearly and listens to others  
**Leadership:** Developing - Beginning to take initiative in group settings

## Key Strengths

- Strong problem-solving skills
- Excellent communication abilities
- Active participation in class discussions
- Positive attitude toward learning

## Areas for Growth

- Continue practicing multiplication tables
- Work on reading comprehension strategies
- Develop more confidence in leadership roles

## Teacher Observations

${transcription}

## Recommendations

1. **Daily Reading:** Read for 20 minutes daily to strengthen literacy skills
2. **Math Practice:** Practice math problems at home to build confidence
3. **Group Activities:** Participate in group activities to develop social skills
4. **Parent Support:** Encourage regular homework completion and study habits

## Overall Assessment

Based on recent observations, ${studentName} has shown positive progress in their academic and social development. The student demonstrates strong engagement in learning activities and continues to develop important skills. With continued support and practice, ${studentName} is well-positioned for continued growth and success.

---

*This report was generated using AI assistance based on teacher observations and student performance data.*
  `;
    
    return report.trim();
  }

  async generateReportWithCustomPrompt(transcription, studentName, grade, templateData) {
    console.log('🧠 Starting intelligent template-based report generation');
    
    // Check if we have structured template content or just a simple AI prompt
    if (templateData.content && templateData.content.trim()) {
      console.log('📋 Using structured template content for intelligent mapping');
      return await this.generateIntelligentStructuredReport(transcription, studentName, grade, templateData);
    }
    
    // Fallback to simple prompt replacement if no structured content
    console.log('📝 Fallback to simple prompt replacement');
    return this.generateSimplePromptReport(transcription, studentName, grade, templateData);
  }

  async generateIntelligentStructuredReport(transcription, studentName, grade, templateData) {
    try {
      // Parse the template structure to extract categories and subcategories
      const templateStructure = this.parseTemplateStructure(templateData.content);
      console.log('🔍 Parsed template structure:', templateStructure.length, 'sections found');
      
      // Use AI to analyze transcription and map to template sections
      const mappedContent = await this.analyzeTranscriptionWithAI(transcription, templateStructure, studentName, grade);
      
      // Generate the final report with intelligent content
      const report = this.formatIntelligentReport(mappedContent, studentName, grade, templateData);
      
      return report;
    } catch (error) {
      console.error('❌ Error in intelligent report generation:', error);
      // Fallback to simple approach if AI analysis fails
      return this.generateSimplePromptReport(transcription, studentName, grade, templateData);
    }
  }

  parseTemplateStructure(templateContent) {
    console.log('🔧 Parsing template structure...');
    const sections = [];
    const lines = templateContent.split('\n');
    
    let currentSection = null;
    let currentSubsection = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Detect main sections (usually ending with colon and no indentation)
      if (line.endsWith(':') && !line.startsWith(' ') && !line.startsWith('\t')) {
        // Save previous section if exists
        if (currentSection) {
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          title: line.replace(':', '').trim(),
          subsections: [],
          type: 'section'
        };
        currentSubsection = null;
      }
      // Detect subsections (usually have specific format like "Feeding: Write the details...")
      else if (line.includes(':') && line.toLowerCase().includes('write the details')) {
        const colonIndex = line.indexOf(':');
        const subsectionTitle = line.substring(0, colonIndex).trim();
        const description = line.substring(colonIndex + 1).trim();
        
        if (currentSection) {
          currentSection.subsections.push({
            title: subsectionTitle,
            description: description,
            type: 'subsection',
            content: null // Will be filled by AI
          });
        }
      }
      // Handle multi-line descriptions that start with "Write the details about"
      else if (line.toLowerCase().startsWith('write the details about')) {
        if (currentSection && currentSection.subsections.length === 0) {
          // This is a section-level description
          currentSection.description = line;
          currentSection.subsections.push({
            title: currentSection.title,
            description: line,
            type: 'subsection',
            content: null
          });
        }
      }
    }
    
    // Add the last section
    if (currentSection) {
      sections.push(currentSection);
    }
    
    console.log('✅ Template parsing complete. Found sections:', sections.map(s => s.title));
    return sections;
  }

  async analyzeTranscriptionWithAI(transcription, templateStructure, studentName, grade) {
    console.log('🤖 Analyzing transcription with AI for intelligent mapping...');
    
    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️ OpenAI not configured, using pattern matching fallback');
      return this.analyzeTranscriptionWithPatterns(transcription, templateStructure);
    }
    
    try {
      // Import OpenAI dynamically
      const OpenAI = require('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Create a structured prompt for AI analysis
      const systemPrompt = `You are an educational report assistant. Your task is to analyze teacher observations and map them to specific template sections.

Given a teacher's transcription about a student, you need to:
1. Identify which observations relate to which template sections
2. Generate appropriate content for each relevant section
3. Return ONLY observations that are actually mentioned in the transcription
4. Use professional, educational language
5. Be specific and evidence-based

Return your response as a JSON object with this structure:
{
  "mappedSections": [
    {
      "sectionTitle": "Section Name",
      "subsectionTitle": "Subsection Name",
      "content": "Generated content based on transcription",
      "evidence": "Specific quote or reference from transcription"
    }
  ]
}`;
      
      const userPrompt = `Student: ${studentName} (${grade})

Teacher Transcription:
"${transcription}"

Template Structure:
${JSON.stringify(templateStructure, null, 2)}

Analyze the transcription and map observations to relevant template sections. Only include sections where you found actual evidence in the transcription.`;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });
      
      const response = completion.choices[0].message.content;
      console.log('🔍 AI Analysis Response:', response);
      
      // Parse the JSON response
      const aiAnalysis = JSON.parse(response);
      return aiAnalysis.mappedSections || [];
      
    } catch (error) {
      console.error('❌ AI analysis failed:', error);
      // Fallback to pattern matching
      return this.analyzeTranscriptionWithPatterns(transcription, templateStructure);
    }
  }

  analyzeTranscriptionWithPatterns(transcription, templateStructure) {
    console.log('🔍 Using dynamic pattern matching for analysis...');
    const mappedSections = [];
    const transcriptionLower = transcription.toLowerCase();
    const sentences = transcription.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    
    // Generate dynamic keyword patterns from the template structure
    const dynamicKeywordPatterns = this.generateDynamicKeywords(templateStructure);
    console.log('🔍 Generated dynamic keywords:', Object.keys(dynamicKeywordPatterns));
    
    // Add some common educational keywords as fallback
    const commonKeywords = {
      'understand': ['understand', 'understands', 'comprehend', 'grasp', 'learn', 'learned'],
      'demonstrate': ['demonstrate', 'demonstrates', 'show', 'shows', 'display', 'displays'],
      'participate': ['participate', 'participates', 'engage', 'engages', 'involve', 'involves'],
      'improve': ['improve', 'improves', 'progress', 'advance', 'develop', 'develops'],
      'complete': ['complete', 'completes', 'finish', 'finishes', 'accomplish', 'accomplishes'],
      'help': ['help', 'helps', 'assist', 'assists', 'support', 'supports'],
      'ask': ['ask', 'asks', 'request', 'requests', 'inquire', 'inquires'],
      'use': ['use', 'uses', 'utilize', 'utilizes', 'apply', 'applies']
    };
    
    // Merge dynamic and common keywords
    const keywordPatterns = { ...dynamicKeywordPatterns, ...commonKeywords };
    
    // Map transcription to sections based on keywords and extract relevant sentences
    templateStructure.forEach(section => {
      section.subsections.forEach(subsection => {
        const sectionKey = subsection.title.toLowerCase();
        let relevantContent = [];
        let hasMatch = false;
        
        // Check if any keywords match
        for (const [category, keywords] of Object.entries(keywordPatterns)) {
          // Check if section title contains category or if transcription contains relevant keywords
          if (sectionKey.includes(category)) {
            // Find sentences that contain keywords from this category
            sentences.forEach(sentence => {
              if (keywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
                relevantContent.push(sentence.trim());
                hasMatch = true;
              }
            });
          }
          
          // Also check for general keyword matches in transcription
          if (!hasMatch && keywords.some(keyword => transcriptionLower.includes(keyword))) {
            // Find the specific sentences with the keywords
            sentences.forEach(sentence => {
              if (keywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
                relevantContent.push(sentence.trim());
                hasMatch = true;
              }
            });
          }
          
          if (hasMatch) break; // Only match to one category per subsection
        }
        
        // Add to mapped sections if we found relevant content
        if (hasMatch && relevantContent.length > 0) {
          // Remove duplicates and create intelligent content
          const uniqueContent = [...new Set(relevantContent)];
          const intelligentContent = this.generateIntelligentContent(subsection.title, uniqueContent, transcription);
          
          mappedSections.push({
            sectionTitle: section.title,
            subsectionTitle: subsection.title,
            content: intelligentContent,
            evidence: uniqueContent.join(' ')
          });
        }
      });
    });
    
    console.log('✅ Pattern matching complete. Mapped', mappedSections.length, 'sections');
    return mappedSections;
  }

  generateDynamicKeywords(templateStructure) {
    console.log('🔧 Generating dynamic keywords from template structure...');
    const dynamicKeywords = {};
    
    templateStructure.forEach(section => {
      section.subsections.forEach(subsection => {
        const sectionKey = subsection.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        // Extract keywords from the subsection description
        const description = subsection.description || '';
        const keywords = this.extractKeywordsFromDescription(description, subsection.title);
        
        if (keywords.length > 0) {
          dynamicKeywords[sectionKey] = keywords;
          console.log(`🔍 Keywords for ${subsection.title}:`, keywords);
        }
      });
    });
    
    return dynamicKeywords;
  }

  extractKeywordsFromDescription(description, subsectionTitle) {
    const keywords = new Set();
    
    // Extract from "Write the details about..." patterns
    const detailMatches = description.match(/Write the details about,? ([^.]+)/gi);
    if (detailMatches) {
      detailMatches.forEach(match => {
        const content = match.replace(/Write the details about,?/gi, '').trim();
        const words = content.toLowerCase()
          .split(/[,.\s]+/)
          .filter(word => word.length > 3 && !this.isCommonWord(word));
        
        words.forEach(word => keywords.add(word));
      });
    }
    
    // Extract from subsection title
    const titleWords = subsectionTitle.toLowerCase()
      .split(/[\s\-_]+/)
      .filter(word => word.length > 2 && !this.isCommonWord(word));
    
    titleWords.forEach(word => keywords.add(word));
    
    // Add common variations and synonyms
    const variations = this.generateWordVariations(Array.from(keywords));
    variations.forEach(variation => keywords.add(variation));
    
    return Array.from(keywords);
  }

  isCommonWord(word) {
    const commonWords = [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
      'write', 'details', 'about', 'the', 'and', 'or', 'with', 'for', 'during', 'through'
    ];
    return commonWords.includes(word.toLowerCase());
  }

  generateWordVariations(words) {
    const variations = [];
    
    words.forEach(word => {
      // Add past tense variations
      if (word.endsWith('e')) {
        variations.push(word + 'd'); // like -> liked
      } else if (word.endsWith('y')) {
        variations.push(word.slice(0, -1) + 'ied'); // try -> tried
      } else {
        variations.push(word + 'ed'); // walk -> walked
      }
      
      // Add -ing variations
      if (word.endsWith('e')) {
        variations.push(word.slice(0, -1) + 'ing'); // like -> liking
      } else {
        variations.push(word + 'ing'); // walk -> walking
      }
      
      // Add -s variations (plural/third person)
      if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch') || word.endsWith('x') || word.endsWith('z')) {
        variations.push(word + 'es'); // watch -> watches
      } else {
        variations.push(word + 's'); // walk -> walks
      }
    });
    
    return variations;
  }

  generateIntelligentContent(subsectionTitle, relevantSentences, fullTranscription) {
    // Generate more intelligent content based on the subsection and relevant sentences
    const title = subsectionTitle.toLowerCase();
    
    // Use dynamic content generation based on the subsection title
    if (title.includes('feeding') || title.includes('eat') || title.includes('food')) {
      return `Demonstrates self-feeding skills: ${relevantSentences.join(' ')}`;
    } else if (title.includes('sleep') || title.includes('rest') || title.includes('nap')) {
      return `Sleep patterns observed: ${relevantSentences.join(' ')}`;
    } else if (title.includes('movement') || title.includes('walk') || title.includes('run') || title.includes('motor')) {
      return `Physical development noted: ${relevantSentences.join(' ')}`;
    } else if (title.includes('language') || title.includes('communication') || title.includes('speak') || title.includes('talk')) {
      return `Language development observed: ${relevantSentences.join(' ')}`;
    } else if (title.includes('social') || title.includes('emotional') || title.includes('friend') || title.includes('play')) {
      return `Social-emotional development: ${relevantSentences.join(' ')}`;
    } else if (title.includes('concentration') || title.includes('work') || title.includes('focus') || title.includes('attention')) {
      return `Focus and engagement: ${relevantSentences.join(' ')}`;
    } else if (title.includes('sensorial') || title.includes('sensory') || title.includes('touch') || title.includes('feel')) {
      return `Sensory exploration: ${relevantSentences.join(' ')}`;
    } else if (title.includes('math') || title.includes('addition') || title.includes('subtraction') || title.includes('counting')) {
      return `Mathematical skills demonstrated: ${relevantSentences.join(' ')}`;
    } else if (title.includes('reading') || title.includes('comprehension') || title.includes('literacy')) {
      return `Reading and literacy development: ${relevantSentences.join(' ')}`;
    } else if (title.includes('science') || title.includes('experiment') || title.includes('observation')) {
      return `Scientific exploration and learning: ${relevantSentences.join(' ')}`;
    } else {
      return `Observations: ${relevantSentences.join(' ')}`;
    }
  }

  formatIntelligentReport(mappedContent, studentName, grade, templateData) {
    console.log('📝 Formatting intelligent report...');
    
    let report = `# Student Progress Report\n\n`;
    report += `**Student Name:** ${studentName}\n`;
    report += `**Grade:** ${grade}\n`;
    report += `**Template:** ${templateData.name}\n`;
    report += `**Date:** ${new Date().toLocaleDateString()}\n\n`;
    
    // Parse original template structure
    const templateStructure = this.parseTemplateStructure(templateData.content);
    
    // Create a map of filled content
    const contentMap = new Map();
    mappedContent.forEach(item => {
      const key = `${item.sectionTitle}:${item.subsectionTitle}`;
      contentMap.set(key, item);
    });
    
    // Generate report following template structure
    templateStructure.forEach(section => {
      report += `## ${section.title}\n\n`;
      
      if (section.subsections.length === 0) {
        // Section without subsections
        const key = `${section.title}:${section.title}`;
        const content = contentMap.get(key);
        
        if (content) {
          report += `${content.content}\n\n`;
        } else {
          report += `*No specific observations recorded for this area.*\n\n`;
        }
      } else {
        // Section with subsections
        section.subsections.forEach(subsection => {
          const key = `${section.title}:${subsection.title}`;
          const content = contentMap.get(key);
          
          report += `**${subsection.title}:** `;
          
          if (content) {
            report += `${content.content}\n\n`;
          } else {
            report += `*No specific observations recorded.*\n\n`;
          }
        });
      }
    });
    
    report += `---\n\n`;
    report += `*This report was generated using intelligent AI analysis of teacher observations.*\n`;
    report += `*Template: ${templateData.name}*\n`;
    
    return report.trim();
  }

  generateSimplePromptReport(transcription, studentName, grade, templateData) {
    // Fallback to original simple prompt replacement
    let customPrompt = templateData.aiPrompt || '';
    
    // Replace common template variables
    customPrompt = customPrompt.replace(/\{studentName\}/g, studentName);
    customPrompt = customPrompt.replace(/\{grade\}/g, grade);
    customPrompt = customPrompt.replace(/\{transcription\}/g, transcription);
    customPrompt = customPrompt.replace(/\{date\}/g, new Date().toLocaleDateString());
    customPrompt = customPrompt.replace(/\{templateName\}/g, templateData.name);
    
    const report = `
# Student Progress Report (Custom AI Generated)

**Student Name:** ${studentName}  
**Grade:** ${grade}  
**Template:** ${templateData.name}  
**Date:** ${new Date().toLocaleDateString()}

## AI-Generated Content

${customPrompt}

---

*This report was generated using a custom AI prompt: "${templateData.name}"*
*Original teacher observations: ${transcription}*
  `;
    
    return report.trim();
  }

  async handleProcessVoiceWithUpload(req, res) {
    // Use multer to handle file upload
    upload.single('audio')(req, res, async (err) => {
      if (err) {
        console.error('Multer error:', err);
        return this.sendErrorResponse(res, 400, err.message);
      }
      
      // Call the original handleProcessVoice method
      await this.handleProcessVoice(req, res);
    });
  }

  async handleUploadAudioWithUpload(req, res) {
    // Use multer to handle file upload
    upload.single('audio')(req, res, async (err) => {
      if (err) {
        console.error('Multer error:', err);
        return this.sendErrorResponse(res, 400, err.message);
      }
      
      // Call the handleUploadAudio method
      await this.handleUploadAudio(req, res);
    });
  }

  async handleProcessVoice(req, res) {
    try {
      console.log('🎤 Voice Processing Request');
      
      if (!req.file) {
        return this.sendErrorResponse(res, 400, 'No audio file provided');
      }

      if (!process.env.OPENAI_API_KEY) {
        console.error('OpenAI API key not configured');
        return this.sendErrorResponse(res, 500, 'Transcription service not configured');
      }

      const { studentName, language = 'en' } = req.body;
      const audioFilePath = req.file.path;
      
      console.log('📁 Processing audio file:', audioFilePath);
      console.log('👤 Student name:', studentName);
      console.log('🌐 Language:', language);

      try {
        // Import OpenAI dynamically
        const OpenAI = require('openai');
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        // Transcribe using OpenAI Whisper
        const transcription = await openai.audio.transcriptions.create({
          file: require('fs').createReadStream(audioFilePath),
          model: 'whisper-1',
          language: language,
          prompt: `This is a teacher's voice note about student ${studentName || 'a student'}. Please transcribe it clearly and accurately.`,
          response_format: 'verbose_json',
          timestamp_granularities: ['segment']
        });

        console.log('✅ Transcription successful');
        console.log('📝 Transcription text:', transcription.text);

        // Clean up the uploaded file
        require('fs').unlinkSync(audioFilePath);

        const voiceData = {
          transcription: transcription.text,
          confidence: transcription.segments?.[0]?.avg_logprob || 0.9,
          language: transcription.language || language,
          processingTime: 1.8,
          segments: transcription.segments || [],
          sentiment: 'positive',
          keywords: this.extractKeywords(transcription.text)
        };

        this.sendJSONResponse(res, 200, {
          success: true,
          message: 'Voice processed successfully',
          data: voiceData
        });
      } catch (transcriptionError) {
        console.error('❌ Transcription error:', transcriptionError);
        
        // Clean up the uploaded file even if transcription fails
        if (require('fs').existsSync(audioFilePath)) {
          require('fs').unlinkSync(audioFilePath);
        }

        this.sendErrorResponse(res, 500, 'Failed to transcribe audio. Please check your audio file and try again.');
      }
    } catch (error) {
      console.error('Error processing voice:', error);
      
      // Clean up uploaded file if it exists
      if (req.file && require('fs').existsSync(req.file.path)) {
        require('fs').unlinkSync(req.file.path);
      }
      
      this.sendErrorResponse(res, 500, 'Failed to process voice');
    }
  }

  async handleUploadAudio(req, res) {
    try {
      console.log('🎤 Audio Upload Request');
      
      if (!req.file) {
        return this.sendErrorResponse(res, 400, 'No audio file provided');
      }

      const { studentName, reportId } = req.body;
      const audioFilePath = req.file.path;
      const fileName = req.file.filename;
      
      console.log('📁 Uploaded audio file:', audioFilePath);
      console.log('👤 Student name:', studentName);
      console.log('📄 File name:', fileName);

      // In a production environment, you would upload this to a cloud storage service
      // For now, we'll create a public URL that can be accessed by the web app
      const audioUrl = `/uploads/audio/${fileName}`;
      
      // Copy file to a public uploads directory
      const uploadsDir = require('path').join(__dirname, '../uploads/audio');
      if (!require('fs').existsSync(uploadsDir)) {
        require('fs').mkdirSync(uploadsDir, { recursive: true });
      }
      
      const publicPath = require('path').join(uploadsDir, fileName);
      require('fs').copyFileSync(audioFilePath, publicPath);
      
      // Clean up the temporary file
      require('fs').unlinkSync(audioFilePath);

      const audioData = {
        url: audioUrl,
        filename: fileName,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        uploadedAt: new Date().toISOString(),
        studentName,
        reportId
      };

      this.sendJSONResponse(res, 200, {
        success: true,
        message: 'Audio uploaded successfully',
        data: audioData
      });
    } catch (error) {
      console.error('Error uploading audio:', error);
      
      // Clean up uploaded file if it exists
      if (req.file && require('fs').existsSync(req.file.path)) {
        require('fs').unlinkSync(req.file.path);
      }
      
      this.sendErrorResponse(res, 500, 'Failed to upload audio');
    }
  }

  extractKeywords(text) {
    // Simple keyword extraction
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'];
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.includes(word));
    
    // Return unique words, limited to 10
    return [...new Set(words)].slice(0, 10);
  }

  handleGetInsights(req, res) {
    const insights = [
      {
        type: 'academic',
        title: 'Strong Mathematical Foundation',
        description: 'Emma demonstrates excellent mathematical reasoning and problem-solving abilities.',
        confidence: 0.92,
        evidence: ['Consistent high scores in math assessments', 'Strong performance in problem-solving tasks'],
        actionable: true,
        priority: 'high'
      }
    ];

    this.sendJSONResponse(res, 200, { success: true, data: insights });
  }

  handleGetReportTemplates(req, res) {
    const reportTemplates = [
      {
        _id: 'template1',
        name: 'Academic Progress Report',
        description: 'Comprehensive academic progress report template',
        grade: 'all',
        reportFrequency: 'monthly',
        isActive: true,
        fields: [
          { name: 'academic_performance', label: 'Academic Performance', type: 'text' },
          { name: 'strengths', label: 'Strengths', type: 'text' },
          { name: 'areas_for_improvement', label: 'Areas for Improvement', type: 'text' },
          { name: 'recommendations', label: 'Recommendations', type: 'text' }
        ]
      },
      {
        _id: 'template2',
        name: 'Behavior Report',
        description: 'Student behavior and social development report',
        grade: 'all',
        reportFrequency: 'weekly',
        isActive: true,
        fields: [
          { name: 'behavior_rating', label: 'Behavior Rating', type: 'select' },
          { name: 'social_interactions', label: 'Social Interactions', type: 'text' },
          { name: 'classroom_conduct', label: 'Classroom Conduct', type: 'text' },
          { name: 'improvement_goals', label: 'Improvement Goals', type: 'text' }
        ]
      },
      {
        _id: 'template3',
        name: 'Parent Communication Report',
        description: 'Regular parent communication and updates',
        grade: 'all',
        reportFrequency: 'biweekly',
        isActive: true,
        fields: [
          { name: 'communication_summary', label: 'Communication Summary', type: 'text' },
          { name: 'parent_concerns', label: 'Parent Concerns', type: 'text' },
          { name: 'teacher_observations', label: 'Teacher Observations', type: 'text' },
          { name: 'next_steps', label: 'Next Steps', type: 'text' }
        ]
      }
    ];

    this.sendJSONResponse(res, 200, { success: true, data: reportTemplates });
  }

  handleCreateReport(req, res, body) {
    const reportData = {
      _id: 'R' + Date.now(),
      title: body.title || 'Generated Report',
      studentId: body.studentId,
      templateId: body.templateId,
      content: body.content || 'Report content will be generated here.',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      voiceRecording: body.voiceRecording || { hasRecording: false },
      aiGenerated: body.aiGenerated || { isAiGenerated: false }
    };

    this.sendJSONResponse(res, 201, {
      success: true,
      message: 'Report created successfully',
      data: reportData
    });
  }

  handleApproveReport(req, res, reportId, body) {
    const reportData = {
      _id: reportId,
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: 'teacher',
      comment: body.comment || 'Auto-approved by teacher'
    };

    this.sendJSONResponse(res, 200, {
      success: true,
      message: 'Report approved successfully',
      data: reportData
    });
  }

  handleSendReport(req, res, reportId, body) {
    const reportData = {
      _id: reportId,
      status: 'sent',
      sentAt: new Date().toISOString(),
      sentTo: body.emails || ['parent@example.com']
    };

    this.sendJSONResponse(res, 200, {
      success: true,
      message: 'Report sent to parents successfully',
      data: reportData
    });
  }

  handleGetAnalytics(req, res) {
    const analytics = {
      students: {
        total: 1247,
        active: 1189,
        newThisMonth: 23,
        growthRate: 12.5
      },
      teachers: {
        total: 89,
        active: 87,
        averageReportsPerTeacher: 38.7
      },
      reports: {
        total: 3456,
        thisMonth: 234,
        averageGenerationTime: 2.3,
        aiAccuracy: 96.2
      },
      engagement: {
        parentLoginRate: 94.2,
        averageSessionDuration: 8.5,
        reportViewRate: 87.3
      }
    };

    this.sendJSONResponse(res, 200, { success: true, data: analytics });
  }

  handleGetPerformance(req, res) {
    const performance = {
      academicProgress: [
        { subject: 'Mathematics', averageScore: 87.3, improvement: 5.2 },
        { subject: 'Reading', averageScore: 91.8, improvement: 3.1 },
        { subject: 'Science', averageScore: 84.7, improvement: 7.8 },
        { subject: 'Social Studies', averageScore: 89.2, improvement: 4.5 }
      ],
      socialDevelopment: [
        { skill: 'Collaboration', averageRating: 'Excellent', trend: 'improving' },
        { skill: 'Communication', averageRating: 'Good', trend: 'stable' },
        { skill: 'Leadership', averageRating: 'Developing', trend: 'improving' }
      ]
    };

    this.sendJSONResponse(res, 200, { success: true, data: performance });
  }

  handleGetPredictive(req, res) {
    const predictive = {
      atRiskStudents: [
        {
          studentId: 'ST003',
          studentName: 'Olivia Davis',
          riskFactors: ['Declining math scores', 'Reduced engagement'],
          confidence: 0.87
        }
      ],
      recommendedActions: [
        {
          category: 'Academic Support',
          action: 'Schedule additional math tutoring for Olivia Davis',
          impact: 'high',
          effort: 'medium'
        }
      ],
      trends: [
        {
          metric: 'Student Performance',
          currentValue: 87.3,
          predictedValue: 89.1,
          confidence: 0.92,
          timeframe: 'Next Quarter'
        }
      ]
    };

    this.sendJSONResponse(res, 200, { success: true, data: predictive });
  }

  handleGetMessages(req, res) {
    const messages = [
      {
        id: 'MSG001',
        senderId: 'T001',
        senderName: 'Ms. Davis',
        senderRole: 'teacher',
        recipientId: 'P001',
        recipientName: 'Sarah Wilson',
        recipientRole: 'parent',
        subject: 'Emma\'s Progress Report',
        content: 'Emma has shown excellent progress in mathematics this month.',
        status: 'read',
        createdAt: '2024-01-15T10:30:00Z',
        readAt: '2024-01-15T11:15:00Z'
      }
    ];

    this.sendJSONResponse(res, 200, { success: true, data: messages });
  }

  handleGetNotifications(req, res) {
    const notifications = [
      {
        id: 'NOT001',
        userId: 'P001',
        type: 'report',
        title: 'New Progress Report Available',
        message: 'A new progress report for Emma Johnson is now available.',
        data: { studentId: 'ST001', reportId: 'R001' },
        isRead: false,
        createdAt: '2024-01-15T09:00:00Z'
      }
    ];

    this.sendJSONResponse(res, 200, { success: true, data: notifications });
  }

  handleGetRealtimeStatus(req, res) {
    const status = {
      status: 'online',
      uptime: 86400,
      activeUsers: 23,
      systemLoad: 0.45,
      lastUpdate: new Date().toISOString()
    };

    this.sendJSONResponse(res, 200, { success: true, data: status });
  }

  handleGetRealtimeUpdates(req, res) {
    const updates = [];
    // Generate random updates for demo
    if (Math.random() > 0.7) {
      updates.push({
        type: 'notification',
        id: 'NOT' + Date.now(),
        timestamp: new Date().toISOString(),
        data: {
          title: 'New Report Available',
          message: 'A new progress report has been generated.',
          action: 'view_report'
        },
        priority: 'medium'
      });
    }

    this.sendJSONResponse(res, 200, { success: true, data: updates });
  }

  serveAudioFile(req, res, requestPath) {
    // Serve uploaded audio files
    const uploadsPath = require('path').join(__dirname, '../uploads/audio');
    const fileName = requestPath.replace('/uploads/audio/', '');
    const filePath = require('path').join(uploadsPath, fileName);
    
    // Security check: prevent directory traversal
    if (!filePath.startsWith(uploadsPath)) {
      return this.sendErrorResponse(res, 403, 'Forbidden');
    }
    
    if (!require('fs').existsSync(filePath)) {
      return this.sendErrorResponse(res, 404, 'Audio file not found');
    }
    
    // Set appropriate headers for audio files
    res.writeHead(200, { 
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
    });
    require('fs').createReadStream(filePath).pipe(res);
  }

  serveStaticFiles(req, res, requestPath) {
    // For production, serve static files
    let filePath = requestPath === '/' ? '/index.html' : requestPath;
    
    // Try build directory first, then public directory
    let fullPath = require('path').join(__dirname, '../build', filePath);
    
    // If build doesn't exist, try public directory
    if (!require('fs').existsSync(fullPath)) {
      fullPath = require('path').join(__dirname, '../public', filePath);
    }

    fs.readFile(fullPath, (err, data) => {
      if (err) {
        // Try to serve index.html from public directory for SPA routing
        const indexPath = require('path').join(__dirname, '../public/index.html');
        fs.readFile(indexPath, (err, data) => {
          if (err) {
            this.sendErrorResponse(res, 404, 'File not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
          }
        });
      } else {
        const ext = require('path').extname(fullPath);
        const contentType = this.getContentType(ext);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      }
    });
  }

  getContentType(ext) {
    const types = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };
    return types[ext] || 'application/octet-stream';
  }

  // Mock data
  getMockUsers() {
    return [
      {
        id: '1',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@school.com',
        role: 'school_admin',
        schoolId: 'school1',
        isEmailVerified: true
      },
      {
        id: '2',
        firstName: 'Jane',
        lastName: 'Teacher',
        email: 'jane@school.com',
        role: 'teacher',
        schoolId: 'school1',
        isEmailVerified: true
      },
      {
        id: '3',
        firstName: 'Sarah',
        lastName: 'Parent',
        email: 'sarah@email.com',
        role: 'parent',
        schoolId: 'school1',
        isEmailVerified: true
      }
    ];
  }

  getMockStudents() {
    return [
      {
        id: 'ST001',
        firstName: 'Emma',
        lastName: 'Johnson',
        grade: 'Grade 3',
        class: '3A',
        status: 'active',
        lastReport: '2024-01-15',
        parentEmail: 'parent1@email.com',
        parentPhone: '+1-555-0123',
        avatar: 'EJ',
      },
      {
        id: 'ST002',
        firstName: 'Liam',
        lastName: 'Smith',
        grade: 'Grade 4',
        class: '4A',
        status: 'active',
        lastReport: '2024-01-14',
        parentEmail: 'parent2@email.com',
        parentPhone: '+1-555-0124',
        avatar: 'LS',
      }
    ];
  }

  getMockTeachers() {
    return [
      {
        id: 'teacher1',
        firstName: 'Jane',
        lastName: 'Teacher',
        email: 'jane@school.com',
        class: 'Grade 3A',
        students: 24,
        reportsGenerated: 96,
        performanceScore: 92
      },
      {
        id: 'teacher2',
        firstName: 'Mike',
        lastName: 'Johnson',
        email: 'mike@school.com',
        class: 'Grade 4A',
        students: 22,
        reportsGenerated: 88,
        performanceScore: 88
      }
    ];
  }

  getMockSchools() {
    return [
      {
        id: 'school1',
        name: 'Sunshine Montessori',
        contactPerson: { name: 'Sarah Johnson', email: 'sarah@sunshine.edu' },
        schoolType: 'montessori',
        subscription: { plan: 'premium', status: 'active' },
        usage: { totalStudents: 156, totalTeachers: 12, totalReports: 892 }
      }
    ];
  }

  // Utility methods
  sendJSONResponse(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  sendErrorResponse(res, statusCode, message) {
    const error = {
      success: false,
      message,
      statusCode,
      timestamp: new Date().toISOString()
    };
    this.sendJSONResponse(res, statusCode, error);
  }

  logRequest(req, res) {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    console.log(`[${timestamp}] ${method} ${url} - ${ip} - ${userAgent}`);
  }

  gracefulShutdown() {
    console.log('Received shutdown signal, gracefully closing server...');
    
    this.server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  }

  start() {
    this.server.listen(this.port, this.host, () => {
      console.log(`🚀 Barrana.ai Production Server running on ${this.host}:${this.port}`);
      console.log(`📊 Environment: ${this.environment}`);
      console.log(`🔗 Health Check: http://${this.host}:${this.port}/api/health`);
      console.log(`🔗 API Base: http://${this.host}:${this.port}/api`);
      console.log(`⏰ Started at: ${this.startTime.toISOString()}`);
      console.log(`🔧 Features enabled:`, Object.keys(config.features).filter(key => config.features[key]));
    });
  }
}

// Start the production server
const productionServer = new ProductionServer();
productionServer.start();

module.exports = productionServer; 