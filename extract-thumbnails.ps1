# Video Thumbnail Extraction Script (PowerShell)
# Extracts first frame from all MP4 videos in assets/videos/

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Video Thumbnail Extraction" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory and navigate to videos folder
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$videosDir = Join-Path $scriptDir "assets\videos"
$thumbnailsDir = Join-Path $scriptDir "assets\images\video-thumbnails"

if (-not (Test-Path $videosDir)) {
    Write-Host "❌ Videos directory not found: $videosDir" -ForegroundColor Red
    exit 1
}

# Create thumbnails directory if it doesn't exist
if (-not (Test-Path $thumbnailsDir)) {
    New-Item -ItemType Directory -Path $thumbnailsDir | Out-Null
    Write-Host "✅ Created thumbnails directory" -ForegroundColor Green
}

# Get all MP4 files
$videos = Get-ChildItem -Path $videosDir -Filter "*.mp4"
$videoCount = $videos.Count

if ($videoCount -eq 0) {
    Write-Host "❌ No MP4 videos found in $videosDir" -ForegroundColor Red
    exit 1
}

Write-Host "Found $videoCount video(s) to process" -ForegroundColor Yellow
Write-Host ""

# Counter for progress
$count = 0

# Process each video
foreach ($video in $videos) {
    $count++
    $name = $video.BaseName
    $inputPath = $video.FullName
    $outputPath = Join-Path $thumbnailsDir "$name.jpg"

    Write-Host "[$count/$videoCount] Processing: $($video.Name)" -ForegroundColor Cyan

    # Extract first frame using ffmpeg
    $ffmpegArgs = @(
        "-i", "`"$inputPath`"",
        "-vframes", "1",
        "-q:v", "2",
        "`"$outputPath`"",
        "-y"
    )

    $process = Start-Process -FilePath "ffmpeg" -ArgumentList $ffmpegArgs -NoNewWindow -Wait -PassThru

    if (Test-Path $outputPath) {
        $size = (Get-Item $outputPath).Length
        $sizeKB = [math]::Round($size / 1KB, 2)
        Write-Host "  ✅ Created: $name.jpg ($sizeKB KB)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Failed to create thumbnail" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "✅ Extraction complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Thumbnails saved to: $thumbnailsDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Update js/main.js with new video entries"
Write-Host "2. Use format: thumbnail: 'assets/images/video-thumbnails/filename.jpg'"
Write-Host "3. Hard refresh browser (Ctrl+F5) to see changes"
Write-Host ""
