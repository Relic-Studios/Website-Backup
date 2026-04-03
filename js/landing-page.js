// Landing Page - Background Asset Loading & Cinematic Entry

class LandingPageManager {
    constructor() {
        this.landingPage = document.getElementById('landing-page');
        this.enterBtn = document.getElementById('enter-site-btn');
        this.progressFill = document.getElementById('loading-progress');
        this.loadingText = document.getElementById('loading-text');
        this.progressContainer = document.querySelector('.landing-progress');

        this.assetsToLoad = [];
        this.loadedAssets = 0;
        this.totalAssets = 0;
        this.assetsReady = false;

        this.init();
    }

    init() {
        // Setup enter button
        this.setupEnterButton();

        // Enable button immediately - no loading required
        this.assetsReady = true;
        this.progressFill.style.width = '100%';
        this.loadingText.textContent = 'Ready';
        this.progressContainer.classList.add('loaded');

        // Make button clickable right away
        this.enterBtn.style.opacity = '1';
        this.enterBtn.style.boxShadow = '0 0 30px rgba(0, 206, 209, 0.5)';
    }

    collectAssets() {
        // Collect all images
        const images = Array.from(document.querySelectorAll('img[src]'))
            .map(img => img.src)
            .filter(src => !src.includes('relic.png')); // Exclude landing logo

        // Skip video preloading - videos are hosted externally or lazy-loaded
        // This prevents blocking on large video files

        // Collect audio
        const audio = ['assets/music/The Ambientalist - Daydream.mp3'];

        this.assetsToLoad = [
            ...images.map(src => ({ type: 'image', src })),
            ...audio.map(src => ({ type: 'audio', src }))
        ];

        this.totalAssets = this.assetsToLoad.length;

        console.log(`Loading ${this.totalAssets} assets in background...`);
    }

    startBackgroundLoading() {
        let loadPromises = this.assetsToLoad.map(asset => {
            return this.loadAsset(asset).then(() => {
                this.loadedAssets++;
                this.updateProgress();
            }).catch(err => {
                console.warn(`Failed to load ${asset.src}:`, err);
                this.loadedAssets++;
                this.updateProgress();
            });
        });

        // Add timeout fallback - don't wait forever (max 10 seconds)
        const loadingTimeout = new Promise(resolve => {
            setTimeout(() => {
                console.log('Loading timeout reached, proceeding anyway...');
                resolve();
            }, 10000);
        });

        // Complete loading when all assets load OR timeout is reached
        Promise.race([
            Promise.all(loadPromises),
            loadingTimeout
        ]).then(() => {
            this.onLoadingComplete();
        });
    }

    loadAsset(asset) {
        return new Promise((resolve, reject) => {
            if (asset.type === 'image') {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => reject();
                img.src = asset.src;
            } else if (asset.type === 'video') {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = () => resolve();
                video.onerror = () => reject();
                video.src = asset.src;
            } else if (asset.type === 'audio') {
                const audio = new Audio();
                audio.preload = 'auto';
                audio.oncanplaythrough = () => resolve();
                audio.onerror = () => reject();
                audio.src = asset.src;
            }
        });
    }

    updateProgress() {
        const progress = (this.loadedAssets / this.totalAssets) * 100;
        this.progressFill.style.width = `${progress}%`;

        if (progress < 30) {
            this.loadingText.textContent = 'Loading Assets...';
        } else if (progress < 70) {
            this.loadingText.textContent = 'Preparing Experience...';
        } else if (progress < 100) {
            this.loadingText.textContent = 'Almost Ready...';
        }
    }

    onLoadingComplete() {
        this.assetsReady = true;
        this.loadingText.textContent = 'Ready';
        this.progressContainer.classList.add('loaded');

        // Enable enter button with glow effect
        this.enterBtn.style.animation = 'none';
        setTimeout(() => {
            this.enterBtn.style.opacity = '1';
            this.enterBtn.style.boxShadow = '0 0 30px rgba(0, 206, 209, 0.5)';
        }, 100);

        console.log('All assets loaded!');
    }

    setupEnterButton() {
        this.enterBtn.addEventListener('click', () => {
            this.enterSite();
        });

        // Also allow Enter key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.assetsReady && this.landingPage.style.display !== 'none') {
                this.enterSite();
            }
        });
    }

    enterSite() {
        // Allow entry even if assets aren't fully loaded
        // Users shouldn't be blocked from entering the site

        // Start audio
        if (window.audioReactive && window.audioReactive.audio) {
            window.audioReactive.audio.play().catch(err => {
                console.log('Audio autoplay prevented:', err);
            });

            // Hide audio control hint
            const audioControl = document.getElementById('audio-control');
            if (audioControl) {
                audioControl.style.display = 'none';
            }
        }

        // Disable button
        this.enterBtn.disabled = true;
        this.enterBtn.style.opacity = '0.5';

        // Start cinematic zoom transition
        this.landingPage.classList.add('zoom-out');

        // After animation completes, hide landing page
        setTimeout(() => {
            this.landingPage.style.display = 'none';
            document.body.classList.add('site-entered');
        }, 2500);
    }
}

// Initialize landing page when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new LandingPageManager();
    });
} else {
    new LandingPageManager();
}
