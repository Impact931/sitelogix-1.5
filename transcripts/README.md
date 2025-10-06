# Testing with Local Transcript Files

## Quick Start

1. **Place your .txt transcript files in this folder**
   - Name them descriptively (e.g., `sample1.txt`, `building210-report.txt`)
   - Format: One message per line with "Speaker: Message" format

2. **Run the batch processor:**
   ```bash
   node process-batch-transcripts.js
   ```

## Transcript File Format

Your .txt files should follow this format:

```
Manager: Good morning, this is the daily report for Building 210.
Roxy: Good morning! I'm ready to take your daily report. Let's start with personnel.
Manager: We had 15 people on site today.
Roxy: Great! Can you list their names and positions?
Manager: Aaron Trask was the project manager, Roger Brake was foreman...
```

### Supported Formats:
- `Speaker: Message` - Best format (automatically detects Manager vs Roxy)
- Plain text - Each line becomes a user message

### Tips:
- Speaker names should be "Manager", "Roxy", or similar
- One message per line
- Empty lines are ignored

## Project and Manager Mapping

When processing, you can specify:
- **Project ID**: `proj_001` (Building 210) or `proj_002` (Columbus Office)
- **Manager ID**: `001` (Aaron Trask) or `002` (Corey Birchfield)

The batch processor will prompt you for these if not specified in the filename.

## Example Filenames

The batch processor can auto-detect from filenames:
- `sample1_proj001_mgr001.txt` → Project 001, Manager 001
- `building210_aaron.txt` → You'll be prompted to confirm
- `report-2025-10-05.txt` → You'll be prompted

