const axios = require('axios');
require('dotenv').config();

async function testAIGeneration() {
  console.log('🧪 Testing AI Report Generation with Recent Fixes...\n');

  const testData = {
    studentName: 'Test Student',
    grade: 'Infant',
    transcription: 'Okay, so she used the word friend and she also used the word Water water bottle and she she\'s learning quickly and She ate apple and banana and she specifically asked to eat From cereal from her bowl using her own spoon. So she handled the spoon pretty well and They played with all the other kids with the blocks and other toys And she participated well all the time and she slept for one and a half or one Or 45 minutes to be precisely And please bring some more Diapers and wipes tomorrow. Thank you',
    templateId: '68978083c452e242467774db', // Use the actual template ID
    schoolId: '68960451f58dff7d009df46e'
  };

  try {
    console.log('📝 Test Data:');
    console.log('- Student:', testData.studentName);
    console.log('- Grade:', testData.grade);
    console.log('- Transcription:', testData.transcription);
    console.log('- Template ID:', testData.templateId);
    console.log('- School ID:', testData.schoolId);
    console.log('\n🚀 Making AI generation request...\n');

    const response = await axios.post('http://localhost:5050/api/ai/generate-report', {
      studentName: testData.studentName,
      grade: testData.grade,
      transcription: testData.transcription,
      templateId: testData.templateId,
      schoolId: testData.schoolId
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    });

    console.log('✅ AI Generation Response:');
    console.log('Status:', response.status);
    console.log('Full Response Data:', JSON.stringify(response.data, null, 2));
    console.log('Content Length:', response.data.data ? response.data.data.length : 'undefined');
    
    if (response.data.data) {
      console.log('\n📄 Generated Report Content:');
      console.log('=' .repeat(80));
      console.log(response.data.data);
      console.log('=' .repeat(80));

      // Analyze the content
      console.log('\n🔍 Content Analysis:');
      const content = response.data.data;
      
      // Check if transcription is included
      if (content.includes(testData.transcription)) {
        console.log('✅ Transcription is included in the report');
      } else {
        console.log('❌ Transcription is NOT included in the report');
      }

      // Check for empty sections
      const emptySections = content.match(/\*No specific observations recorded for this area\.\*/g);
      if (emptySections) {
        console.log(`⚠️  Found ${emptySections.length} empty sections`);
      } else {
        console.log('✅ No empty sections found');
      }

      // Check for AI-generated content
      if (content.includes('AI-Generated') || content.includes('Teacher Observations')) {
        console.log('✅ AI-generated content detected');
      } else {
        console.log('❌ No AI-generated content markers found');
      }

      // Check for relevant keywords from transcription
      const keywords = ['friend', 'water', 'apple', 'banana', 'spoon', 'play', 'sleep', 'diapers', 'participated'];
      const foundKeywords = keywords.filter(keyword => 
        content.toLowerCase().includes(keyword.toLowerCase())
      );
      console.log(`✅ Found ${foundKeywords.length}/${keywords.length} keywords from transcription:`, foundKeywords);

      // Check for specific sections
      const sections = ['Practical Life', 'Language', 'Social-Emotional', 'Work Cycle', 'Please Bring More'];
      sections.forEach(section => {
        if (content.includes(section)) {
          console.log(`✅ Section "${section}" found`);
        } else {
          console.log(`❌ Section "${section}" not found`);
        }
      });
    } else {
      console.log('❌ No content in response');
    }

  } catch (error) {
    console.error('❌ Error testing AI generation:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the test
testAIGeneration(); 