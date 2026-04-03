// Portfolio Configuration
const portfolioConfig = {
    teamMembers: [
        {
            name: 'Aidan Poole',
            displayName: 'Aidan Poole (RELIC)',
            role: 'Founder & Creative Director',
            photo: 'assets/HeadShots/aidanpooleheadshot.jpg',
            alternatePhoto: 'assets/HeadShots/mikuaidan.webp',
            description: 'Founded Relic Studios LLC with a vision to blend cutting-edge AI technology with traditional motion graphics. Specializing in real-time visuals for nightclubs, festivals, and entertainment venues. A lifelong researcher constantly developing new advancements in the motion graphics field, driven by a desire to bring these innovations to client work and the open-source community—providing new creative landscapes for artists and creators worldwide.',
            skills: ['TouchDesigner', 'Notch', 'Cinema 4D', 'ZBrush', 'Substance Painter', 'After Effects', 'ComfyUI', 'Creative Direction', 'Live Performance'],
            showreel: {
                type: 'youtube',
                videoId: 'ZuqRRIZUo6s'
            }
        },
        {
            name: 'Steven McCorry',
            displayName: 'Steven McCorry (GLASSCRANE)',
            role: 'Creative Director & Motion Designer',
            photo: 'assets/HeadShots/glasscraneheadshot.png',
            description: 'A lifelong teacher and inspiration for many artists around the world. A renowned visionary artist, motion designer and VJ, he came from a rich background of art and business, bringing decades of creative expertise and mentorship to the motion graphics community.',
            skills: ['Cinema 4D', 'TouchDesigner', 'ComfyUI', 'Notch', 'Unreal Engine 5', 'ZBrush', 'Substance Painter'],
            showreel: {
                type: 'video',
                src: 'assets/videos/Showreel/gcshowreel.mp4'
            }
        },
        {
            name: 'Rion Debellaistre',
            displayName: 'Rion Debellaistre (RX)',
            role: '3D Artist & VJ',
            photo: 'assets/HeadShots/rxheadshot.png',
            description: 'A completely self-taught Blender artist based in Buffalo NY, specializing in concert visuals and live performances. Working with musical acts nationwide—from bands to DJs—Rion has honed his craft at Beloved Entertainment, mastering LED wall systems and live production workflows. Driven by the unlimited creative possibilities within 3D spaces, he has made remarkable progress over three years and continues to push boundaries. What truly fuels his passion is the community—welcoming, collaborative, and dedicated to sharing knowledge and elevating each other\'s careers.',
            skills: ['Blender', 'Unreal Engine 5', 'ZBrush', 'Hard Surface Modeling', 'Sculpting', 'Rigging & Animation', 'Texturing & Shading', 'Compositing'],
            showreel: {
                type: 'video',
                src: 'assets/videos/Showreel/rxshowreel.mp4'
            }
        }
    ],
    galleryItems: [
        {
            type: 'live',
            src: 'assets/videos/20250418_201655.mp4',
            thumbnail: 'assets/images/video-thumbnails/20250418_201655.jpg'
        },
        {
            type: 'live',
            src: 'assets/videos/20250418_220743.mp4',
            thumbnail: 'assets/images/video-thumbnails/20250418_220743.jpg'
        },
        {
            type: 'live',
            src: 'assets/videos/20250418_223044.mp4',
            thumbnail: 'assets/images/video-thumbnails/20250418_223044.jpg'
        },
        {
            type: 'live',
            src: 'assets/videos/20250418_225001.mp4',
            thumbnail: 'assets/images/video-thumbnails/20250418_225001.jpg'
        },
        {
            type: 'live',
            src: 'assets/videos/20250418_235734.mp4',
            thumbnail: 'assets/images/video-thumbnails/20250418_235734.jpg'
        },
        {
            type: 'video',
            src: 'assets/videos/Comp_1_2.mp4',
            thumbnail: 'assets/images/video-thumbnails/Comp_1_2.jpg'
        },
        {
            type: 'video',
            src: 'assets/videos/Main6.mp4',
            thumbnail: 'assets/images/video-thumbnails/Main6.jpg'
        },
        {
            type: 'video',
            src: 'assets/videos/newwatcher_tvai_optimized.mp4',
            thumbnail: 'assets/images/video-thumbnails/newwatcher_tvai_optimized.jpg'
        },
        {
            type: 'live',
            src: 'assets/videos/Snapchat-1817447126.mp4',
            thumbnail: 'assets/images/video-thumbnails/Snapchat-1817447126.jpg'
        },
        {
            type: 'live',
            src: 'assets/videos/Snapchat-721211222.mp4',
            thumbnail: 'assets/images/video-thumbnails/Snapchat-721211222.jpg'
        },
        {
            type: 'live',
            src: 'assets/videos/PXL_20250727_062750151.mp4',
            thumbnail: 'assets/images/video-thumbnails/PXL_20250727_062750151.jpg'
        },
        {
            type: 'video',
            src: 'assets/videos/orb.mp4',
            thumbnail: 'assets/images/video-thumbnails/orb.jpg'
        },
        {
            type: 'image',
            src: 'assets/images/eldritch0352.jpg',
            thumbnail: 'assets/images/eldritch0352.jpg'
        },
        {
            type: 'image',
            src: 'assets/images/hallway_Main0006_00000.jpg',
            thumbnail: 'assets/images/hallway_Main0006_00000.jpg'
        },
        {
            type: 'image',
            src: 'assets/images/thelostgirl2_00000.jpg',
            thumbnail: 'assets/images/thelostgirl2_00000.jpg'
        },
        {
            type: 'image',
            src: 'assets/images/thelostgirl4 (00000).jpg',
            thumbnail: 'assets/images/thelostgirl4 (00000).jpg'
        },
        {
            type: 'image',
            src: 'assets/images/woman_00000.jpg',
            thumbnail: 'assets/images/woman_00000.jpg'
        },
        {
            type: 'image',
            src: 'assets/images/PXL_20250727_062609308.NIGHT.RAW-01.COVER.jpg',
            thumbnail: 'assets/images/PXL_20250727_062609308.NIGHT.RAW-01.COVER.jpg'
        },
        {
            type: 'image',
            src: 'assets/images/newidk.jpg',
            thumbnail: 'assets/images/newidk.jpg'
        },
        {
            type: 'image',
            src: 'assets/images/newidk2.jpg',
            thumbnail: 'assets/images/newidk2.jpg'
        },
        {
            type: 'image',
            src: 'assets/images/pretty.jpg',
            thumbnail: 'assets/images/pretty.jpg'
        }
    ]
};

// Three.js Scene Setup
let scene, camera, renderer;
let particles = [];
let time = 0;
let mouse = { x: 0, y: 0 };
let greenLights = [];
let pixelMap;
let scrollCameraController; // Smooth scroll-based camera animation
let particleSystem;
let gpgpuStarfield;
let bloomComposer;
let cameraTarget = new THREE.Vector3(0, 0, 0);
let initialZoom = 30; // Start closer for dramatic reveal
let targetZoom = 45; // Closer to see condensed particles
let zoomProgress = 0;
let zoomDuration = 180; // 3 minutes for ultra-slow cinematic zoom

function initThreeJS() {
    // Initialize pixelmap reference system
    pixelMap = new window.PixelMapReference();
    pixelMap.exportSectionMap();

    // Scene - removed fog for clearer space flight feel
    scene = new THREE.Scene();

    // Camera with more depth and better near/far planes to prevent clipping
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        3000
    );
    // Start zoomed in for dramatic entrance
    camera.position.set(0, 0, initialZoom);

    // Store initial camera direction for rotation constraint
    camera.initialLookAt = new THREE.Vector3(0, 0, 0);
    camera.lookAt(camera.initialLookAt);

    // Renderer optimized for color depth and quality
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x for performance
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0x000000, 1);
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Disable old particle system - using only GPGPU starfield now
    // particleSystem = new window.ParticleSystem(scene, camera);

    // Initialize simple bloom composer for clean glow effects
    bloomComposer = new window.SimpleBloomComposer(renderer, scene, camera);

    // HDRI disabled - file too large for deployment (468MB)
    // const rgbeLoader = new THREE.RGBELoader();
    // rgbeLoader.load(
    //     'assets/images/galaxy_center.hdr',
    //     function (texture) {
    //         texture.mapping = THREE.EquirectangularReflectionMapping;
    //         scene.environment = texture;
    //         console.log('HDRI loaded successfully');
    //     },
    //     function (progress) {
    //         console.log('Loading HDRI:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
    //     },
    //     function (error) {
    //         console.error('Error loading HDRI:', error);
    //     }
    // );

    // Dramatic cosmic lighting setup
    const ambientLight = new THREE.AmbientLight(0x0a0a1a, 0.3); // Darker, more mysterious
    scene.add(ambientLight);

    // Key light - cooler tone
    const keyLight = new THREE.DirectionalLight(0x8888ff, 0.8);
    keyLight.position.set(30, 40, 30);
    scene.add(keyLight);

    // Holographic accent lights - multiple colors for iridescent feel
    const light1 = new THREE.PointLight(0x00CED1, 2.0, 200); // Cyan
    light1.position.set(50, 0, 0);
    greenLights.push(light1);
    scene.add(light1);

    const light2 = new THREE.PointLight(0x9900ff, 2.0, 200); // Purple
    light2.position.set(-50, 0, 0);
    greenLights.push(light2);
    scene.add(light2);

    const light3 = new THREE.PointLight(0xff00ff, 1.5, 150); // Magenta
    light3.position.set(0, 50, 0);
    greenLights.push(light3);
    scene.add(light3);

    const light4 = new THREE.PointLight(0x00ffff, 1.5, 150); // Electric cyan
    light4.position.set(0, -50, 0);
    greenLights.push(light4);
    scene.add(light4);

    // Mobile detection - check for mobile/tablet devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     window.innerWidth <= 1024 ||
                     ('ontouchstart' in window);

    // Use GPGPU starfield for both mobile and desktop
    if (window.GPGPUStarfield) {
        // Initialize GPGPU starfield
        gpgpuStarfield = new window.GPGPUStarfield(scene, camera, renderer);
    } else {
        // GPGPUStarfield not loaded, using fallback
        createStarfield(); // Fallback
    }

    // Initialize scroll-based camera controller
    if (window.ScrollCameraController) {
        scrollCameraController = new window.ScrollCameraController(camera, {
            scrollRange: 2500,  // pixels to scroll for full animation
            smoothFactor: 0.05,  // smooth interpolation factor
            startPosition: { x: 0, y: 300, z: 500 },  // Above the scene (closer)
            endPosition: { x: 0, y: 50, z: 450 },    // Lower, looking up
            startLookAt: { x: 0, y: -100, z: 0 },    // Looking down
            endLookAt: { x: 0, y: 200, z: 0 }        // Looking up at object
        });
    }

    // Vortex Sphere removed per user request

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('mousemove', onMouseMove);

    // Only attach scroll listener on index.html (pages with #home or #gallery sections)
    const isIndexPage = document.getElementById('home') || document.getElementById('gallery');
    if (isIndexPage) {
        window.addEventListener('scroll', onScroll);
    }

    window.addEventListener('click', onMouseClick);

    // Start animation
    animate();
}

// Torus rings removed


function createStarfield() {
    // Create multiple depth layers for cosmic depth

    // Layer 1: Distant stars (far background)
    createStarLayer(5000, 3000, 0.3, 0.2, 0xaaaaaa);

    // Layer 2: Mid-distance stars
    createStarLayer(3000, 2000, 0.5, 0.4, 0xdddddd);

    // Layer 3: Nearby stars (brighter, larger)
    createStarLayer(1500, 1000, 0.8, 0.7, 0xffffff);

    // Add holographic nebula clouds for depth
    createNebulaLayers();

    // Add cosmic dust particles
    createCosmicDust();
}

function createStarLayer(starCount, depth, size, opacity, color) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;

        // Distribute across the depth range
        positions[i3] = (Math.random() - 0.5) * depth * 2;
        positions[i3 + 1] = (Math.random() - 0.5) * depth * 2;
        positions[i3 + 2] = (Math.random() - 0.5) * depth * 2;

        // Monochromatic brightness variation
        const colorVar = new THREE.Color(color);
        const brightnessVar = 0.8 + Math.random() * 0.2; // Slight brightness variation

        colors[i3] = colorVar.r * brightnessVar;
        colors[i3 + 1] = colorVar.g * brightnessVar;
        colors[i3 + 2] = colorVar.b * brightnessVar;

        // Varying sizes for depth perception
        sizes[i] = size * (0.5 + Math.random() * 1.5);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 }
        },
        vertexShader: `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            varying float vAlpha;
            uniform float time;

            void main() {
                vColor = color;

                // Subtle twinkling
                float twinkle = sin(time * 2.0 + position.x * 0.1 + position.y * 0.1) * 0.3 + 0.7;
                vAlpha = twinkle;

                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (1000.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            varying float vAlpha;

            void main() {
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);

                if (dist > 0.5) discard;

                float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * vAlpha;
                gl_FragColor = vec4(vColor, alpha * ${opacity});
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const starField = new THREE.Points(geometry, material);
    scene.add(starField);

    // Animate twinkling
    function animateStars() {
        material.uniforms.time.value += 0.016;
        requestAnimationFrame(animateStars);
    }
    animateStars();
}

function createNebulaLayers() {
    // Create volumetric nebula clouds for cosmic depth
    const nebulaCount = 50;

    for (let i = 0; i < nebulaCount; i++) {
        const geometry = new THREE.SphereGeometry(
            50 + Math.random() * 150, // Varying sizes
            16,
            16
        );

        // Monochromatic gray shades
        const grayShade = 0x0a0a0a + Math.floor(Math.random() * 0x202020);
        const baseColor = new THREE.Color(grayShade);

        const material = new THREE.MeshBasicMaterial({
            color: baseColor,
            transparent: true,
            opacity: 0.03 + Math.random() * 0.05,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const nebula = new THREE.Mesh(geometry, material);

        // Random position in deep space
        nebula.position.set(
            (Math.random() - 0.5) * 3000,
            (Math.random() - 0.5) * 3000,
            (Math.random() - 0.5) * 3000
        );

        scene.add(nebula);

        // Slow rotation and pulsing
        const rotSpeed = (Math.random() - 0.5) * 0.001;
        const pulseSpeed = Math.random() * 0.02;
        const pulsePhase = Math.random() * Math.PI * 2;

        function animateNebula() {
            nebula.rotation.x += rotSpeed;
            nebula.rotation.y += rotSpeed * 0.7;

            const pulse = Math.sin(Date.now() * pulseSpeed * 0.001 + pulsePhase) * 0.02 + 0.03;
            material.opacity = pulse;

            requestAnimationFrame(animateNebula);
        }
        animateNebula();
    }
}

function createCosmicDust() {
    // Fine cosmic dust particles for atmospheric depth
    const dustGeometry = new THREE.BufferGeometry();
    const dustCount = 8000;
    const positions = new Float32Array(dustCount * 3);
    const colors = new Float32Array(dustCount * 3);
    const sizes = new Float32Array(dustCount);

    for (let i = 0; i < dustCount; i++) {
        const i3 = i * 3;

        positions[i3] = (Math.random() - 0.5) * 2500;
        positions[i3 + 1] = (Math.random() - 0.5) * 2500;
        positions[i3 + 2] = (Math.random() - 0.5) * 2500;

        // Monochromatic white/gray
        const brightness = 0.6 + Math.random() * 0.4; // 0.6 to 1.0
        colors[i3] = brightness;
        colors[i3 + 1] = brightness;
        colors[i3 + 2] = brightness;

        sizes[i] = Math.random() * 0.5 + 0.1;
    }

    dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    dustGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    dustGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const dustMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 }
        },
        vertexShader: `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            varying float vAlpha;
            uniform float time;

            void main() {
                vColor = color;

                // Shimmer effect
                float shimmer = sin(time * 3.0 + position.x * 0.2) * 0.5 + 0.5;
                vAlpha = shimmer * 0.4;

                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (500.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            varying float vAlpha;

            void main() {
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);

                if (dist > 0.5) discard;

                float alpha = (1.0 - dist * 2.0) * vAlpha;
                gl_FragColor = vec4(vColor, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const dust = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dust);

    // Animate shimmer
    function animateDust() {
        dustMaterial.uniforms.time.value += 0.016;
        dust.rotation.y += 0.0002;
        requestAnimationFrame(animateDust);
    }
    animateDust();
}

// Background sculpture and mouse light removed for performance optimization

function animate() {
    requestAnimationFrame(animate);
    time += 0.016;

    // Update scroll-based camera controller
    if (scrollCameraController) {
        scrollCameraController.update();
    }

    // Update particle system
    if (particleSystem) {
        particleSystem.update();
    }

    // Update GPGPU starfield
    if (gpgpuStarfield) {
        gpgpuStarfield.update(time);
    }

    // Update pixelmap
    if (pixelMap) {
        pixelMap.updateScrollPosition();

    }

    // Animate holographic lights - dramatic, mythic movement
    greenLights.forEach((light, index) => {
        // Slow, purposeful intensity pulsing - like breathing
        const breathPhase = Math.sin(time * 0.3 + index * 1.57) * 0.5 + 0.5; // 0-1
        const deepBreath = Math.sin(time * 0.15 + index) * 0.3 + 0.7; // 0.4-1

        // Occasional dramatic flares
        const flare = Math.random() < 0.002 ? 2.0 : 0;

        // Combine for mythic presence
        light.intensity = (breathPhase * deepBreath * 2.5 + flare) * (index % 2 === 0 ? 1.0 : 0.8);

        // Slow, cosmic orbital movement
        const angle = time * 0.02 + index * (Math.PI * 2 / greenLights.length);
        const radius = 60 + Math.sin(time * 0.1 + index) * 20; // Breathing radius
        const height = Math.sin(time * 0.05 + index * 0.7) * 30;

        light.position.x = Math.cos(angle) * radius;
        light.position.y = Math.sin(angle) * radius;
        light.position.z = height;

        // No color shifting - keep original colors static
    });

    // Static camera at target zoom
    camera.position.z = targetZoom;

    // Camera rotation constrained to maximum 3 degrees from initial position
    // Calculate target look position with subtle drift (within 3 degree cone)
    const maxAngle = 3 * (Math.PI / 180); // 3 degrees in radians
    const distance = camera.position.length();

    // Very subtle noise-based drift with offsets for variation
    // Using multiple offset noise functions for organic movement
    const noiseOffset1 = 37.5;  // Offset for X axis
    const noiseOffset2 = 83.2;  // Offset for Y axis
    const noiseOffset3 = 129.7; // Additional phase offset

    const driftX = (Math.sin(time * 0.08 + noiseOffset1) +
                    Math.sin(time * 0.05 + noiseOffset3) * 0.5) *
                    Math.tan(maxAngle) * distance * 0.25; // 25% of max angle

    const driftY = (Math.cos(time * 0.06 + noiseOffset2) +
                    Math.cos(time * 0.04 + noiseOffset3) * 0.5) *
                    Math.tan(maxAngle) * distance * 0.25;

    // Smooth interpolation to target (slower for more stability)
    cameraTarget.x += (driftX - cameraTarget.x) * 0.002;
    cameraTarget.y += (driftY - cameraTarget.y) * 0.002;
    cameraTarget.z = 0; // Always look towards origin

    camera.lookAt(cameraTarget);

    // Render with simple bloom composer
    if (bloomComposer) {
        bloomComposer.render(0);
    } else {
        renderer.render(scene, camera);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Resize bloom composer
    if (bloomComposer) {
        bloomComposer.resize(window.innerWidth, window.innerHeight);
    }
}

// Easing function for smooth zoom
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function onMouseMove(event) {
    // Mobile detection - check for mobile/tablet devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     window.innerWidth <= 1024 ||
                     ('ontouchstart' in window);

    // Disable mouse tracking on mobile for better performance
    if (isMobile) {
        return;
    }

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update particle system with mouse position
    if (particleSystem) {
        particleSystem.updateMouse(mouse.x, mouse.y);
    }

    // Update GPGPU starfield with mouse position
    if (gpgpuStarfield) {
        gpgpuStarfield.updateMouse(mouse.x, mouse.y);
    }
}

function onMouseClick(event) {
    // Increase turbulence in particle system on click
    if (particleSystem) {
        particleSystem.increaseTurbulence();
    }
}

function onScroll() {
    const scrollPosition = window.scrollY + window.innerHeight / 2; // Center of viewport
    const sections = document.querySelectorAll('.section');

    // Only run scroll-based nav highlighting on index.html (which has #home, #gallery, #contact)
    // Check if we're on a standalone page by looking for index-specific sections
    const isIndexPage = document.getElementById('home') || document.getElementById('gallery');
    if (!isIndexPage) {
        return;
    }

    // Find which section is most visible in viewport
    let activeSection = null;
    let activeSectionIndex = 0;

    sections.forEach((section, index) => {
        const rect = section.getBoundingClientRect();
        const sectionTop = scrollPosition - window.innerHeight / 2 + rect.top;
        const sectionBottom = sectionTop + rect.height;
        const viewportTop = scrollPosition - window.innerHeight / 2;
        const viewportBottom = scrollPosition + window.innerHeight / 2;

        // Check if section is in viewport
        if (sectionBottom > viewportTop && sectionTop < viewportBottom) {
            // Calculate how much of the section is visible
            const visibleTop = Math.max(sectionTop, viewportTop);
            const visibleBottom = Math.min(sectionBottom, viewportBottom);
            const visibleHeight = visibleBottom - visibleTop;

            // If this section is more visible than current active, make it active
            if (!activeSection || visibleHeight > (activeSection.visibleHeight || 0)) {
                activeSection = section;
                activeSection.visibleHeight = visibleHeight;
                activeSectionIndex = index;
            }
        }
    });

    // Update active states
    sections.forEach((section, index) => {
        if (index === activeSectionIndex) {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });

    // Update nav links based on active section ID
    const navLinks = document.querySelectorAll('.nav-link');
    const activeSectionId = activeSection ? activeSection.id : null;

    navLinks.forEach((link) => {
        const href = link.getAttribute('href');
        // Check if this link points to the active section (e.g., #home, #gallery, #contact)
        if (href && href.startsWith('#') && href === `#${activeSectionId}`) {
            link.classList.add('active');
        } else if (href && href.startsWith('#')) {
            // Only remove active from hash links, not from page links like about.html
            link.classList.remove('active');
        }
    });
}

// Gallery Functions using FocusCards
let focusCardsInstance;

function initGallery() {
    // Initialize FocusCards with images displayed first
    focusCardsInstance = new window.FocusCards(
        '#gallery-grid',
        portfolioConfig.galleryItems,
        {
            defaultFilter: 'image', // Start with images instead of all items
            enableModal: true
        }
    );
}

function openModal(index) {
    const modal = document.getElementById('gallery-modal');
    const item = portfolioConfig.galleryItems[index];
    const mediaContainer = document.getElementById('modal-media-container');

    modal.style.display = 'flex';
    modal.dataset.currentIndex = index;

    if (item.type === 'video') {
        mediaContainer.innerHTML = `
            <video controls autoplay loop>
                <source src="${item.src}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        `;
    } else {
        mediaContainer.innerHTML = `<img src="${item.src}" alt="Artwork">`;
    }

    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('gallery-modal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';

    const mediaContainer = document.getElementById('modal-media-container');
    mediaContainer.innerHTML = '';
}

function navigateModal(direction) {
    const modal = document.getElementById('gallery-modal');
    let currentIndex = parseInt(modal.dataset.currentIndex);

    // Get only visible gallery items
    const visibleItems = Array.from(document.querySelectorAll('.gallery-item'))
        .filter(item => item.style.display !== 'none');

    if (visibleItems.length === 0) return;

    // Find current item in visible list
    const currentItem = document.querySelector(`.gallery-item[data-index="${currentIndex}"]`);
    let visibleIndex = visibleItems.indexOf(currentItem);

    // Navigate within visible items
    visibleIndex += direction;
    if (visibleIndex < 0) visibleIndex = visibleItems.length - 1;
    if (visibleIndex >= visibleItems.length) visibleIndex = 0;

    // Get the actual index from the visible item
    const newIndex = parseInt(visibleItems[visibleIndex].getAttribute('data-index'));
    openModal(newIndex);
}

function scrollToGallery() {
    document.getElementById('gallery').scrollIntoView({ behavior: 'smooth' });
}

function scrollToSection(sectionId) {
    document.getElementById(sectionId).scrollIntoView({ behavior: 'smooth' });
}

// Word Rotation Effect
function initWordRotation() {
    const wordElement = document.querySelector('.word-rotate');
    if (!wordElement) return;

    const words = JSON.parse(wordElement.getAttribute('data-words'));
    let currentIndex = 0;

    setInterval(() => {
        wordElement.classList.add('fade-out');

        setTimeout(() => {
            currentIndex = (currentIndex + 1) % words.length;
            wordElement.textContent = words[currentIndex];
            wordElement.classList.remove('fade-out');
        }, 600);
    }, 3000);
}

// Gallery Filtering for FocusCards
function initGalleryFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active state
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const filter = button.getAttribute('data-filter');

            // Update FocusCards filter
            if (focusCardsInstance) {
                focusCardsInstance.filterCards(filter);
            }
        });
    });
}

// Initialize Team Section
function initTeamSection() {
    const teamContainer = document.getElementById('team-container');
    if (!teamContainer) {
        return;
    }

    if (!portfolioConfig.teamMembers || portfolioConfig.teamMembers.length === 0) {
        return;
    }

    new window.TeamSection('#team-container', portfolioConfig.teamMembers);
}

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();

    // Only initialize gallery-related features on index.html
    if (document.getElementById('gallery-grid')) {
        initGallery();
        initWordRotation();
        initGalleryFilters();
    }

    // Initialize team section on about.html
    initTeamSection();

    // Only attach gallery modal handlers if modal exists
    const galleryModal = document.getElementById('gallery-modal');
    if (galleryModal) {
        const modalClose = document.querySelector('.modal-close');
        const modalPrev = document.querySelector('.modal-nav.prev');
        const modalNext = document.querySelector('.modal-nav.next');

        if (modalClose) modalClose.addEventListener('click', closeModal);
        if (modalPrev) modalPrev.addEventListener('click', () => navigateModal(-1));
        if (modalNext) modalNext.addEventListener('click', () => navigateModal(1));

        // Keyboard navigation for modal
        document.addEventListener('keydown', (e) => {
            if (galleryModal.style.display === 'flex') {
                if (e.key === 'Escape') closeModal();
                if (e.key === 'ArrowLeft') navigateModal(-1);
                if (e.key === 'ArrowRight') navigateModal(1);
            }
        });

        galleryModal.addEventListener('click', (e) => {
            if (e.target.id === 'gallery-modal') {
                closeModal();
            }
        });
    }

    // Navigation scroll handler with nav state update
    const nav = document.getElementById('main-nav');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            // Only intercept hash links (e.g., #home, #gallery) for smooth scrolling
            // Let page links (e.g., about.html, index.html#home) navigate normally
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                const target = document.getElementById(targetId);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });

    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('gallery-modal');
        if (modal.style.display === 'flex') {
            if (e.key === 'ArrowLeft') navigateModal(-1);
            if (e.key === 'ArrowRight') navigateModal(1);
            if (e.key === 'Escape') closeModal();
        }
    });

    // View Work button handler
    const viewWorkBtn = document.getElementById('view-work-btn');
    if (viewWorkBtn) {
        viewWorkBtn.addEventListener('click', scrollToGallery);
    }
});
