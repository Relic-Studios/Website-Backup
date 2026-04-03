// Simplified Bloom Composer - Reliable for Particle Systems
class SimpleBloomComposer {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;

        // Create render targets with higher color depth
        this.renderTarget = new THREE.WebGLRenderTarget(
            window.innerWidth,
            window.innerHeight,
            {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                type: THREE.HalfFloatType,
                encoding: THREE.sRGBEncoding
            }
        );

        this.bloomTarget = new THREE.WebGLRenderTarget(
            Math.floor(window.innerWidth / 2),
            Math.floor(window.innerHeight / 2)
        );

        this.blurTarget = new THREE.WebGLRenderTarget(
            Math.floor(window.innerWidth / 2),
            Math.floor(window.innerHeight / 2)
        );

        this.createShaders();
    }

    createShaders() {
        // Optimized brightness extraction
        this.brightnessShader = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                threshold: { value: 0.25 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float threshold;
                varying vec2 vUv;

                void main() {
                    vec4 color = texture2D(tDiffuse, vUv);
                    float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));

                    if (brightness > threshold) {
                        gl_FragColor = color;
                    } else {
                        gl_FragColor = vec4(0.0);
                    }
                }
            `
        });

        // Simple blur
        this.blurShader = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                resolution: { value: new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform vec2 resolution;
                varying vec2 vUv;

                void main() {
                    vec2 texelSize = 1.0 / resolution;
                    vec4 result = vec4(0.0);

                    // Optimized 3x3 blur (9 samples instead of 25)
                    for(float x = -1.0; x <= 1.0; x++) {
                        for(float y = -1.0; y <= 1.0; y++) {
                            vec2 offset = vec2(x, y) * texelSize;
                            result += texture2D(tDiffuse, vUv + offset);
                        }
                    }

                    result /= 9.0;
                    gl_FragColor = result;
                }
            `
        });

        // Optimized composite with better color preservation
        this.compositeShader = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                tBloom: { value: null },
                bloomStrength: { value: 1.8 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform sampler2D tBloom;
                uniform float bloomStrength;
                varying vec2 vUv;

                void main() {
                    vec4 original = texture2D(tDiffuse, vUv);
                    vec4 bloom = texture2D(tBloom, vUv);

                    // Optimized additive blend with color preservation
                    vec3 bloomColor = bloom.rgb * bloomStrength;
                    vec3 result = original.rgb + bloomColor;

                    // Subtle tone mapping to preserve color depth
                    result = result / (result + vec3(1.0));
                    result = pow(result, vec3(0.9)); // Slight gamma adjustment for richness

                    gl_FragColor = vec4(result, 1.0);
                }
            `
        });

        // Create quad
        this.quad = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            this.brightnessShader
        );

        this.quadScene = new THREE.Scene();
        this.quadScene.add(this.quad);
        this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }

    render(bassIntensity = 0) {
        // Render scene to texture
        this.renderer.setRenderTarget(this.renderTarget);
        this.renderer.render(this.scene, this.camera);

        // Extract bright areas
        this.quad.material = this.brightnessShader;
        this.brightnessShader.uniforms.tDiffuse.value = this.renderTarget.texture;
        this.renderer.setRenderTarget(this.bloomTarget);
        this.renderer.render(this.quadScene, this.quadCamera);

        // Blur
        this.quad.material = this.blurShader;
        this.blurShader.uniforms.tDiffuse.value = this.bloomTarget.texture;
        this.renderer.setRenderTarget(this.blurTarget);
        this.renderer.render(this.quadScene, this.quadCamera);

        // Composite and render to screen
        this.quad.material = this.compositeShader;
        this.compositeShader.uniforms.tDiffuse.value = this.renderTarget.texture;
        this.compositeShader.uniforms.tBloom.value = this.blurTarget.texture;
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.quadScene, this.quadCamera);
    }

    resize(width, height) {
        this.renderTarget.setSize(width, height);
        this.bloomTarget.setSize(Math.floor(width / 2), Math.floor(height / 2));
        this.blurTarget.setSize(Math.floor(width / 2), Math.floor(height / 2));
        this.blurShader.uniforms.resolution.value.set(Math.floor(width / 2), Math.floor(height / 2));
    }

    dispose() {
        this.renderTarget.dispose();
        this.bloomTarget.dispose();
        this.blurTarget.dispose();
        this.brightnessShader.dispose();
        this.blurShader.dispose();
        this.compositeShader.dispose();
        this.quad.geometry.dispose();
    }
}

window.SimpleBloomComposer = SimpleBloomComposer;
