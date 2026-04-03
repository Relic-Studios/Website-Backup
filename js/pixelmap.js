// Pixelmap Reference System for Full Website Page
// Tracks scroll position and maps it to 3D space for lighting

class PixelMapReference {
    constructor() {
        this.documentHeight = 0;
        this.viewportHeight = 0;
        this.scrollPercentage = 0;
        this.mouseX = 0;
        this.mouseY = 0;
        this.normalizedMouseX = 0;
        this.normalizedMouseY = 0;
        this.worldSpaceY = 0;
        this.sections = [];

        this.init();
    }

    init() {
        this.updateDimensions();
        this.setupListeners();
        this.mapSections();
    }

    updateDimensions() {
        this.documentHeight = document.documentElement.scrollHeight;
        this.viewportHeight = window.innerHeight;
    }

    setupListeners() {
        // Track mouse position
        document.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
            this.normalizedMouseX = (e.clientX / window.innerWidth) * 2 - 1;
            this.normalizedMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
        });

        // Track scroll position
        window.addEventListener('scroll', () => {
            this.updateScrollPosition();
        });

        // Update on resize
        window.addEventListener('resize', () => {
            this.updateDimensions();
            this.mapSections();
        });
    }

    updateScrollPosition() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollableHeight = this.documentHeight - this.viewportHeight;
        this.scrollPercentage = scrollableHeight > 0 ? scrollTop / scrollableHeight : 0;

        // Map scroll to 3D world space (Z-axis depth)
        // Range from 0 to -500 (deeper into the scene as you scroll)
        this.worldSpaceY = this.scrollPercentage * -500;
    }

    mapSections() {
        // Map each section to 3D world coordinates
        this.sections = [];
        const sectionElements = document.querySelectorAll('.section');

        sectionElements.forEach((section, index) => {
            const rect = section.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const absoluteTop = rect.top + scrollTop;
            const absoluteBottom = absoluteTop + rect.height;

            // Map to 3D world space
            const worldStart = (absoluteTop / this.documentHeight) * -500;
            const worldEnd = (absoluteBottom / this.documentHeight) * -500;

            this.sections.push({
                id: section.id,
                element: section,
                pixelStart: absoluteTop,
                pixelEnd: absoluteBottom,
                worldStart: worldStart,
                worldEnd: worldEnd,
                worldCenter: (worldStart + worldEnd) / 2,
                height: rect.height
            });
        });
    }

    // Get the current active section based on scroll
    getActiveSection() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const viewportCenter = scrollTop + (this.viewportHeight / 2);

        for (let section of this.sections) {
            if (viewportCenter >= section.pixelStart && viewportCenter <= section.pixelEnd) {
                return section;
            }
        }
        return null;
    }

    // Convert mouse position to 3D world coordinates
    getMouseWorldPosition() {
        const activeSection = this.getActiveSection();
        const baseDepth = activeSection ? activeSection.worldCenter : this.worldSpaceY;

        return {
            x: this.normalizedMouseX * 40, // Scale to reasonable world units
            y: this.normalizedMouseY * 30,
            z: baseDepth + 30 // Slightly in front of the background
        };
    }

    // Get lighting target position (where mouse points in 3D space)
    getLightingTarget() {
        const mouseWorld = this.getMouseWorldPosition();

        return {
            position: mouseWorld,
            intensity: 1.0,
            radius: 50,
            color: { r: 1.0, g: 1.0, b: 1.0 }
        };
    }

    // Debug visualization
    getDebugInfo() {
        return {
            documentHeight: this.documentHeight,
            viewportHeight: this.viewportHeight,
            scrollPercentage: (this.scrollPercentage * 100).toFixed(2) + '%',
            mouseX: this.mouseX.toFixed(0),
            mouseY: this.mouseY.toFixed(0),
            normalizedMouseX: this.normalizedMouseX.toFixed(3),
            normalizedMouseY: this.normalizedMouseY.toFixed(3),
            worldSpaceY: this.worldSpaceY.toFixed(2),
            activeSection: this.getActiveSection()?.id || 'none',
            sectionsCount: this.sections.length
        };
    }

    // Export section map for external use
    exportSectionMap() {
        return {
            totalHeight: this.documentHeight,
            worldDepth: 500,
            sections: this.sections.map(s => ({
                id: s.id,
                pixelRange: [s.pixelStart, s.pixelEnd],
                worldRange: [s.worldStart, s.worldEnd],
                center: s.worldCenter
            }))
        };
    }
}

// Export for use in main.js
window.PixelMapReference = PixelMapReference;
