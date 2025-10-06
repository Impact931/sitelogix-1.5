# Audio Format Notes - SiteLogix

## Current Format: WebM (Opus codec)

### Why WebM?
- **Native format** from ElevenLabs Conversational AI
- **Smaller file size** - Opus codec provides better compression than MP3 at similar quality
- **Optimized for voice** - Opus is specifically designed for speech
- **Web-native** - All modern browsers support WebM/Opus playback
- **No conversion needed** - Direct from API to storage

### File Size Comparison (approximate for 5-minute conversation):
- **WebM/Opus**: ~2 MB (current)
- **MP3 (128kbps)**: ~5 MB
- **MP3 (64kbps)**: ~2.5 MB

### Browser Support:
✅ Chrome, Edge, Firefox, Safari (iOS 14.5+), Opera

## MP3 Conversion Option

If MP3 format is required for compatibility or specific tools:

### Client-Side Conversion
Would require:
1. Install FFmpeg.wasm library (`npm install @ffmpeg/ffmpeg`)
2. Convert in browser before upload
3. Increases page load time and client-side processing

### Server-Side Conversion
Better approach:
1. Upload WebM to S3 as-is (fastest)
2. Use AWS Lambda with FFmpeg layer to convert on-demand
3. Store both formats or convert only when needed

### Backend Lambda Function Example:
```typescript
// Lambda function triggered by S3 upload
// Converts WebM to MP3 and stores alongside original
```

## Recommendation

**Keep WebM as primary format** because:
1. 50% smaller file size saves storage costs
2. No processing delay (no conversion needed)
3. Better quality at same bitrate
4. Web playback works everywhere
5. Can convert to MP3 later if specific use case requires it

## ElevenLabs API Notes

- Conversational AI returns **WebM/Opus** only
- Text-to-Speech API supports MP3 with `output_format` parameter
- Conversation audio endpoint: `GET /v1/convai/conversations/{id}/audio`
- Returns: `audio/webm` content-type

## Current Implementation

```typescript
// Files stored as:
SITELOGIX/projects/{projectId}/reports/{YYYY}/{MM}/{DD}/{reportId}/audio.webm

// DynamoDB reference:
audio_s3_path: "s3://sitelogix-prod/SITELOGIX/.../audio.webm"
```

## Future Enhancement Ideas

1. **Dual format storage** - Store both WebM and MP3
2. **On-demand conversion** - Convert to MP3 only when requested
3. **Transcoding pipeline** - Batch convert older recordings
4. **Format preference** - Allow users to choose download format

## Update History

- **2025-10-05**: Initial implementation with WebM format
- Audio download retry logic: 6 attempts × 5 seconds = 30s max
- Initial delay after conversation: 8 seconds
