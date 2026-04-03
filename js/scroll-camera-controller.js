// Smooth Scroll-Based Camera Controller
// Implements interpolated camera movement based on scroll position
// Start: Looking down from above | End: Looking up at focal object

class ScrollCameraController {
    constructor(camera, options = {}) {
        this.camera = camera;

        // Camera position keyframes
        this.keyframes = {
            start: {
                position: new THREE.Vector3(
                    options.startPosition?.x ?? 0,
                    options.startPosition?.y ?? 600,  // High above
                    options.startPosition?.z ?? 800
                ),
                lookAt: new THREE.Vector3(
                    options.startLookAt?.x ?? 0,
                    options.startLookAt?.y ?? -100,   // Looking down
                    options.startLookAt?.z ?? 0
                )
            },
            end: {
                position: new THREE.Vector3(
                    options.endPosition?.x ?? 0,
                    options.endPosition?.y ?? 50,     // Lower, looking up
                    options.endPosition?.z ?? 600
                ),
                lookAt: new THREE.Vector3(
                    options.endLookAt?.x ?? 0,
                    options.endLookAt?.y ?? 200,      // Looking up at object
                    options.endLookAt?.z ?? 0
                )
            }
        };

        // Scroll tracking
        this.scrollProgress = 0;  // 0 to 1
        this.targetScrollProgress = 0;
        this.smoothFactor = options.smoothFactor ?? 0.08;  // Lower = smoother

        // Scroll range (distance to scroll before reaching end position)
        this.scrollRange = options.scrollRange ?? 800;  // pixels
        this.scrollOffset = options.scrollOffset ?? 0;  // starting offset

        // Camera animation state
        this.currentPosition = this.keyframes.start.position.clone();
        this.currentLookAt = this.keyframes.start.lookAt.clone();

        // Easing function (ease-in-out cubic)
        this.easing = options.easing ?? this.easeInOutCubic;

        // Initialize
        this.init();
    }

    init() {
        // Set initial camera position
        this.camera.position.copy(this.currentPosition);
        this.camera.lookAt(this.currentLookAt);

        // Bind scroll listener
        this.handleScroll = this.handleScroll.bind(this);
        window.addEventListener('scroll', this.handleScroll, { passive: true });

        // Initial scroll check
        this.handleScroll();

        console.log('Scroll Camera Controller initialized');
    }

    handleScroll() {
        const scrollY = window.scrollY || window.pageYOffset;

        // Calculate target progress (0 to 1)
        const scrolledDistance = Math.max(0, scrollY - this.scrollOffset);
        this.targetScrollProgress = Math.min(1, scrolledDistance / this.scrollRange);
    }

    // Easing functions
    easeInOutCubic(t) {
        return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    easeInOutQuad(t) {
        return t < 0.5
            ? 2 * t * t
            : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    easeOutExpo(t) {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    // Interpolate between two THREE.Vector3 values
    lerp(start, end, t) {
        return new THREE.Vector3(
            start.x + (end.x - start.x) * t,
            start.y + (end.y - start.y) * t,
            start.z + (end.z - start.z) * t
        );
    }

    // Update camera position (call in animation loop)
    update() {
        // Smooth interpolation to target scroll progress
        this.scrollProgress += (this.targetScrollProgress - this.scrollProgress) * this.smoothFactor;

        // Apply easing function
        const easedProgress = this.easing(this.scrollProgress);

        // Interpolate position
        this.currentPosition = this.lerp(
            this.keyframes.start.position,
            this.keyframes.end.position,
            easedProgress
        );

        // Interpolate lookAt target
        this.currentLookAt = this.lerp(
            this.keyframes.start.lookAt,
            this.keyframes.end.lookAt,
            easedProgress
        );

        // Apply to camera
        this.camera.position.copy(this.currentPosition);
        this.camera.lookAt(this.currentLookAt);
    }

    // Update keyframes on the fly
    setKeyframe(type, property, value) {
        if (this.keyframes[type] && this.keyframes[type][property]) {
            this.keyframes[type][property].copy(value);
        }
    }

    // Set custom easing function
    setEasing(easingFunction) {
        this.easing = easingFunction;
    }

    // Manually set scroll progress (for debugging or manual control)
    setProgress(progress) {
        this.targetScrollProgress = Math.max(0, Math.min(1, progress));
    }

    // Get current progress
    getProgress() {
        return this.scrollProgress;
    }

    // Cleanup
    destroy() {
        window.removeEventListener('scroll', this.handleScroll);
    }
}

// Export for use
window.ScrollCameraController = ScrollCameraController;
