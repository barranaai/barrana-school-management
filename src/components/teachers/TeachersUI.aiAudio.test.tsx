import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.resolve(__dirname, 'TeachersUI.tsx'), 'utf8');
const transcriptionWorkflow = source.slice(
  source.indexOf('const transcribeAudio = async () =>'),
  source.indexOf('// AI Report Generation function')
);

describe('legacy TeachersUI audio transcription contract', () => {
  it('validates and forwards the selected participant ID without sending a child name', () => {
    expect(transcriptionWorkflow).toContain("typeof selectedStudent.id === 'string' ? selectedStudent.id.trim() : ''");
    expect(transcriptionWorkflow).toContain("if (!participantId)");
    expect(transcriptionWorkflow).toContain('studentId: participantId');
    expect(transcriptionWorkflow).not.toContain('studentName:');
  });

  it('stops before transcription and gives safe feedback when participant context is missing', () => {
    expect(transcriptionWorkflow).toMatch(/if \(!participantId\)\s*{[\s\S]*toast\.error\('A valid participant record is required before transcription\.'\);[\s\S]*return;/);
    expect(transcriptionWorkflow.indexOf('if (!participantId)')).toBeLessThan(
      transcriptionWorkflow.indexOf('aiService.transcribeAudio')
    );
  });

  it('uses generic failure feedback without logging child or transcription details', () => {
    expect(transcriptionWorkflow).toContain("toast.error('Transcription failed. Please try again.')");
    expect(transcriptionWorkflow).not.toMatch(/console\.(log|warn|error)/);
  });
});
