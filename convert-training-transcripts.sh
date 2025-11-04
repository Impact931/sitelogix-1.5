#!/bin/bash

# Convert Training Transcripts from DOCX to TXT
# Converts all .docx files in training reports to .txt format for processing

set -e

SOURCE_DIR="transcripts/training reports"
OUTPUT_DIR="transcripts/training-txt"

echo "================================================"
echo "📄 Training Transcript Converter"
echo "================================================"
echo ""
echo "Source: $SOURCE_DIR"
echo "Output: $OUTPUT_DIR"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Count total files
TOTAL_FILES=$(find "$SOURCE_DIR" -name "*.docx" -type f | wc -l | tr -d ' ')
echo "📊 Found $TOTAL_FILES .docx files to convert"
echo ""

# Statistics
CONVERTED=0
FAILED=0
SKIPPED=0

# Convert each file
echo "🚀 Starting conversion..."
echo ""

find "$SOURCE_DIR" -name "*.docx" -type f | sort | while read -r docx_file; do
    # Get filename without path and extension
    filename=$(basename "$docx_file" .docx)

    # Output txt file path
    txt_file="$OUTPUT_DIR/${filename}.txt"

    # Skip if already converted
    if [ -f "$txt_file" ]; then
        echo "⏭️  Skipping (already exists): $filename"
        ((SKIPPED++)) 2>/dev/null || true
        continue
    fi

    echo "📝 Converting: $filename"

    # Convert using textutil
    if textutil -convert txt -output "$txt_file" "$docx_file" 2>/dev/null; then
        echo "   ✅ Converted successfully"
        ((CONVERTED++)) 2>/dev/null || true
    else
        echo "   ❌ Conversion failed"
        ((FAILED++)) 2>/dev/null || true
    fi

    echo ""
done

# Final count (re-count since subshell variables don't persist)
CONVERTED_COUNT=$(find "$OUTPUT_DIR" -name "*.txt" -type f | wc -l | tr -d ' ')

echo "================================================"
echo "📊 Conversion Summary"
echo "================================================"
echo "Total Files:     $TOTAL_FILES"
echo "✅ Converted:     $CONVERTED_COUNT"
echo "❌ Failed:        $(($TOTAL_FILES - $CONVERTED_COUNT))"
echo ""
echo "✅ Output Directory: $OUTPUT_DIR"
echo "================================================"
echo ""

# Show sample of converted files
echo "📄 Sample of converted files:"
ls -lh "$OUTPUT_DIR" | head -10
echo ""

echo "✅ Conversion Complete!"
echo ""
echo "Next steps:"
echo "1. Review converted .txt files"
echo "2. Upload to S3 using: node batch-process-transcripts.js \"$OUTPUT_DIR\""
echo ""
