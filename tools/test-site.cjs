/**
 * Relic Studios - Site Testing with Playwright
 * Tests all pages for functionality and captures screenshots
 *
 * Usage: node tools/test-site.cjs
 * Requirements: npx playwright install chromium
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:8001';
const SCREENSHOTS_DIR = './test-screenshots';

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function testSite() {
    console.log('\n🎭 Relic Studios Site Test\n');
    console.log('='.repeat(50));

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    const results = {
        passed: [],
        failed: [],
        warnings: []
    };

    // Test pages
    const pages = [
        { name: 'Home', url: '/', checks: ['RELIC', 'Gallery', 'Contact'] },
        { name: 'About', url: '/about.html', checks: ['About', 'Team', 'Aidan'] },
        { name: 'Get Involved', url: '/get-involved.html', checks: ['Get Involved', 'Community'] },
        { name: 'Google Verification', url: '/googled73baa92d3f7ebcd.html', checks: ['google-site-verification'] },
        { name: 'Robots.txt', url: '/robots.txt', checks: ['User-agent', 'Sitemap'] },
        { name: 'Sitemap.xml', url: '/sitemap.xml', checks: ['urlset', 'relicstudios.xyz'] }
    ];

    for (const pageInfo of pages) {
        console.log(`\n📄 Testing: ${pageInfo.name}`);

        try {
            const response = await page.goto(BASE_URL + pageInfo.url, {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            // Check status code
            if (response.status() === 200) {
                console.log(`   ✅ Status: ${response.status()}`);
                results.passed.push(`${pageInfo.name}: HTTP 200`);
            } else {
                console.log(`   ❌ Status: ${response.status()}`);
                results.failed.push(`${pageInfo.name}: HTTP ${response.status()}`);
            }

            // Check for content
            const content = await page.content();
            for (const check of pageInfo.checks) {
                if (content.includes(check)) {
                    console.log(`   ✅ Contains: "${check}"`);
                    results.passed.push(`${pageInfo.name}: Contains "${check}"`);
                } else {
                    console.log(`   ⚠️  Missing: "${check}"`);
                    results.warnings.push(`${pageInfo.name}: Missing "${check}"`);
                }
            }

            // Take screenshot (only for HTML pages)
            if (pageInfo.url.endsWith('.html') || pageInfo.url === '/') {
                const screenshotName = pageInfo.name.toLowerCase().replace(/\s+/g, '-') + '.png';
                await page.screenshot({
                    path: path.join(SCREENSHOTS_DIR, screenshotName),
                    fullPage: false
                });
                console.log(`   📸 Screenshot: ${screenshotName}`);
            }

            // Check for console errors
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    results.warnings.push(`${pageInfo.name}: Console error - ${msg.text()}`);
                }
            });

        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
            results.failed.push(`${pageInfo.name}: ${error.message}`);
        }
    }

    // Test Discord link
    console.log('\n🔗 Testing Discord Link');
    try {
        await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
        const discordLink = await page.$('a.discord-link');
        if (discordLink) {
            const href = await discordLink.getAttribute('href');
            if (href && href.includes('discord.gg')) {
                console.log(`   ✅ Discord link found: ${href}`);
                results.passed.push('Discord link present');
            }
        } else {
            console.log('   ⚠️  Discord link not found');
            results.warnings.push('Discord link not found');
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }

    // Test Google Analytics
    console.log('\n📊 Testing Google Analytics');
    try {
        await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
        const content = await page.content();
        if (content.includes('G-WX0FS6PZRV')) {
            console.log('   ✅ GA4 Measurement ID found');
            results.passed.push('GA4 configured');
        } else {
            console.log('   ⚠️  GA4 Measurement ID not found');
            results.warnings.push('GA4 not configured');
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }

    // Test SEO meta tags
    console.log('\n🔍 Testing SEO Meta Tags');
    try {
        await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });

        const metaDescription = await page.$('meta[name="description"]');
        const ogTitle = await page.$('meta[property="og:title"]');
        const twitterCard = await page.$('meta[name="twitter:card"]');
        const canonical = await page.$('link[rel="canonical"]');

        if (metaDescription) {
            console.log('   ✅ Meta description present');
            results.passed.push('Meta description');
        }
        if (ogTitle) {
            console.log('   ✅ Open Graph tags present');
            results.passed.push('Open Graph tags');
        }
        if (twitterCard) {
            console.log('   ✅ Twitter Card tags present');
            results.passed.push('Twitter Card tags');
        }
        if (canonical) {
            console.log('   ✅ Canonical URL present');
            results.passed.push('Canonical URL');
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }

    await browser.close();

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📋 Test Summary\n');
    console.log(`   ✅ Passed:   ${results.passed.length}`);
    console.log(`   ⚠️  Warnings: ${results.warnings.length}`);
    console.log(`   ❌ Failed:   ${results.failed.length}`);

    if (results.failed.length > 0) {
        console.log('\n❌ Failed Tests:');
        results.failed.forEach(f => console.log(`   - ${f}`));
    }

    if (results.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        results.warnings.forEach(w => console.log(`   - ${w}`));
    }

    console.log(`\n📸 Screenshots saved to: ${SCREENSHOTS_DIR}/`);
    console.log('\n');

    // Return exit code
    process.exit(results.failed.length > 0 ? 1 : 0);
}

testSite().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
