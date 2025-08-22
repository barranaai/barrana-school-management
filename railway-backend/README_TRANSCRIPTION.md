# Audio Transcription Setup

This document explains how to set up the audio transcription service for the Barrana AI application.

## Prerequisites

1. **OpenAI API Key**: You need a valid OpenAI API key to use the Whisper transcription service.
2. **Node.js Dependencies**: Make sure you have installed the required dependencies.

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install openai multer
```

### 2. Configure Environment Variables

Create a `.env` file in the backend directory or set the following environment variable:

```bash
OPENAI_API_KEY=your-openai-api-key-here
```

You can get an OpenAI API key by:
1. Going to https://platform.openai.com/
2. Creating an account or signing in
3. Going to the API Keys section
4. Creating a new API key

### 3. Test the Transcription Service

To test if the transcription service is working:

1. Start the backend server:
   ```bash
   cd backend
   npm start
   ```

2. Use the mobile app to record audio and test transcription

3. Check the server logs for transcription results

## How It Works

1. **Mobile App**: Records audio using Expo's Audio API
2. **File Upload**: Audio file is uploaded to the backend via FormData
3. **OpenAI Whisper**: The backend uses OpenAI's Whisper model to transcribe the audio
4. **Response**: The transcription is returned to the mobile app

## API Endpoint

- **URL**: `POST /api/ai/process-voice`
- **Content-Type**: `multipart/form-data`
- **Parameters**:
  - `audio`: Audio file (required)
  - `studentName`: Name of the student (optional)
  - `language`: Language code (optional, defaults to 'en')

## Error Handling

The service handles various error scenarios:

- **No API Key**: Returns error if OpenAI API key is not configured
- **No Audio File**: Returns error if no audio file is provided
- **Invalid File Type**: Only accepts audio files
- **File Size Limit**: Maximum 25MB per file
- **Transcription Errors**: Handles OpenAI API errors gracefully

## Troubleshooting

### Common Issues

1. **"Transcription service not configured"**
   - Make sure you have set the `OPENAI_API_KEY` environment variable
   - Restart the server after setting the environment variable

2. **"No audio file provided"**
   - Make sure the mobile app is sending the audio file correctly
   - Check that the file field name is 'audio'

3. **"Only audio files are allowed"**
   - Make sure the mobile app is recording in a supported audio format
   - Supported formats: m4a, wav, mp3, etc.

4. **"File too large"**
   - The audio file is larger than 25MB
   - Try recording a shorter audio clip

### Debug Logs

The server provides detailed logging for debugging:

- Audio file processing steps
- OpenAI API calls
- Transcription results
- Error messages

Check the server console for these logs when testing.

## Cost Considerations

- OpenAI Whisper API has usage costs
- Pricing: $0.006 per minute of audio
- Monitor your OpenAI usage to control costs

## Security

- Audio files are temporarily stored and automatically deleted after processing
- No audio data is permanently stored on the server
- API keys should be kept secure and not committed to version control 