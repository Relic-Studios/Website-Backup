/**
 * Lighthouse CI Configuration
 * Run: npx lhci autorun
 *
 * This configuration defines performance budgets and thresholds
 * that your site should meet for optimal SEO and user experience.
 */

module.exports = {
  ci: {
    collect: {
      // URLs to test
      url: [
        'http://localhost:8001/',
        'http://localhost:8001/about.html',
        'http://localhost:8001/get-involved.html'
      ],
      // Number of runs per URL (more runs = more reliable data)
      numberOfRuns: 3,
      // Start a local server for testing
      startServerCommand: 'npx http-server . -p 8001',
      startServerReadyPattern: 'Available on',
      startServerReadyTimeout: 10000,
      // Chrome flags for consistent testing
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox --headless'
      }
    },
    assert: {
      // Performance budgets - these are the targets to hit
      assertions: {
        // Core Web Vitals
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],

        // Category scores (0-1 scale)
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],

        // Specific audits
        'meta-description': 'error',
        'document-title': 'error',
        'html-has-lang': 'error',
        'meta-viewport': 'error',
        'image-alt': 'warn',
        'link-text': 'warn',

        // Performance specific
        'uses-responsive-images': 'warn',
        'uses-webp-images': 'warn',
        'render-blocking-resources': 'warn',
        'uses-text-compression': 'warn',
        'uses-rel-preconnect': 'warn'
      }
    },
    upload: {
      // Save reports locally
      target: 'filesystem',
      outputDir: './lighthouse-reports',
      reportFilenamePattern: '%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%'
    }
  }
};
