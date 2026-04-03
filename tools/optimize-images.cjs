/**
 * Relic Studios - Image Optimization Tool
 * Converts images to WebP, generates multiple sizes, and creates manifest
 *
 * Usage: node tools/optimize-images.js
 * Requirements: npm install sharp glob
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is installed
let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.log('\x1b[33m%s\x1b[0m', '⚠️  Sharp not installed. Run: npm install sharp glob');
    console.log('\nThis tool will:');
    console.log('  • Convert all images to WebP format (50-80% smaller)');
    console.log('  • Generate responsive sizes (thumbnail, medium, large)');
    console.log('  • Create optimized versions for mobile devices');
    console.log('  • Generate a manifest for easy integration\n');
    process.exit(1);
}

const { glob } = require('glob');

// Configuration
const CONFIG = {
    inputDir: './assets/images',
    outputDir: './assets/images/optimized',
    sizes: [
        { name: 'thumb', width: 400, quality: 80 },
        { name: 'medium', width: 800, quality: 85 },
        { name: 'large', width: 1200, quality: 85 },
        { name: 'full', width: 1920, quality: 90 }
    ],
    formats: ['webp', 'jpg'], // WebP primary, JPG fallback
    skipPatterns: ['optimized', 'original_backup', 'video-thumbnails']
};

// Ensure output directory exists
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Get all images
async function getImages() {
    const patterns = ['jpg', 'jpeg', 'png', 'webp'].map(ext =>
        `${CONFIG.inputDir}/**/*.${ext}`
    );

    let files = [];
    for (const pattern of patterns) {
        const matches = await glob(pattern, {
            ignore: CONFIG.skipPatterns.map(p => `**/${p}/**`)
        });
        files = files.concat(matches);
    }

    return [...new Set(files)]; // Remove duplicates
}

// Optimize single image
async function optimizeImage(inputPath) {
    const filename = path.basename(inputPath, path.extname(inputPath));
    const relativePath = path.relative(CONFIG.inputDir, path.dirname(inputPath));
    const outputBase = path.join(CONFIG.outputDir, relativePath);

    ensureDir(outputBase);

    const results = [];
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    console.log(`  Processing: ${path.basename(inputPath)} (${metadata.width}x${metadata.height})`);

    for (const size of CONFIG.sizes) {
        // Skip if original is smaller than target
        if (metadata.width < size.width) continue;

        // Generate WebP (primary)
        const webpOutput = path.join(outputBase, `${filename}-${size.name}.webp`);
        await sharp(inputPath)
            .resize(size.width, null, { withoutEnlargement: true })
            .webp({ quality: size.quality })
            .toFile(webpOutput);

        // Generate JPG fallback
        const jpgOutput = path.join(outputBase, `${filename}-${size.name}.jpg`);
        await sharp(inputPath)
            .resize(size.width, null, { withoutEnlargement: true })
            .jpeg({ quality: size.quality, progressive: true })
            .toFile(jpgOutput);

        const webpStats = fs.statSync(webpOutput);
        const jpgStats = fs.statSync(jpgOutput);

        results.push({
            size: size.name,
            width: size.width,
            webp: {
                path: webpOutput.replace(/\\/g, '/'),
                size: webpStats.size
            },
            jpg: {
                path: jpgOutput.replace(/\\/g, '/'),
                size: jpgStats.size
            }
        });
    }

    return {
        original: inputPath.replace(/\\/g, '/'),
        originalSize: fs.statSync(inputPath).size,
        dimensions: { width: metadata.width, height: metadata.height },
        optimized: results
    };
}

// Calculate savings
function calculateSavings(manifest) {
    let originalTotal = 0;
    let optimizedTotal = 0;

    manifest.forEach(item => {
        originalTotal += item.originalSize;
        const largestOptimized = item.optimized.find(o => o.size === 'large' || o.size === 'full');
        if (largestOptimized) {
            optimizedTotal += largestOptimized.webp.size;
        }
    });

    const savings = ((originalTotal - optimizedTotal) / originalTotal * 100).toFixed(1);
    return {
        original: (originalTotal / 1024 / 1024).toFixed(2) + ' MB',
        optimized: (optimizedTotal / 1024 / 1024).toFixed(2) + ' MB',
        savings: savings + '%'
    };
}

// Generate HTML helper for responsive images
function generatePictureElement(item) {
    const filename = path.basename(item.original, path.extname(item.original));
    const large = item.optimized.find(o => o.size === 'large');
    const medium = item.optimized.find(o => o.size === 'medium');
    const thumb = item.optimized.find(o => o.size === 'thumb');

    return `<picture>
    <source
        type="image/webp"
        srcset="${thumb?.webp.path} 400w,
                ${medium?.webp.path} 800w,
                ${large?.webp.path} 1200w"
        sizes="(max-width: 400px) 400px,
               (max-width: 800px) 800px,
               1200px">
    <img
        src="${large?.jpg.path}"
        alt="${filename}"
        width="${item.dimensions.width}"
        height="${item.dimensions.height}"
        loading="lazy"
        decoding="async">
</picture>`;
}

// Main execution
async function main() {
    console.log('\n🖼️  Relic Studios Image Optimizer\n');
    console.log('=' .repeat(50));

    const images = await getImages();
    console.log(`\nFound ${images.length} images to optimize\n`);

    if (images.length === 0) {
        console.log('No images found in', CONFIG.inputDir);
        return;
    }

    ensureDir(CONFIG.outputDir);

    const manifest = [];

    for (const imagePath of images) {
        try {
            const result = await optimizeImage(imagePath);
            manifest.push(result);
        } catch (error) {
            console.error(`  ❌ Error processing ${imagePath}:`, error.message);
        }
    }

    // Save manifest
    const manifestPath = path.join(CONFIG.outputDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // Generate HTML snippets
    const snippetsPath = path.join(CONFIG.outputDir, 'html-snippets.html');
    const snippets = manifest.map(generatePictureElement).join('\n\n');
    fs.writeFileSync(snippetsPath, `<!-- Responsive Image Snippets -->\n\n${snippets}`);

    // Summary
    const stats = calculateSavings(manifest);
    console.log('\n' + '=' .repeat(50));
    console.log('✅ Optimization Complete!\n');
    console.log(`  📁 Original size:  ${stats.original}`);
    console.log(`  📦 Optimized size: ${stats.optimized}`);
    console.log(`  💾 Savings:        ${stats.savings}`);
    console.log(`\n  📄 Manifest: ${manifestPath}`);
    console.log(`  📝 HTML Snippets: ${snippetsPath}`);
    console.log('\n');
}

main().catch(console.error);
