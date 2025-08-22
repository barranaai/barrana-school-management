const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

// Import models
const ReportTemplate = require('./models/ReportTemplate');

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

// Test data: Montessori template content
const montessoriTemplateContent = `Practical Life (Self-Care & Environment):

Feeding: Write the details about, Self-feeding attempts, proficiency with utensils, willingness to try new foods, independence during mealtime.

Sleeping: Write the details about, Sleep patterns, ability to self-soothe, duration of naps.

Diapering/Toileting: Write the details about, Progress in toilet learning readiness cues (if applicable), cooperation during diaper changes.

Dressing: Write the details about, Participation in dressing/undressing, attempts at putting on shoes/hats.

Order: Write the details about, Developing routines, preference for order, ability to return items to place (even if assisted).

Movement: Write the details about, Crawling, walking, climbing, fine motor control (grasping, releasing objects, stacking).

Language:

Receptive Language: Write the details about, Responding to name, understanding simple commands, recognizing familiar words.

Expressive Language: Write the details about, Babbling, first words, increasing vocabulary, combining words.

Communication: Write the details about, Using gestures, pointing, vocalizing needs and wants.

Sensorial Exploration:

Write the details about, Engagement with sensorial materials (texture, sound, sight).

Write the details about, Exploration of the environment through senses.

Social-Emotional Development:

Write the details about, Interactions with peers and adults (smiling, eye contact, sharing).

Write the details about, Expression of emotions, ability to self-regulate (calming strategies).

Write the details about, Separation anxiety management.

Write the details about, Independence in play choices.

Work Cycle/Concentration:

Write the details about, Duration of focused engagement with activities.

Write the details about, Ability to choose work independently.`;

// Test transcriptions
const testTranscriptions = [
  {
    name: "Emma's Day",
    transcription: "Emma tried to feed herself with a spoon today but needed some help. She said 'more juice' and pointed to her cup. She played with the textured blocks for 10 minutes and shared toys with another child. She walked around the playground confidently and helped clean up after snack time."
  },
  {
    name: "Alex's Activities", 
    transcription: "Alex took a good nap for about an hour. He used gestures to ask for help and said 'up' when wanting to be picked up. He concentrated on the puzzle for 15 minutes without help. He showed some separation anxiety when mom left but calmed down after a few minutes."
  },
  {
    name: "Sofia's Progress",
    transcription: "Sofia ate her lunch independently using a fork. She understands simple commands like 'put it back' and responds to her name. She climbed on the playground equipment and showed good balance. She chose her own activities during free play time."
  }
];

// Import the intelligent report generation functions
const { parseTemplateStructure, analyzeTranscriptionWithPatterns, formatIntelligentReport } = require('./backend/routes/ai');

async function testIntelligentReports() {
  await connectDB();
  
  console.log('🧪 Testing Intelligent Report Generation\n');
  
  // Test template parsing
  console.log('📋 Testing Template Structure Parsing...');
  
  // Create a mock template data object
  const mockTemplateData = {
    _id: 'test123',
    name: 'Montessori Early Childhood Template',
    content: montessoriTemplateContent,
    grade: 'Preschool',
    standards: ['Development', 'Learning']
  };
  
  // Parse template structure (we need to extract this function or create a test version)
  function parseTemplateStructure(templateContent) {
    console.log('🔧 Parsing template structure...');
    const sections = [];
    const lines = templateContent.split('\n');
    
    let currentSection = null;
    
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
  
  function analyzeTranscriptionWithPatterns(transcription, templateStructure) {
    console.log('🔍 Using pattern matching for analysis...');
    const mappedSections = [];
    const transcriptionLower = transcription.toLowerCase();
    
    // Define keyword patterns for common educational areas
    const keywordPatterns = {
      'feeding': ['eat', 'food', 'feed', 'spoon', 'fork', 'meal', 'lunch', 'snack', 'hungry'],
      'sleeping': ['sleep', 'nap', 'rest', 'tired', 'sleepy'],
      'toileting': ['toilet', 'diaper', 'potty', 'bathroom'],
      'dressing': ['dress', 'clothes', 'shirt', 'pants', 'shoes', 'hat'],
      'movement': ['walk', 'run', 'climb', 'crawl', 'jump', 'motor', 'balance'],
      'language': ['speak', 'talk', 'word', 'say', 'language', 'communicate', 'gestures', 'pointing'],
      'social': ['friend', 'share', 'play', 'together', 'help', 'kind', 'toys'],
      'emotional': ['happy', 'sad', 'angry', 'cry', 'smile', 'emotion', 'anxiety', 'calm'],
      'concentration': ['focus', 'attention', 'concentrate', 'work', 'task', 'activity', 'puzzle', 'minutes']
    };
    
    // Map transcription to sections based on keywords
    templateStructure.forEach(section => {
      section.subsections.forEach(subsection => {
        const sectionKey = subsection.title.toLowerCase();
        
        // Check if any keywords match
        for (const [category, keywords] of Object.entries(keywordPatterns)) {
          if (sectionKey.includes(category) || keywords.some(keyword => transcriptionLower.includes(keyword))) {
            mappedSections.push({
              sectionTitle: section.title,
              subsectionTitle: subsection.title,
              content: `Based on observations: ${transcription}`,
              evidence: transcription
            });
            break; // Only add once per subsection
          }
        }
      });
    });
    
    console.log('✅ Pattern matching complete. Mapped', mappedSections.length, 'sections');
    return mappedSections;
  }
  
  function formatIntelligentReport(mappedContent, studentName, grade, templateData) {
    console.log('📝 Formatting intelligent report...');
    
    let report = `# Student Progress Report\n\n`;
    report += `**Student Name:** ${studentName}\n`;
    report += `**Grade:** ${grade}\n`;
    report += `**Template:** ${templateData.name}\n`;
    report += `**Date:** ${new Date().toLocaleDateString()}\n\n`;
    
    // Parse original template structure
    const templateStructure = parseTemplateStructure(templateData.content);
    
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
  
  const templateStructure = parseTemplateStructure(montessoriTemplateContent);
  console.log(`\n📊 Found ${templateStructure.length} main sections:`);
  templateStructure.forEach(section => {
    console.log(`  • ${section.title} (${section.subsections.length} subsections)`);
  });
  
  // Test each transcription
  for (const test of testTranscriptions) {
    console.log(`\n🎯 Testing: ${test.name}`);
    console.log(`📝 Transcription: "${test.transcription}"`);
    
    // Analyze transcription
    const mappedContent = analyzeTranscriptionWithPatterns(test.transcription, templateStructure);
    console.log(`🎯 Mapped ${mappedContent.length} sections:`);
    mappedContent.forEach(item => {
      console.log(`  • ${item.sectionTitle} → ${item.subsectionTitle}`);
    });
    
    // Generate report
    const report = formatIntelligentReport(mappedContent, test.name.split("'")[0], 'Preschool', mockTemplateData);
    
    console.log(`\n📋 Generated Report:\n`);
    console.log(report);
    console.log('\n' + '='.repeat(80) + '\n');
  }
  
  console.log('✅ Testing completed successfully!');
  process.exit(0);
}

testIntelligentReports().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});