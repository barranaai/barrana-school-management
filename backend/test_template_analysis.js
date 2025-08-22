const mongoose = require('mongoose');
require('dotenv').config();

async function testTemplateAnalysis() {
  console.log('🧪 Testing Template Analysis and Pattern Matching...\n');

  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/barrana_ai');
    console.log('✅ Connected to MongoDB');

    // Get the latest report template
    const ReportTemplate = require('./models/ReportTemplate');
    const template = await ReportTemplate.findOne({ isActive: true }).sort({ createdAt: -1 });
    
    if (!template) {
      console.log('❌ No active template found');
      return;
    }

    console.log('📋 Template Found:', template.name);
    console.log('📄 Template Content:');
    console.log(template.content);
    console.log('\n' + '='.repeat(80));

    // Test transcription
    const testTranscription = "Okay, so she used the word friend and she also used the word Water water bottle and she she's learning quickly and She ate apple and banana and she specifically asked to eat From cereal from her bowl using her own spoon. So she handled the spoon pretty well and They played with all the other kids with the blocks and other toys And she participated well all the time and she slept for one and a half or one Or 45 minutes to be precisely And please bring some more Diapers and wipes tomorrow. Thank you";

    console.log('📝 Test Transcription:');
    console.log(testTranscription);
    console.log('\n' + '='.repeat(80));

    // Manually parse template structure based on actual format
    console.log('🔍 Manually Parsing Template Structure...');
    const templateLines = template.content.split('\n');
    const sections = [];
    let currentSection = null;
    
    templateLines.forEach(line => {
      const trimmedLine = line.trim();
      
      // Check for section headers (lines ending with colon)
      if (trimmedLine.endsWith(':') && !trimmedLine.startsWith('Write the details about')) {
        const sectionTitle = trimmedLine.slice(0, -1); // Remove the colon
        currentSection = {
          title: sectionTitle,
          subsections: []
        };
        sections.push(currentSection);
        console.log(`📂 Found Section: ${sectionTitle}`);
      } 
      // Check for subsections (lines that look like subsection titles)
      else if (currentSection && trimmedLine.includes(':') && !trimmedLine.startsWith('Write the details about')) {
        const colonIndex = trimmedLine.indexOf(':');
        const subsectionTitle = trimmedLine.substring(0, colonIndex);
        const description = trimmedLine.substring(colonIndex + 1).trim();
        
        currentSection.subsections.push({
          title: subsectionTitle,
          description: description
        });
        console.log(`  📄 Found Subsection: ${subsectionTitle} - ${description}`);
      }
      // Check for "Write the details about" lines
      else if (trimmedLine.startsWith('Write the details about') && currentSection && currentSection.subsections.length > 0) {
        const lastSubsection = currentSection.subsections[currentSection.subsections.length - 1];
        lastSubsection.description = trimmedLine;
        console.log(`  📝 Updated Description: ${trimmedLine}`);
      }
    });

    console.log('\n📊 Parsed Template Structure:', JSON.stringify(sections, null, 2));

    // Test manual pattern matching
    console.log('\n🎯 Testing Manual Pattern Matching...');
    const transcriptionLower = testTranscription.toLowerCase();
    const mappedSections = [];

    sections.forEach(section => {
      section.subsections.forEach(subsection => {
        const sectionKey = subsection.title.toLowerCase();
        console.log(`\n🔍 Checking: ${subsection.title}`);
        console.log(`  📝 Description: ${subsection.description}`);
        
        // Define keywords for each section type
        let relevantKeywords = [];
        
        if (sectionKey.includes('language') || sectionKey.includes('communication') || sectionKey.includes('expressive') || sectionKey.includes('receptive')) {
          relevantKeywords = ['word', 'friend', 'water', 'bottle', 'learning', 'quickly', 'vocabulary', 'babbling'];
        } else if (sectionKey.includes('feeding') || sectionKey.includes('self-feeding') || sectionKey.includes('utensils')) {
          relevantKeywords = ['ate', 'apple', 'banana', 'cereal', 'spoon', 'bowl', 'handled', 'feeding'];
        } else if (sectionKey.includes('sleeping') || sectionKey.includes('sleep')) {
          relevantKeywords = ['slept', 'hours', 'minutes', 'nap', 'sleep'];
        } else if (sectionKey.includes('social') || sectionKey.includes('emotional') || sectionKey.includes('interactions')) {
          relevantKeywords = ['played', 'kids', 'participated', 'well', 'friend', 'interactions'];
        } else if (sectionKey.includes('work') || sectionKey.includes('concentration') || sectionKey.includes('engagement')) {
          relevantKeywords = ['participated', 'engaged', 'focused', 'concentration'];
        } else if (sectionKey.includes('diapering') || sectionKey.includes('toileting')) {
          relevantKeywords = ['diapers', 'wipes', 'toilet'];
        } else if (sectionKey.includes('movement') || sectionKey.includes('motor')) {
          relevantKeywords = ['handled', 'spoon', 'grasping', 'control'];
        } else if (sectionKey.includes('bring') || sectionKey.includes('supplies') || sectionKey.includes('checklist')) {
          relevantKeywords = ['bring', 'diapers', 'wipes', 'tomorrow', 'more'];
        }
        
        // Check for keyword matches
        const foundKeywords = relevantKeywords.filter(keyword => 
          transcriptionLower.includes(keyword)
        );
        
        console.log(`  🔑 Relevant Keywords: ${relevantKeywords.join(', ')}`);
        console.log(`  ✅ Found Keywords: ${foundKeywords.join(', ')}`);
        
        if (foundKeywords.length > 0) {
          // Extract relevant sentences
          const sentences = testTranscription.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
          const relevantSentences = sentences.filter(sentence => 
            foundKeywords.some(keyword => sentence.toLowerCase().includes(keyword))
          );
          
          console.log(`  📝 Relevant Sentences: ${relevantSentences.join(' | ')}`);
          
          mappedSections.push({
            sectionTitle: section.title,
            subsectionTitle: subsection.title,
            content: `Based on observations: ${relevantSentences.join('. ')}.`,
            evidence: relevantSentences.join(' ')
          });
        }
      });
    });

    console.log('\n📋 Final Mapped Sections:', JSON.stringify(mappedSections, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
testTemplateAnalysis(); 