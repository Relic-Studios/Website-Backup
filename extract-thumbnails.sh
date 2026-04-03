#!/bin/bash
# Video Thumbnail Extraction Script
# Extracts first frame from all MP4 videos in assets/videos/

echo "======================================"
echo "Video Thumbnail Extraction"
echo "======================================"
echo ""

# Navigate to videos directory
cd "$(dirname "$0")/assets/videos" || exit

# Count videos
video_count=$(ls -1 *.mp4 2>/dev/null | wc -l)

if [ "$video_count" -eq 0 ]; then
    echo "❌ No MP4 videos found in assets/videos/"
    exit 1
fi

echo "Found $video_count video(s) to process"
echo ""

# Create thumbnails directory if it doesn't exist
mkdir -p "../images/video-thumbnails"

# Counter for progress
count=0

# Process each video
for video in *.mp4; do
    count=$((count + 1))
    name="${video%.*}"
    output="../images/video-thumbnails/${name}.jpg"

    echo "[$count/$video_count] Processing: $video"

    # Extract first frame
    ffmpeg -i "$video" -vframes 1 -q:v 2 "$output" -y 2>&1 | grep -E "(Duration|frame=)" || true

    if [ -f "$output" ]; then
        echo "  ✅ Created: $name.jpg"
    else
        echo "  ❌ Failed to create thumbnail"
    fi
    echo ""
done

echo "======================================"
echo "✅ Extraction complete!"
echo "======================================"
echo ""
echo "Thumbnails saved to: assets/images/video-thumbnails/"
echo ""
echo "Next steps:"
echo "1. Update js/main.js with new video entries"
echo "2. Use format: thumbnail: 'assets/images/video-thumbnails/filename.jpg'"
echo "3. Hard refresh browser (Ctrl+F5) to see changes"
