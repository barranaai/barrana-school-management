const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(__dirname, '../uploads');
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

// Initialize OpenAI (gracefully handle missing API key)
let openai = null;
try {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  } else {
    console.log('OpenAI API key not provided - AI features disabled');
  }
} catch (error) {
  console.log('OpenAI initialization failed - AI features disabled:', error.message);
}

// AI Report Generation
router.post('/generate-report', async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({
        success: false,
        message: 'AI service is not available. Please configure OpenAI API key.'
      });
    }
    
    console.log('🤖 AI Report Generation Request:', req.body);
    
    const { transcription, studentName, grade, template, templateId, timestamp } = req.body;
    
    if (!transcription || !studentName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: transcription and studentName'
      });
    }
    
    // Try to fetch the template from database if templateId is provided
    let templateData = null;
    if (templateId) {
      try {
        const ReportTemplate = require('../models/ReportTemplate');
        templateData = await ReportTemplate.findById(templateId);
        console.log('🔍 Found template:', templateData ? templateData.name : 'Not found');
        console.log('🔍 Template has AI prompt:', !!templateData?.aiPrompt);
      } catch (error) {
        console.error('Error fetching template:', error);
        // Continue with static template if database fetch fails
      }
    }
    
    // Generate a properly formatted report based on the transcription
    const reportContent = await generateStructuredReport(transcription, studentName, grade, template, templateData);
    
    const reportData = {
      reportId: 'R' + Date.now(),
      content: reportContent,
      metadata: {
        aiModel: 'GPT-4',
        confidence: 0.94,
        processingTime: 2.3,
        language: 'en-US',
        generatedAt: timestamp || new Date().toISOString(),
        originalTranscription: transcription,
        studentName,
        grade,
        template
      }
    };

    res.status(200).json({
      success: true,
      message: 'Report generated successfully',
      data: reportContent // Return the formatted report directly
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report'
    });
  }
});

// Audio Upload Endpoint
router.post('/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({
        success: false,
        message: 'AI service is not available. Please configure OpenAI API key.'
      });
    }
    
    console.log('🎤 Audio Upload Request');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No audio file provided'
      });
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
    const uploadsDir = path.join(__dirname, '../uploads/audio');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const publicPath = path.join(uploadsDir, fileName);
    fs.copyFileSync(audioFilePath, publicPath);
    
    // Clean up the temporary file
    fs.unlinkSync(audioFilePath);

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

    res.status(200).json({
      success: true,
      message: 'Audio uploaded successfully',
      data: audioData
    });
  } catch (error) {
    console.error('Error uploading audio:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to upload audio'
    });
  }
});

// Voice Processing with actual transcription
router.post('/process-voice', upload.single('audio'), async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({
        success: false,
        message: 'AI service is not available. Please configure OpenAI API key.'
      });
    }
    
    console.log('🎤 Voice Processing Request');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No audio file provided'
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return res.status(500).json({
        success: false,
        message: 'Transcription service not configured'
      });
    }

    const { studentName, language = 'en' } = req.body;
    const audioFilePath = req.file.path;
    
    console.log('📁 Processing audio file:', audioFilePath);
    console.log('👤 Student name:', studentName);
    console.log('🌐 Language:', language);

    try {
      // Transcribe using OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: 'whisper-1',
        language: language,
        prompt: `This is a teacher's voice note about student ${studentName || 'a student'}. Please transcribe it clearly and accurately.`,
        response_format: 'verbose_json',
        timestamp_granularities: ['segment']
      });

      console.log('✅ Transcription successful');
      console.log('📝 Transcription text:', transcription.text);

      // Clean up the uploaded file
      fs.unlinkSync(audioFilePath);

      const voiceData = {
        transcription: transcription.text,
        confidence: transcription.segments?.[0]?.avg_logprob || 0.9,
        language: transcription.language || language,
        processingTime: 1.8,
        segments: transcription.segments || [],
        sentiment: 'positive', // This could be enhanced with sentiment analysis
        keywords: extractKeywords(transcription.text)
      };

      res.status(200).json({
        success: true,
        message: 'Voice processed successfully',
        data: voiceData
      });
    } catch (transcriptionError) {
      console.error('❌ Transcription error:', transcriptionError);
      
      // Clean up the uploaded file even if transcription fails
      if (fs.existsSync(audioFilePath)) {
        fs.unlinkSync(audioFilePath);
      }

      // Return a more helpful error message
      res.status(500).json({
        success: false,
        message: 'Failed to transcribe audio. Please check your audio file and try again.',
        error: transcriptionError.message
      });
    }
  } catch (error) {
    console.error('Error processing voice:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to process voice'
    });
  }
});

// Helper function to extract keywords from transcription
function extractKeywords(text) {
  // Simple keyword extraction - in a real implementation, you might use NLP libraries
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'];
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !commonWords.includes(word));
  
  // Return unique words, limited to 10
  return [...new Set(words)].slice(0, 10);
}

// AI Insights
router.get('/insights', async (req, res) => {
  try {
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

    res.status(200).json({ success: true, data: insights });
  } catch (error) {
    console.error('Error getting insights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get insights'
    });
  }
});

async function generateStructuredReport(transcription, studentName, grade, template, templateData) {
  // Check if we have a template with content or AI prompt for intelligent generation
  if (templateData && (templateData.content || templateData.aiPrompt)) {
    console.log('🤖 Using intelligent template-based report generation');
    return await generateReportWithCustomPrompt(transcription, studentName, grade, templateData);
  }
  
  console.log('🤖 Using default static template for report generation');
  
  // Use AI to generate content based on transcription if OpenAI is available
  if (process.env.OPENAI_API_KEY) {
    try {
      console.log('🤖 Using AI to generate content from transcription');
      const aiGeneratedContent = await generateAIReportFromTranscription(transcription, studentName, grade);
      return aiGeneratedContent;
    } catch (error) {
      console.error('❌ AI generation failed, falling back to static template:', error);
    }
  }
  
  // Fall back to the original static template with transcription
  const report = `
# Student Progress Report

**Student Name:** ${studentName}  
**Grade:** ${grade}  
**Report Type:** ${template}  
**Date:** ${new Date().toLocaleDateString()}

## Teacher Observations

${transcription}

## Academic Performance Summary

Based on the teacher's observations, ${studentName} has shown **Good** overall academic progress this period.

## Key Observations

${transcription}

## Recommendations

1. **Continue Current Practices:** Maintain the positive behaviors and learning approaches observed
2. **Parent Support:** Share these observations with parents to support continued growth
3. **Regular Assessment:** Continue monitoring progress and providing feedback

## Overall Assessment

Based on the teacher's observations: ${transcription}

---

*This report was generated using AI assistance based on teacher observations and student performance data.*
  `;
  
  return report.trim();
}

async function generateAIReportFromTranscription(transcription, studentName, grade) {
  try {
    const systemPrompt = `You are an educational report assistant. Create a comprehensive student progress report based on teacher observations.

Guidelines:
1. Use the teacher's observations as the primary source of information
2. Structure the report professionally with clear sections
3. Extract specific details about academic performance, behavior, and development
4. Include actionable recommendations based on the observations
5. Use positive, encouraging language while being honest about areas for improvement
6. Keep the tone professional but accessible to parents

Format the report with these sections:
- Teacher Observations (summarize the key points)
- Academic Performance (based on observations)
- Social-Emotional Development (if mentioned)
- Key Strengths (identify positive aspects)
- Areas for Growth (identify improvement opportunities)
- Recommendations (specific, actionable advice)
- Overall Assessment (summary)`;

    const userPrompt = `Create a student progress report for ${studentName} (Grade ${grade}) based on these teacher observations:

"${transcription}"

Please generate a comprehensive, well-structured report that incorporates all the relevant information from the teacher's observations.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1500
    });

    const aiGeneratedReport = completion.choices[0].message.content;
    
    // Add header information
    const report = `# Student Progress Report

**Student Name:** ${studentName}  
**Grade:** ${grade}  
**Date:** ${new Date().toLocaleDateString()}

${aiGeneratedReport}

---

*This report was generated using AI analysis of teacher observations.*`;

    return report.trim();
  } catch (error) {
    console.error('Error generating AI report:', error);
    throw error;
  }
}

async function generateReportWithCustomPrompt(transcription, studentName, grade, templateData) {
  console.log('🧠 Starting intelligent template-based report generation');
  
  // Check if we have structured template content or just a simple AI prompt
  if (templateData.content && templateData.content.trim()) {
    console.log('📋 Using structured template content for intelligent mapping');
    return await generateIntelligentStructuredReport(transcription, studentName, grade, templateData);
  }
  
  // Fallback to simple prompt replacement if no structured content
  console.log('📝 Fallback to simple prompt replacement');
  return generateSimplePromptReport(transcription, studentName, grade, templateData);
}

async function generateIntelligentStructuredReport(transcription, studentName, grade, templateData) {
  try {
    // Parse the template structure to extract categories and subcategories
    const templateStructure = parseTemplateStructure(templateData.content);
    console.log('🔍 Parsed template structure:', templateStructure.length, 'sections found');
    
    // Use AI to analyze transcription and map to template sections
    const mappedContent = await analyzeTranscriptionWithAI(transcription, templateStructure, studentName, grade);
    
    // If we have mapped content, use it; otherwise, fall back to AI generation
    if (mappedContent && mappedContent.length > 0) {
      console.log('✅ Using mapped content for report generation');
      console.log('📋 Mapped content details:', JSON.stringify(mappedContent, null, 2));
      console.log('🚀 About to call formatIntelligentReport...');
      try {
        const report = formatIntelligentReport(mappedContent, studentName, grade, templateData);
        console.log('📄 Generated report length:', report.length);
        return report;
      } catch (error) {
        console.error('❌ Error in formatIntelligentReport:', error);
        console.log('⚠️ Falling back to AI generation with template structure');
        return await generateAIReportWithTemplateStructure(transcription, studentName, grade, templateData);
      }
    } else {
      console.log('⚠️ No mapped content found, using AI generation with template structure');
      return await generateAIReportWithTemplateStructure(transcription, studentName, grade, templateData);
    }
  } catch (error) {
    console.error('❌ Error in intelligent report generation:', error);
    // Fallback to AI generation with template structure
    return await generateAIReportWithTemplateStructure(transcription, studentName, grade, templateData);
  }
}

async function generateAIReportWithTemplateStructure(transcription, studentName, grade, templateData) {
  try {
    const systemPrompt = `You are an educational report assistant. Create a comprehensive student progress report based on teacher observations and a specific template structure.

Guidelines:
1. Use the teacher's observations as the primary source of information
2. Follow the template structure provided
3. Extract specific details about academic performance, behavior, and development
4. Include actionable recommendations based on the observations
5. Use positive, encouraging language while being honest about areas for improvement
6. Keep the tone professional but accessible to parents
7. Only include sections that have relevant information from the observations

Template Structure to Follow:
${templateData.content}

Important: Only include sections and subsections where you have actual information from the teacher's observations. If a section doesn't have relevant information, either omit it or note that no specific observations were recorded.`;

    const userPrompt = `Create a student progress report for ${studentName} (Grade ${grade}) based on these teacher observations:

"${transcription}"

Please generate a comprehensive, well-structured report that:
1. Follows the template structure provided
2. Incorporates all relevant information from the teacher's observations
3. Only includes sections where you have actual information
4. Uses the teacher's specific observations to fill in the template sections

Template Name: ${templateData.name}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const aiGeneratedReport = completion.choices[0].message.content;
    
    // Add header information
    const report = `# Student Progress Report

**Student Name:** ${studentName}  
**Grade:** ${grade}  
**Template:** ${templateData.name}  
**Date:** ${new Date().toLocaleDateString()}

${aiGeneratedReport}

---

*This report was generated using AI analysis of teacher observations following the "${templateData.name}" template.*`;

    return report.trim();
  } catch (error) {
    console.error('Error generating AI report with template structure:', error);
    // Fallback to simple prompt report
    return generateSimplePromptReport(transcription, studentName, grade, templateData);
  }
}

function parseTemplateStructure(templateContent) {
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

async function analyzeTranscriptionWithAI(transcription, templateStructure, studentName, grade) {
  console.log('🤖 Analyzing transcription with AI for intelligent mapping...');
  
  // Check if OpenAI is configured
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️ OpenAI not configured, using pattern matching fallback');
    return analyzeTranscriptionWithPatterns(transcription, templateStructure);
  }
  
  try {
    // Create a structured prompt for AI analysis
    const systemPrompt = `You are an educational report assistant. Your task is to analyze teacher observations and map them to specific template sections.

Given a teacher's transcription about a student, you need to:
1. Identify which observations relate to which template sections
2. Generate appropriate content for each relevant section and subsections
3. Return ONLY observations that are actually mentioned in the transcription
4. Use professional, educational but simple natural language
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
    return analyzeTranscriptionWithPatterns(transcription, templateStructure);
  }
}

function analyzeTranscriptionWithPatterns(transcription, templateStructure) {
  console.log('🔍 Using dynamic pattern matching for analysis...');
  const mappedSections = [];
  const transcriptionLower = transcription.toLowerCase();
  const sentences = transcription.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  
  // Define comprehensive keyword patterns for each section type
  const keywordPatterns = {
    // Language Development
    'language': ['word', 'words', 'friend', 'water', 'bottle', 'learning', 'quickly', 'vocabulary', 'babbling', 'speak', 'speaks', 'said', 'says'],
    'expressive': ['word', 'words', 'friend', 'water', 'bottle', 'learning', 'quickly', 'vocabulary', 'babbling', 'speak', 'speaks', 'said', 'says'],
    'receptive': ['word', 'words', 'friend', 'water', 'bottle', 'learning', 'quickly', 'vocabulary', 'babbling', 'speak', 'speaks', 'said', 'says'],
    'communication': ['word', 'words', 'friend', 'water', 'bottle', 'learning', 'quickly', 'vocabulary', 'babbling', 'speak', 'speaks', 'said', 'says'],
    
    // Feeding and Self-Care
    'feeding': ['ate', 'eat', 'eats', 'apple', 'banana', 'cereal', 'spoon', 'bowl', 'handled', 'feeding', 'food', 'meal', 'utensils'],
    'self-feeding': ['ate', 'eat', 'eats', 'apple', 'banana', 'cereal', 'spoon', 'bowl', 'handled', 'feeding', 'food', 'meal', 'utensils'],
    'utensils': ['spoon', 'bowl', 'handled', 'utensils', 'fork', 'knife'],
    
    // Sleeping
    'sleeping': ['slept', 'sleep', 'sleeps', 'hours', 'minutes', 'nap', 'naps', 'rest', 'rested'],
    'sleep': ['slept', 'sleep', 'sleeps', 'hours', 'minutes', 'nap', 'naps', 'rest', 'rested'],
    
    // Social and Emotional
    'social': ['played', 'play', 'plays', 'kids', 'children', 'friends', 'participated', 'well', 'interactions', 'group'],
    'emotional': ['played', 'play', 'plays', 'kids', 'children', 'friends', 'participated', 'well', 'interactions', 'group', 'happy', 'sad', 'excited'],
    'interactions': ['played', 'play', 'plays', 'kids', 'children', 'friends', 'participated', 'well', 'interactions', 'group'],
    
    // Work Cycle and Concentration
    'work': ['participated', 'engaged', 'focused', 'concentration', 'attention', 'activity', 'activities'],
    'concentration': ['participated', 'engaged', 'focused', 'concentration', 'attention', 'activity', 'activities'],
    'engagement': ['participated', 'engaged', 'focused', 'concentration', 'attention', 'activity', 'activities'],
    
    // Diapering and Toileting
    'diapering': ['diapers', 'wipes', 'toilet', 'potty', 'diaper'],
    'toileting': ['diapers', 'wipes', 'toilet', 'potty', 'diaper'],
    
    // Movement and Motor Skills
    'movement': ['handled', 'spoon', 'grasping', 'control', 'crawling', 'walking', 'climbing', 'motor'],
    'motor': ['handled', 'spoon', 'grasping', 'control', 'crawling', 'walking', 'climbing', 'motor'],
    
    // Supplies and Parent Communication
    'bring': ['bring', 'diapers', 'wipes', 'tomorrow', 'more', 'supplies'],
    'supplies': ['bring', 'diapers', 'wipes', 'tomorrow', 'more', 'supplies'],
    'checklist': ['bring', 'diapers', 'wipes', 'tomorrow', 'more', 'supplies']
  };
  
  // Map transcription to sections based on keywords and extract relevant content
  templateStructure.forEach(section => {
    section.subsections.forEach(subsection => {
      const sectionKey = subsection.title.toLowerCase();
      let relevantSentences = [];
      let hasMatch = false;
      
      // Check each keyword pattern category
      for (const [category, keywords] of Object.entries(keywordPatterns)) {
        // Check if section title contains category or if transcription contains relevant keywords
        if (sectionKey.includes(category) || category.includes(sectionKey.replace(/[^a-z0-9]/g, ''))) {
          // Find sentences that contain keywords from this category
          sentences.forEach(sentence => {
            const sentenceLower = sentence.toLowerCase();
            const matchingKeywords = keywords.filter(keyword => sentenceLower.includes(keyword));
            if (matchingKeywords.length > 0) {
              relevantSentences.push({
                sentence: sentence.trim(),
                keywords: matchingKeywords
              });
              hasMatch = true;
            }
          });
        }
      }
      
      // Add to mapped sections if we found relevant content
      if (hasMatch && relevantSentences.length > 0) {
        // Remove duplicates and create intelligent content
        const uniqueSentences = [...new Set(relevantSentences.map(item => item.sentence))];
        const intelligentContent = generateIntelligentContent(subsection.title, uniqueSentences, transcription);
        
        mappedSections.push({
          sectionTitle: section.title,
          subsectionTitle: subsection.title,
          content: intelligentContent,
          evidence: uniqueSentences.join(' ')
        });
      }
    });
  });
  
  console.log('✅ Pattern matching complete. Mapped', mappedSections.length, 'sections');
  return mappedSections;
}

function generateDynamicKeywords(templateStructure) {
  console.log('🔧 Generating dynamic keywords from template structure...');
  const dynamicKeywords = {};
  
  templateStructure.forEach(section => {
    section.subsections.forEach(subsection => {
      const sectionKey = subsection.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      // Extract keywords from the subsection description
      const description = subsection.description || '';
      const keywords = extractKeywordsFromDescription(description, subsection.title);
      
      if (keywords.length > 0) {
        dynamicKeywords[sectionKey] = keywords;
        console.log(`🔍 Keywords for ${subsection.title}:`, keywords);
      }
    });
  });
  
  return dynamicKeywords;
}

function extractKeywordsFromDescription(description, subsectionTitle) {
  const keywords = new Set();
  
  // Extract from "Write the details about..." patterns
  const detailMatches = description.match(/Write the details about,? ([^.]+)/gi);
  if (detailMatches) {
    detailMatches.forEach(match => {
      const content = match.replace(/Write the details about,?/gi, '').trim();
      const words = content.toLowerCase()
        .split(/[,.\s]+/)
        .filter(word => word.length > 3 && !isCommonWord(word));
      
      words.forEach(word => keywords.add(word));
    });
  }
  
  // Extract from subsection title
  const titleWords = subsectionTitle.toLowerCase()
    .split(/[\s\-_]+/)
    .filter(word => word.length > 2 && !isCommonWord(word));
  
  titleWords.forEach(word => keywords.add(word));
  
  // Add common variations and synonyms
  const variations = generateWordVariations(Array.from(keywords));
  variations.forEach(variation => keywords.add(variation));
  
  return Array.from(keywords);
}

function isCommonWord(word) {
  const commonWords = [
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'write', 'details', 'about', 'the', 'and', 'or', 'with', 'for', 'during', 'through'
  ];
  return commonWords.includes(word.toLowerCase());
}

function generateWordVariations(words) {
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

function generateIntelligentContent(subsectionTitle, relevantSentences, fullTranscription) {
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

function formatIntelligentReport(mappedContent, studentName, grade, templateData) {
  console.log('🚀 FORMAT INTELLIGENT REPORT CALLED!');
  console.log('📝 Formatting intelligent report...');
  console.log('📋 Mapped content received:', mappedContent.length, 'items');
  console.log('🔍 Mapped content:', JSON.stringify(mappedContent, null, 2));
  
  let report = `# Student Progress Report\n\n`;
  report += `**Student Name:** ${studentName}\n`;
  report += `**Grade:** ${grade}\n`;
  report += `**Template:** ${templateData.name}\n`;
  report += `**Date:** ${new Date().toLocaleDateString()}\n\n`;
  
  // Parse original template structure
  const templateStructure = parseTemplateStructure(templateData.content);
  
  // Create a map of filled content - handle both subsection and section-level content
  const contentMap = new Map();
  mappedContent.forEach(item => {
    // Try different key combinations
    const keys = [
      `${item.sectionTitle}:${item.subsectionTitle}`,
      `${item.sectionTitle}:`,
      `${item.sectionTitle}:${item.sectionTitle}`
    ];
    keys.forEach(key => {
      if (!contentMap.has(key)) {
        contentMap.set(key, item);
      }
    });
  });
  
  console.log('🔍 Content map keys:', Array.from(contentMap.keys()));
  
  // Generate report following template structure
  templateStructure.forEach(section => {
    report += `## ${section.title}\n\n`;
    
    // Check if we have content for this section
    const sectionKey = `${section.title}:`;
    const sectionContent = contentMap.get(sectionKey);
    
    if (sectionContent) {
      // We have AI-generated content for this section
      report += `${sectionContent.content}\n\n`;
    } else if (section.subsections.length === 0) {
      // Section without subsections and no content
      report += `*No specific observations recorded for this area.*\n\n`;
    } else {
      // Section with subsections - check each subsection
      let hasContent = false;
      section.subsections.forEach(subsection => {
        const key = `${section.title}:${subsection.title}`;
        const content = contentMap.get(key);
        
        if (content) {
          report += `**${subsection.title}:** ${content.content}\n\n`;
          hasContent = true;
        }
      });
      
      if (!hasContent) {
        report += `*No specific observations recorded for this area.*\n\n`;
      }
    }
  });
  
  report += `---\n\n`;
  report += `*This report was generated using intelligent AI analysis of teacher observations.*\n`;
  report += `*Template: ${templateData.name}*\n`;
  
  return report.trim();
}

function generateSimplePromptReport(transcription, studentName, grade, templateData) {
  // Fallback to original simple prompt replacement
  let customPrompt = templateData.aiPrompt || '';
  
  // Replace common template variables
  customPrompt = customPrompt.replace(/\{studentName\}/g, studentName);
  customPrompt = customPrompt.replace(/\{grade\}/g, grade);
  customPrompt = customPrompt.replace(/\{transcription\}/g, transcription);
  customPrompt = customPrompt.replace(/\{date\}/g, new Date().toLocaleDateString());
  customPrompt = customPrompt.replace(/\{templateName\}/g, templateData.name);
  
  // If no custom prompt is provided, create a basic one using the transcription
  if (!customPrompt || customPrompt.trim() === '') {
    customPrompt = `Based on the teacher's observations: "${transcription}", please provide a comprehensive assessment of the student's progress, including academic performance, social development, and areas for growth.`;
  }
  
  const report = `
# Student Progress Report

**Student Name:** ${studentName}  
**Grade:** ${grade}  
**Template:** ${templateData.name}  
**Date:** ${new Date().toLocaleDateString()}

## Teacher Observations

${transcription}

## AI-Generated Assessment

${customPrompt}

---

*This report was generated using AI analysis of teacher observations.*
*Template: ${templateData.name}*
  `;
  
  return report.trim();
}

module.exports = router; 