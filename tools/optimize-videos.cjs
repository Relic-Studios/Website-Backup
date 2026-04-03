/**
 * Relic Studios - Video Optimization Tool
 * Generates poster images and provides compression recommendations
 *
 * Usage: node tools/optimize-videos.js
 * Requirements: npm install fluent-ffmpeg glob
 * System requirement: FFmpeg must be installed
 */

const fs = require('fs');
const path = require('path');

// Check dependencies
let ffmpeg, glob;
try {
    ffmpeg = require('fluent-ffmpeg');
    glob = require('glob').glob;
} catch (e) {
    console.log('\x1b[33m%s\x1b[0m', '⚠️  Dependencies not installed.');
    console.log('\nRun: npm install fluent-ffmpeg glob');
    console.log('\nAlso ensure FFmpeg is installed on your system:');
    console.log('  • Windows: choco install ffmpeg  OR  download from ffmpeg.org');
    console.log('  • Mac: brew install ffmpeg');
    console.log('  • Linux: sudo apt install ffmpeg\n');
    process.exit(1);
}

// Configuration
const CONFIG = {
    videoDir: './assets/videos',
    posterDir: './assets/images/video-thumbnails',
    posterTime: '00:00:01', // Capture frame at 1 second
    posterWidth: 1280,
    skipPatterns: ['original_backup']
};

// Ensure directory exists
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Get all videos
async function getVideos() {
    const patterns = ['mp4', 'mov', 'webm'].map(ext =>
        `${CONFIG.videoDir}/**/*.${ext}`
    );

    let files = [];
    for (const pattern of patterns) {
        const matches = await glob(pattern, {
            ignore: CONFIG.skipPatterns.map(p => `**/${p}/**`)
        });
        files = files.concat(matches);
    }

    return [...new Set(files)];
}

// Get video metadata
function getVideoInfo(videoPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) reject(err);
            else resolve(metadata);
        });
    });
}

// Generate poster image
function generatePoster(videoPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .screenshots({
                timestamps: [CONFIG.posterTime],
                filename: path.basename(outputPath),
                folder: path.dirname(outputPath),
                size: `${CONFIG.posterWidth}x?`
            })
            .on('end', () => resolve(outputPath))
            .on('error', reject);
    });
}

// Format file size
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// Format duration
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Generate compression recommendations
function getCompressionRecommendation(info, fileSize) {
    const video = info.streams.find(s => s.codec_type === 'video');
    const bitrate = video?.bit_rate ? parseInt(video.bit_rate) : (fileSize * 8 / info.format.duration);
    const bitrateKbps = bitrate / 1000;

    let recommendation = {
        status: 'optimal',
        message: 'Video is well optimized',
        command: null
    };

    // Recommendations based on resolution and bitrate
    if (bitrateKbps > 8000) {
        recommendation = {
            status: 'high',
            message: `High bitrate (${Math.round(bitrateKbps)} kbps). Consider compression.`,
            command: `ffmpeg -i "${path.basename(info.format.filename)}" -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k "output_compressed.mp4"`
        };
    } else if (bitrateKbps > 5000 && video?.width > 1920) {
        recommendation = {
            status: 'medium',
            message: `Could reduce resolution for web (currently ${video.width}x${video.height})`,
            command: `ffmpeg -i "${path.basename(info.format.filename)}" -vf "scale=1920:-2" -c:v libx264 -crf 23 -c:a aac "output_1080p.mp4"`
        };
    }

    return recommendation;
}

// Main execution
async function main() {
    console.log('\n🎬 Relic Studios Video Optimizer\n');
    console.log('='.repeat(50));

    ensureDir(CONFIG.posterDir);

    const videos = await getVideos();
    console.log(`\nFound ${videos.length} videos to process\n`);

    if (videos.length === 0) {
        console.log('No videos found in', CONFIG.videoDir);
        return;
    }

    const results = [];

    for (const videoPath of videos) {
        const filename = path.basename(videoPath, path.extname(videoPath));
        console.log(`\n📹 Processing: ${path.basename(videoPath)}`);

        try {
            // Get video info
            const info = await getVideoInfo(videoPath);
            const video = info.streams.find(s => s.codec_type === 'video');
            const fileSize = fs.statSync(videoPath).size;

            console.log(`   Resolution: ${video?.width}x${video?.height}`);
            console.log(`   Duration: ${formatDuration(info.format.duration)}`);
            console.log(`   Size: ${formatSize(fileSize)}`);

            // Generate poster
            const posterPath = path.join(CONFIG.posterDir, `${filename}.jpg`);
            if (!fs.existsSync(posterPath)) {
                console.log('   Generating poster image...');
                await generatePoster(videoPath, posterPath);
                console.log(`   ✅ Poster: ${posterPath}`);
            } else {
                console.log(`   ✅ Poster exists: ${posterPath}`);
            }

            // Get compression recommendation
            const recommendation = getCompressionRecommendation(info, fileSize);

            results.push({
                video: videoPath,
                poster: posterPath,
                width: video?.width,
                height: video?.height,
                duration: info.format.duration,
                size: fileSize,
                recommendation
            });

            if (recommendation.status !== 'optimal') {
                console.log(`   ⚠️  ${recommendation.message}`);
            }

        } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
        }
    }

    // Generate summary report
    const reportPath = './tools/video-optimization-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ Video Processing Complete!\n');

    const needsOptimization = results.filter(r => r.recommendation.status !== 'optimal');
    if (needsOptimization.length > 0) {
        console.log(`⚠️  ${needsOptimization.length} videos could benefit from compression:\n`);
        needsOptimization.forEach(v => {
            console.log(`   • ${path.basename(v.video)}`);
            console.log(`     ${v.recommendation.message}`);
            if (v.recommendation.command) {
                console.log(`     Command: ${v.recommendation.command}\n`);
            }
        });
    } else {
        console.log('All videos are optimally compressed! 🎉');
    }

    console.log(`\n📄 Full report: ${reportPath}\n`);
}

main().catch(console.error);
