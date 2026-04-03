const { chromium } = require('playwright');

async function checkSite() {
    console.log('\n🔍 Checking live site for errors...\n');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    const errors = [];
    const warnings = [];

    // Capture console messages
    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(msg.text());
        } else if (msg.type() === 'warning') {
            warnings.push(msg.text());
        }
    });

    // Capture page errors
    page.on('pageerror', err => {
        errors.push(err.message);
    });

    // Capture failed requests
    page.on('requestfailed', request => {
        errors.push(`Failed to load: ${request.url()} - ${request.failure().errorText}`);
    });

    try {
        console.log('Loading https://relicstudios.netlify.app ...');
        await page.goto('https://relicstudios.netlify.app', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        // Wait a bit for scripts to execute
        await page.waitForTimeout(5000);

        // Check if Three.js canvas exists
        const canvas = await page.$('canvas');
        if (canvas) {
            console.log('✅ Canvas element found');
        } else {
            console.log('❌ Canvas element NOT found');
        }

        // Check if main content loaded
        const logo = await page.$('.home-logo');
        if (logo) {
            console.log('✅ Home logo found');
        } else {
            console.log('❌ Home logo NOT found');
        }

        // Take screenshot
        await page.screenshot({ path: './test-screenshots/live-site.png', fullPage: false });
        console.log('📸 Screenshot saved to ./test-screenshots/live-site.png');

    } catch (error) {
        console.log('❌ Page load error:', error.message);
    }

    await browser.close();

    // Report
    console.log('\n' + '='.repeat(50));
    if (errors.length > 0) {
        console.log(`\n❌ ${errors.length} Errors found:\n`);
        errors.forEach((e, i) => console.log(`${i + 1}. ${e}`));
    } else {
        console.log('\n✅ No JavaScript errors detected');
    }

    if (warnings.length > 0) {
        console.log(`\n⚠️ ${warnings.length} Warnings:\n`);
        warnings.slice(0, 10).forEach((w, i) => console.log(`${i + 1}. ${w}`));
    }

    console.log('\n');
}

checkSite().catch(console.error);
