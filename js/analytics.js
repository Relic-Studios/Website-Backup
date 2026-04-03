/**
 * Relic Studios - Analytics & Performance Monitoring
 * Tracks Core Web Vitals, user interactions, and sends to Google Analytics
 */

(function() {
    'use strict';

    // Configuration - Update with your GA4 Measurement ID
    const CONFIG = {
        GA_MEASUREMENT_ID: 'G-WX0FS6PZRV', // Replace with your actual GA4 ID
        enableWebVitals: true,
        enableScrollTracking: true,
        enableVideoTracking: true,
        debug: false
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        if (CONFIG.debug) console.log('Analytics initialized');

        // Track Core Web Vitals
        if (CONFIG.enableWebVitals) {
            trackWebVitals();
        }

        // Track scroll depth
        if (CONFIG.enableScrollTracking) {
            trackScrollDepth();
        }

        // Track video engagement
        if (CONFIG.enableVideoTracking) {
            trackVideoEngagement();
        }

        // Track outbound links
        trackOutboundLinks();

        // Track page visibility
        trackPageVisibility();
    }

    /**
     * Core Web Vitals Tracking
     * Measures LCP, FID/INP, and CLS
     */
    function trackWebVitals() {
        // Largest Contentful Paint (LCP)
        if ('PerformanceObserver' in window) {
            try {
                // LCP Observer
                const lcpObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    const lcpValue = Math.round(lastEntry.startTime);

                    if (CONFIG.debug) console.log('LCP:', lcpValue, 'ms');

                    sendToAnalytics('web_vitals', {
                        metric_name: 'LCP',
                        metric_value: lcpValue,
                        metric_rating: lcpValue < 2500 ? 'good' : lcpValue < 4000 ? 'needs-improvement' : 'poor'
                    });
                });
                lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

                // CLS Observer
                let clsValue = 0;
                const clsObserver = new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries()) {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                        }
                    }
                });
                clsObserver.observe({ type: 'layout-shift', buffered: true });

                // Send CLS on page hide
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'hidden') {
                        const finalCLS = Math.round(clsValue * 1000) / 1000;
                        if (CONFIG.debug) console.log('CLS:', finalCLS);

                        sendToAnalytics('web_vitals', {
                            metric_name: 'CLS',
                            metric_value: finalCLS,
                            metric_rating: finalCLS < 0.1 ? 'good' : finalCLS < 0.25 ? 'needs-improvement' : 'poor'
                        });
                    }
                });

                // First Input Delay / Interaction to Next Paint
                const fidObserver = new PerformanceObserver((entryList) => {
                    const firstEntry = entryList.getEntries()[0];
                    const fidValue = Math.round(firstEntry.processingStart - firstEntry.startTime);

                    if (CONFIG.debug) console.log('FID:', fidValue, 'ms');

                    sendToAnalytics('web_vitals', {
                        metric_name: 'FID',
                        metric_value: fidValue,
                        metric_rating: fidValue < 100 ? 'good' : fidValue < 300 ? 'needs-improvement' : 'poor'
                    });
                });
                fidObserver.observe({ type: 'first-input', buffered: true });

            } catch (e) {
                if (CONFIG.debug) console.warn('Web Vitals tracking error:', e);
            }
        }

        // Track Time to First Byte (TTFB)
        window.addEventListener('load', () => {
            const navEntry = performance.getEntriesByType('navigation')[0];
            if (navEntry) {
                const ttfb = Math.round(navEntry.responseStart);
                if (CONFIG.debug) console.log('TTFB:', ttfb, 'ms');

                sendToAnalytics('web_vitals', {
                    metric_name: 'TTFB',
                    metric_value: ttfb,
                    metric_rating: ttfb < 800 ? 'good' : ttfb < 1800 ? 'needs-improvement' : 'poor'
                });
            }
        });
    }

    /**
     * Scroll Depth Tracking
     * Tracks 25%, 50%, 75%, and 100% scroll milestones
     */
    function trackScrollDepth() {
        const milestones = [25, 50, 75, 100];
        const reached = new Set();

        const trackScroll = throttle(() => {
            const scrollPercent = Math.round(
                (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
            );

            milestones.forEach(milestone => {
                if (scrollPercent >= milestone && !reached.has(milestone)) {
                    reached.add(milestone);
                    if (CONFIG.debug) console.log('Scroll depth:', milestone + '%');

                    sendToAnalytics('scroll_depth', {
                        percent_scrolled: milestone,
                        page_path: window.location.pathname
                    });
                }
            });
        }, 100);

        window.addEventListener('scroll', trackScroll, { passive: true });
    }

    /**
     * Video Engagement Tracking
     * Tracks play, pause, and watch percentage
     */
    function trackVideoEngagement() {
        document.addEventListener('play', (e) => {
            if (e.target.tagName === 'VIDEO') {
                sendToAnalytics('video_start', {
                    video_src: e.target.currentSrc,
                    video_duration: Math.round(e.target.duration)
                });
            }
        }, true);

        document.addEventListener('ended', (e) => {
            if (e.target.tagName === 'VIDEO') {
                sendToAnalytics('video_complete', {
                    video_src: e.target.currentSrc,
                    video_duration: Math.round(e.target.duration)
                });
            }
        }, true);
    }

    /**
     * Outbound Link Tracking
     */
    function trackOutboundLinks() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.hostname !== window.location.hostname) {
                sendToAnalytics('outbound_link', {
                    link_url: link.href,
                    link_text: link.textContent.trim().substring(0, 100)
                });
            }
        });
    }

    /**
     * Page Visibility Tracking
     * Tracks time spent on page
     */
    function trackPageVisibility() {
        let startTime = Date.now();
        let totalTime = 0;

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                totalTime += Date.now() - startTime;

                sendToAnalytics('page_engagement', {
                    engagement_time_msec: totalTime,
                    page_path: window.location.pathname
                });
            } else {
                startTime = Date.now();
            }
        });
    }

    /**
     * Send event to Google Analytics
     */
    function sendToAnalytics(eventName, params) {
        // Check if gtag is available
        if (typeof gtag === 'function') {
            gtag('event', eventName, params);
        }

        // Also log to console in debug mode
        if (CONFIG.debug) {
            console.log('Analytics Event:', eventName, params);
        }

        // Send to custom endpoint if needed
        // sendToCustomEndpoint(eventName, params);
    }

    /**
     * Utility: Throttle function
     */
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Expose for external use
    window.RelicAnalytics = {
        trackEvent: sendToAnalytics,
        config: CONFIG
    };

})();
