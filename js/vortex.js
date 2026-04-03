// Vortex Background Effect (Aceternity-inspired) - Integrated with Three.js
class VortexEffect {
    constructor(canvasId) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = canvasId;

        // Make canvas larger for better quality
        this.canvas.width = 2048;
        this.canvas.height = 2048;

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.particleCount = 350;
        this.mouse = { x: 0, y: 0 };
        this.time = 0;

        this.init();
    }

    init() {
        this.createParticles();
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
    }

    getTexture() {
        return this.canvas;
    }

    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                angle: Math.random() * Math.PI * 2,
                radius: Math.random() * this.canvas.width * 0.6,
                size: Math.random() * 3 + 1,
                speed: Math.random() * 0.5 + 0.2,
                opacity: Math.random() * 0.6 + 0.3,
                spiralSpeed: Math.random() * 0.015 + 0.008,
                pulsePhase: Math.random() * Math.PI * 2,
                color: this.randomColor()
            });
        }
    }

    randomColor() {
        const colors = [
            'rgba(0, 255, 100',    // Bright green
            'rgba(0, 255, 150',    // Light green
            'rgba(0, 200, 100',    // Medium green
            'rgba(50, 255, 150',   // Cyan-green
            'rgba(255, 255, 255'   // Occasional white
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    drawVortexLines() {
        const numLines = 15;

        for (let i = 0; i < numLines; i++) {
            this.ctx.beginPath();
            const angleOffset = (i / numLines) * Math.PI * 2;
            const points = 120;

            for (let j = 0; j < points; j++) {
                const progress = j / points;
                const angle = angleOffset + progress * Math.PI * 6 + this.time * 0.3;
                const radius = progress * this.canvas.width * 0.8;

                const x = this.centerX + Math.cos(angle) * radius;
                const y = this.centerY + Math.sin(angle) * radius;

                if (j === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }

            const gradient = this.ctx.createLinearGradient(
                this.centerX,
                this.centerY,
                this.centerX + this.canvas.width * 0.5,
                this.centerY + this.canvas.height * 0.5
            );
            gradient.addColorStop(0, 'rgba(0, 255, 100, 0.15)');
            gradient.addColorStop(0.5, 'rgba(0, 255, 150, 0.08)');
            gradient.addColorStop(1, 'rgba(0, 200, 100, 0)');

            this.ctx.strokeStyle = gradient;
            this.ctx.lineWidth = 3;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = 'rgba(0, 255, 100, 0.5)';
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        }
    }

    drawParticles() {
        this.particles.forEach(particle => {
            // Update particle position in spiral
            particle.angle += particle.spiralSpeed;
            particle.radius -= particle.speed;

            // Reset particle if it reaches center
            if (particle.radius < 20) {
                particle.radius = this.canvas.width * 0.6;
                particle.angle = Math.random() * Math.PI * 2;
            }

            // Calculate position
            const x = this.centerX + Math.cos(particle.angle) * particle.radius;
            const y = this.centerY + Math.sin(particle.angle) * particle.radius;

            // Pulse effect
            const pulse = Math.sin(this.time * 2 + particle.pulsePhase) * 0.3 + 0.7;
            const currentOpacity = particle.opacity * pulse;

            // Draw particle with bloom effect
            this.ctx.beginPath();
            this.ctx.arc(x, y, particle.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `${particle.color}, ${currentOpacity})`;
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = `${particle.color}, ${currentOpacity})`;
            this.ctx.fill();

            // Add intense glow bloom
            const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, particle.size * 6);
            gradient.addColorStop(0, `${particle.color}, ${currentOpacity * 0.8})`);
            gradient.addColorStop(0.3, `${particle.color}, ${currentOpacity * 0.4})`);
            gradient.addColorStop(1, `${particle.color}, 0)`);
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(x, y, particle.size * 6, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });
    }

    drawCenterGlow() {
        const glowSize = 500;
        const pulse = Math.sin(this.time * 0.5) * 0.1 + 0.9;

        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, glowSize
        );
        gradient.addColorStop(0, `rgba(0, 255, 100, ${0.25 * pulse})`);
        gradient.addColorStop(0.3, `rgba(0, 255, 150, ${0.15 * pulse})`);
        gradient.addColorStop(0.6, `rgba(0, 200, 100, ${0.08 * pulse})`);
        gradient.addColorStop(1, 'rgba(0, 255, 100, 0)');

        this.ctx.shadowBlur = 40;
        this.ctx.shadowColor = `rgba(0, 255, 100, ${0.6 * pulse})`;
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.shadowBlur = 0;
    }

    update() {
        this.time += 0.016;

        // Clear canvas
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw effects
        this.drawCenterGlow();
        this.drawVortexLines();
        this.drawParticles();
    }
}

// Export for Three.js integration
window.VortexEffect = VortexEffect;
