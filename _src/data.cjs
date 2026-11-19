// Site content used by tools/build.cjs. Edit here, then run `npm run build`.
// Wording rules for credits live in PROJECT_NOTES.md ("Credit wording").

const LINKS = {
    instagram: 'https://www.instagram.com/relic.visuals/',
    linkedin: 'https://www.linkedin.com/in/aidan-poole-124640285',
    github: 'https://github.com/Relic-Studios',
    discord: 'https://discord.gg/p7URyFKnBp',
    email: 'relicvisuals404@gmail.com',
    odyssey: 'https://www.projectodyssey.ai/season1',
    trailer: 'https://www.youtube.com/watch?v=reud3sf3ttE',
    atlasRepo: 'https://github.com/Relic-Studios/ATLAS-Voice',
    atlasDownload: 'https://github.com/Relic-Studios/ATLAS-Voice/releases/latest',
    atlasDemo: 'https://github.com/Relic-Studios/ATLAS-Voice#see-it-in-action',
    atlasLicense: 'https://github.com/Relic-Studios/ATLAS-Voice/blob/main/LICENSE',
    engramRepo: 'https://github.com/Relic-Studios/engram',
    engramLicense: 'https://github.com/Relic-Studios/engram/blob/master/LICENSE'
};

// The work list, in this order on the home page, the profile and the work index. Credits run by
// year, then the software. An unknown year stays empty. `form` is the star formation shown behind
// that project's page. Each project page's "NN / total" comes from here ({{> num}}).
// 2026-11-18: the StreamDiffusion and Notch row was folded into Backstreet Boys (the same project,
// per the owner); its old page redirects. Added OMNI and ALTA, Shpongle, Russ, Potawatomi and
// Summit Sessions from the owner's word and the files on his computer.
const work = [
    { n: '01', slug: 'rohki-project-odyssey', title: 'Rohki and Project Odyssey', detail: 'AI animation and pipeline. First prize, Narrative (team award)', year: '2024', group: 'credits', form: 'galaxy' },
    { n: '02', slug: 'bernabeu-sky-bar', title: 'Bernabéu Sky-Bar', detail: 'Video-wall content, Madrid', year: '2024', group: 'credits', form: 'wall' },
    { n: '03', slug: 'omni-alta-taiwan', title: 'OMNI and ALTA', detail: 'LED content for two nightclubs with 36North, Taiwan', year: '2024', group: 'credits', form: 'ring' },
    { n: '04', slug: 'shpongle-warfield', title: 'Shpongle at The Warfield', detail: 'Live visuals with Glass Crane and Android Jones, San Francisco', year: '2025', group: 'credits', form: 'galaxy' },
    { n: '05', slug: 'russ-tour', title: 'Russ tour', detail: '3D content for four song clips', year: '2025', group: 'credits', form: 'helix' },
    { n: '06', slug: 'dae-v-bad-bunny', title: 'Dae-V / Bad Bunny', detail: 'Motion graphics for 36North, Puerto Rico', year: '2025', group: 'credits', form: 'ring' },
    { n: '07', slug: 'backstreet-boys', title: 'Backstreet Boys', detail: 'StreamDiffusion and Notch for the tour', year: '', group: 'credits', form: 'helix' },
    { n: '08', slug: 'potawatomi-anniversary', title: 'Potawatomi Hotel & Casino', detail: '35th anniversary film for the LED screens, Milwaukee', year: '2026', group: 'credits', form: 'wall' },
    { n: '09', slug: 'summit-sessions-2026', title: 'Summit Sessions 2026', detail: 'Headline VJ, Wilseyville, California', year: '2026', group: 'credits', form: 'galaxy' },
    { n: '10', slug: 'atlas-voice', title: 'ATLAS Voice', detail: 'Software. Voice agents for group conversation, Windows', year: '2026', group: 'software', form: 'ring' },
    { n: '11', slug: 'engram', title: 'Engram', detail: 'Software. Agent memory, archived', year: '', group: 'software', form: 'helix' }
];

// Gallery. `src` is the full file, `thumb` is made by tools/make-thumbs.cjs.
// The studio's own stills and films are 3D work: built in Cinema 4D, rendered in Octane.
// None of it is AI. Never caption a piece as AI-made, AI-assisted or "generative".
const gallery = [
    { type: 'image', src: 'assets/images/eldritch0352.jpg', title: 'Eldritch', caption: '3D concept art | Cinema 4D, Octane' },
    { type: 'image', src: 'assets/images/hallway_Main0006_00000.jpg', title: 'The Hallway', caption: '3D environment | Cinema 4D, Octane' },
    { type: 'image', src: 'assets/images/thelostgirl2_00000.jpg', title: 'The Lost Girl II', caption: '3D character art | Cinema 4D, Octane' },
    { type: 'image', src: 'assets/images/newidk.jpg', title: 'Emergence', caption: '3D concept art | Cinema 4D, Octane' },
    { type: 'image', src: 'assets/images/pretty.jpg', title: 'Ethereal', caption: '3D portrait | Cinema 4D, Octane' },
    { type: 'image', src: 'assets/images/thelostgirl4 (00000).jpg', title: 'The Lost Girl IV', caption: '3D character art | Cinema 4D, Octane' },
    { type: 'image', src: 'assets/images/woman_00000.jpg', title: 'Portrait Study', caption: '3D portrait | Cinema 4D, Octane' },
    { type: 'image', src: 'assets/images/newidk2.jpg', title: 'Convergence', caption: '3D concept art | Cinema 4D, Octane' },
    { type: 'image', src: 'assets/images/PXL_20250727_062609308.NIGHT.RAW-01.COVER.jpg', title: 'Night Event', caption: 'Live event documentation | 2025' },

    { type: 'video', src: 'assets/videos/Comp 1_2.mp4', poster: 'assets/images/video-thumbnails/Comp_1_2.jpg', title: 'Motion Graphics Reel', caption: 'Cinema 4D, After Effects' },
    { type: 'video', src: 'assets/videos/Main6.mp4', poster: 'assets/images/video-thumbnails/Main6.jpg', title: 'Abstract Visuals', caption: '3D motion design | Cinema 4D, Octane' },
    { type: 'video', src: 'assets/videos/newwatcher_tvai_optimized.mp4', poster: 'assets/images/video-thumbnails/newwatcher_tvai_optimized.jpg', title: 'The Watcher', caption: '3D animation | Cinema 4D, Octane' },
    { type: 'video', src: 'assets/videos/orb.mp4', poster: 'assets/images/video-thumbnails/orb.jpg', title: 'Orb', caption: 'Real-time art | TouchDesigner' },

    { type: 'live', src: 'assets/videos/20250418_201655.mp4', poster: 'assets/images/video-thumbnails/20250418_201655.jpg', title: 'Shpongle at The Warfield', caption: 'Live visuals, San Francisco | April 2025' },
    { type: 'live', src: 'assets/videos/20250418_220743.mp4', poster: 'assets/images/video-thumbnails/20250418_220743.jpg', title: 'The Warfield, LED wall', caption: 'Shpongle live visuals | April 2025' },
    { type: 'live', src: 'assets/videos/20250418_223044.mp4', poster: 'assets/images/video-thumbnails/20250418_223044.jpg', title: 'The Warfield, from the VJ position', caption: 'Shpongle live visuals | April 2025' },
    { type: 'live', src: 'assets/videos/20250418_225001.mp4', poster: 'assets/images/video-thumbnails/20250418_225001.jpg', title: 'The Warfield, late set', caption: 'Shpongle live visuals | April 2025' },
    { type: 'live', src: 'assets/videos/20250418_235734.mp4', poster: 'assets/images/video-thumbnails/20250418_235734.jpg', title: 'The Warfield, closing', caption: 'Shpongle live visuals | April 2025' },
    { type: 'live', src: 'assets/videos/Snapchat-1817447126.mp4', poster: 'assets/images/video-thumbnails/Snapchat-1817447126.jpg', title: 'Live VJ Set', caption: 'On-site performance' },
    { type: 'live', src: 'assets/videos/Snapchat-721211222.mp4', poster: 'assets/images/video-thumbnails/Snapchat-721211222.jpg', title: 'Venue Visuals', caption: 'LED wall content | Live performance' },
    { type: 'live', src: 'assets/videos/PXL_20250727_062750151.mp4', poster: 'assets/images/video-thumbnails/PXL_20250727_062750151.jpg', title: 'Stage Projection', caption: 'Live event production | 2025' }
];

// Showcase (home page, top of the gallery): the pictures the 3D background turns into scenes,
// one per scroll step, in this order. Each must also be in `gallery` above (title and caption
// come from there). A depth map gives a picture real relief: after adding one here, run
//   python tools/make-depth.py assets/images/<file>
// (see that file's header). Without a depth map the picture still shows, only flatter.
const showcase = [
    'assets/images/newidk.jpg',
    'assets/images/eldritch0352.jpg',
    'assets/images/thelostgirl2_00000.jpg',
    'assets/images/hallway_Main0006_00000.jpg',
    'assets/images/woman_00000.jpg',
    'assets/images/newidk2.jpg'
];

// Team (About page). Text is the studio's own, unchanged.
const team = [
    {
        name: 'Aidan Poole',
        displayName: 'Aidan Poole (RELIC)',
        role: 'Founder & Creative Director',
        photo: 'assets/HeadShots/aidanpooleheadshot.jpg',
        alternatePhoto: 'assets/HeadShots/mikuaidan.webp',
        description: 'Founded Relic Studios LLC with a vision to blend cutting-edge AI technology with traditional motion graphics. Specializing in real-time visuals for nightclubs, festivals, and entertainment venues. A lifelong researcher constantly developing new advancements in the motion graphics field, driven by a desire to bring these innovations to client work and the open-source community—providing new creative landscapes for artists and creators worldwide.',
        skills: ['TouchDesigner', 'Notch', 'Cinema 4D', 'ZBrush', 'Substance Painter', 'After Effects', 'ComfyUI', 'Creative Direction', 'Live Performance'],
        showreel: { type: 'youtube', videoId: 'ZuqRRIZUo6s', title: 'Aidan Poole showreel' },
        profile: { href: 'aidan-poole.html', label: 'Full profile and credits' }
    },
    {
        name: 'Steven McCorry',
        displayName: 'Steven McCorry (GLASSCRANE)',
        role: 'Creative Director & Motion Designer',
        photo: 'assets/HeadShots/glasscraneheadshot.png',
        description: 'A lifelong teacher and inspiration for many artists around the world. A renowned visionary artist, motion designer and VJ, he came from a rich background of art and business, bringing decades of creative expertise and mentorship to the motion graphics community.',
        skills: ['Cinema 4D', 'TouchDesigner', 'ComfyUI', 'Notch', 'Unreal Engine 5', 'ZBrush', 'Substance Painter'],
        showreel: { type: 'video', src: 'assets/videos/Showreel/gcshowreel.mp4' }
    },
    {
        name: 'Rion Debellaistre',
        displayName: 'Rion Debellaistre (RX)',
        role: '3D Artist & VJ',
        photo: 'assets/HeadShots/rxheadshot.png',
        description: 'A completely self-taught Blender artist based in Buffalo NY, specializing in concert visuals and live performances. Working with musical acts nationwide—from bands to DJs—Rion has honed his craft at Beloved Entertainment, mastering LED wall systems and live production workflows. Driven by the unlimited creative possibilities within 3D spaces, he has made remarkable progress over three years and continues to push boundaries. What truly fuels his passion is the community—welcoming, collaborative, and dedicated to sharing knowledge and elevating each other\'s careers.',
        skills: ['Blender', 'Unreal Engine 5', 'ZBrush', 'Hard Surface Modeling', 'Sculpting', 'Rigging & Animation', 'Texturing & Shading', 'Compositing'],
        // assets/videos/Showreel/rxshowreel.mp4 is too large for the repository (see .gitignore),
        // so it never reached the live site. Add a hosted link here to bring the showreel back.
        showreel: null
    }
];

// Achievement write-ups (About page cards; four of them also appear in full on the work index).
// The text is the studio's existing text. Owner, 2026-11-18: the real-time rendering systems are
// built in Notch, not Unreal Engine, so Unreal was taken out of the Real-Time Rendering write-up.
const achievements = [
    {
        id: 'real-time-rendering',
        title: 'Real-Time Rendering',
        description: 'Detailed understanding of the technical and creative processes involved in optimizing for real-time efficiency and creative mastery using Notch Builder and TouchDesigner.',
        meta: 'Technical Excellence',
        paragraphs: [
            'Developed through extensive experience with Notch Builder and TouchDesigner, demonstrating a detailed understanding of the technical and creative processes involved in optimizing for real-time efficiency and creative mastery. Expertise spans live performance control systems, interactive installations, and branded experiences that demand both visual excellence and real-time responsiveness.',
            'Deep knowledge of real-time optimization workflows enables the delivery of real-time rendering systems and performance-critical live visuals in Notch Builder, and interactive installations in TouchDesigner—all while maintaining the technical balance between visual quality and real-time performance. These solutions enable live control of complex visual environments, responsive installations that react to user input, and branded experiences that maintain premium quality while running in real-time.'
        ],
        highlights: [
            'Developed high-quality real-time rendering systems in Notch',
            'Created live-controllable visuals using Notch Builder for performances',
            'Built interactive installations with TouchDesigner real-time control',
            'Optimized workflows for balancing visual quality and real-time performance',
            'Expertise in technical processes for real-time efficiency and creative mastery',
            'Integrated live control interfaces for dynamic visual manipulation'
        ],
        technologies: ['Notch Builder', 'TouchDesigner', 'Real-Time Rendering', 'Live Control Systems', 'Interactive Installations', 'GPU Optimization'],
        link: { href: 'projects/#real-time-rendering', label: 'Read the full write-up' },
        onWorkIndex: true
    },
    {
        id: 'ai-visual-generation',
        title: 'AI Visual Generation',
        description: 'Extensive experience in creative technologist approaches to AI diffusion, developed cutting-edge upscale techniques for diffusion models, and worked as lead animator and developer for Rohki creating the first AI-assisted anime.',
        meta: 'Innovation',
        paragraphs: [
            'Extensive experience as a creative technologist specializing in AI diffusion, developing cutting-edge upscale techniques for diffusion models that push the boundaries of visual quality and creative possibility.',
            'Served as lead animator and developer for Rohki, developing and creating the first AI-assisted anime and establishing all baseline concepts for commercial technology sold by the company. Additionally, collaborated with creators and dancers in the social media space, creating art appreciated by millions of people worldwide.'
        ],
        highlights: [
            'Lead Animator & Developer for Rohki - First AI-assisted anime',
            'Developed cutting-edge upscale techniques for diffusion models',
            'Created baseline concepts for commercial AI technology',
            'Collaborated with social media creators - millions of views',
            'Pioneered creative technologist approaches to AI diffusion'
        ],
        technologies: ['Stable Diffusion', 'ComfyUI', 'RunwayML', 'Real-Time AI', 'Video World Models', 'Tracking', 'Python', 'TouchDesigner'],
        instagram: 'https://www.instagram.com/p/CvvEvppALiP/embed',
        youtube: 'QLV0sKfxk9s',
        link: { href: 'projects/rohki-project-odyssey.html', label: 'Rohki and Project Odyssey' },
        onWorkIndex: false
    },
    {
        id: 'touchdesigner-systems',
        title: 'TouchDesigner Systems',
        description: 'Developed TouchDesigner visuals for interactive installations at events such as the Daydream Real-Time AI Summit and ComfyUI Events using Real-Time AI and Real-Time Tracking innovations.',
        meta: 'Technical Excellence',
        paragraphs: [
            'Developed TouchDesigner visuals for interactive installations at prestigious events including the Daydream Real-Time AI Summit and ComfyUI Events, showcasing cutting-edge Real-Time AI integration and Real-Time Tracking innovations.',
            'Specialized in creating immersive, reactive visual experiences that bridge the gap between artificial intelligence and live performance, pushing the boundaries of what\'s possible with real-time generative systems.'
        ],
        highlights: [
            'Featured installations at Daydream Real-Time AI Summit',
            'Developed interactive visuals for ComfyUI Events',
            'Pioneered Real-Time AI integration in live performance systems',
            'Implemented Real-Time Tracking for responsive installations',
            'Created seamless AI-driven generative visual experiences'
        ],
        technologies: ['TouchDesigner', 'Real-Time AI', 'Computer Vision', 'GLSL Shaders', 'OSC/MIDI'],
        photo: { src: 'assets/images/touchdesignerimg.png', alt: 'TouchDesigner interactive installation', width: 2538, height: 1348 },
        link: { href: 'projects/#touchdesigner-systems', label: 'Read the full write-up' },
        onWorkIndex: true
    },
    {
        id: 'live-event-visuals',
        title: 'Live Event Visuals',
        description: 'Created time-coded and rendered visual content for major festival artists and companies including Shpongle, Thematic Entertainment, Waste My Life Later, and more.',
        meta: 'Live Events',
        paragraphs: [
            'Specialized in creating high-quality time-coded and pre-rendered visual content for music festivals and live performances. Worked with renowned companies and artists including Thematic Entertainment, Waste My Life Later, and Shpongle to deliver visually stunning festival experiences.',
            'Expertise spans the full production pipeline from concept to delivery, utilizing industry-leading tools like Notch, Cinema 4D, Octane Render, and After Effects to create content that synchronizes perfectly with music and enhances live performances.'
        ],
        highlights: [
            'Performed live visuals for Shpongle at The Warfield, San Francisco, with Glass Crane and Android Jones',
            'Collaborated with Thematic Entertainment and Waste My Life Later',
            'Specialized in time-coded content for perfect music synchronization',
            'Produced rendered content in Notch, Cinema 4D, and After Effects',
            'Delivered content for major festivals with thousands of attendees',
            'Expertise in Octane Render for high-quality photorealistic visuals'
        ],
        technologies: ['Notch', 'Cinema 4D', 'Octane Render', 'After Effects', 'Resolume', 'Time-Coded Content', 'MIDI'],
        photo: { src: 'assets/images/PXL_20250727_062609308.NIGHT.RAW-01.COVER.jpg', alt: 'Live event visuals on stage', width: 1920, height: 1080 },
        video: { src: 'assets/videos/PXL_20250727_062750151.mp4', poster: 'assets/images/video-thumbnails/PXL_20250727_062750151.jpg' },
        link: { href: 'projects/#live-event-visuals', label: 'Read the full write-up' },
        onWorkIndex: true
    },
    {
        id: '3d-animation-pipeline',
        title: '3D Animation Pipeline',
        description: 'AI-accelerated 3D workflows integrating artificial intelligence for image texture generation, composition refinement, moodboard reference, and model design—with human oversight at every creative decision.',
        meta: 'Workflow Innovation',
        paragraphs: [
            'Developed innovative 3D animation workflows that strategically integrate AI tools to dramatically accelerate production while maintaining complete creative control. AI is employed to speed up four key areas: image texture generation, composition refinement, moodboard reference creation, and initial model design exploration.',
            'The workflow maintains human inference at every step—AI serves as a powerful assistant rather than a replacement for artistic judgment. For texture generation, AI rapidly produces variations that artists refine and perfect. In composition, AI suggests layouts and arrangements that are then adjusted to meet precise creative vision. Moodboard references are AI-generated to quickly explore visual directions, with final selections made by human curators. Model design benefits from AI-assisted concept exploration, allowing rapid iteration of forms that are then sculpted and refined by 3D artists.',
            'This approach combines the speed and exploratory power of AI with the irreplaceable nuance of human creativity. By keeping artists in control at every decision point, the workflow produces work that maintains artistic integrity while meeting tight production deadlines. The system has been refined through real production environments, creating a sustainable pipeline that respects both the efficiency demands of modern studios and the craft of traditional 3D artistry.'
        ],
        highlights: [
            'AI-accelerated texture generation with human refinement and selection',
            'Composition refinement using AI suggestions with artist final approval',
            'Rapid moodboard reference creation for visual direction exploration',
            'AI-assisted model design for quick concept iteration and development',
            'Human inference maintained at every creative decision point',
            'Sustainable pipeline balancing efficiency with artistic craft',
            'Battle-tested in real production environments with demanding deadlines'
        ],
        technologies: ['Cinema 4D', 'Houdini', 'Octane Render', 'AI Integration', 'Stable Diffusion', 'X-Particles', 'Python Scripting', 'Procedural Generation', 'ComfyUI', 'Video Upscaling'],
        video: { src: 'assets/videos/newwatcher_tvai_optimized.mp4', poster: 'assets/images/video-thumbnails/newwatcher_tvai_optimized.jpg' },
        link: { href: 'projects/#3d-animation-pipeline', label: 'Read the full write-up' },
        onWorkIndex: true
    }
];

// Services (Services page in full; the home page shows the title and first sentence).
const services = [
    { title: 'Live VJ Performance', text: 'Real-time visual performances synchronized with music. We bring the visuals, the hardware knowledge, and the instinct to read a crowd.', points: ['Real-time visuals via TouchDesigner / Resolume', 'Audio-reactive content synced to DJ sets', 'On-site VJ operation for your event', 'Multi-screen and LED wall support'] },
    { title: 'Pre-Rendered Content', text: 'Custom motion graphics packages designed for your event\'s visual identity. Delivered in any resolution, any aspect ratio, ready to play.', points: ['Custom loops and transitions', 'Branded visual packages', '4K / 8K LED wall content', 'Cinema 4D, After Effects, Notch'] },
    { title: 'Interactive Installations', text: 'Sensor-driven, crowd-reactive visual systems that respond to movement, sound, and environment in real time.', points: ['Motion-tracked reactive visuals', 'Projection mapping', 'Custom TouchDesigner systems', 'Immersive spatial experiences'] },
    { title: 'AI-Driven Visuals', text: 'Cutting-edge generative art and AI-assisted visual workflows. We build custom pipelines that produce visuals no one else can.', points: ['Custom Stable Diffusion pipelines', 'Real-time AI visual generation', 'ComfyUI workflow development', 'Generative art for events and brands'] },
    { title: 'Brand & Commercial', text: 'Motion graphics for brands, product launches, and commercial campaigns. Visuals that move with purpose and tell your story.', points: ['Brand identity motion packages', 'Product launch visuals', 'Social media content', 'Commercial animation'] },
    { title: 'Technical Consulting', text: 'Already have a vision but need the technical expertise? We consult on LED systems, visual workflows, and real-time graphics pipelines.', points: ['LED wall spec and setup guidance', 'Visual system architecture', 'Workflow optimization', 'Team training and mentorship'] }
];

const practice = ['3D animation', '3D sculpting', 'Live visuals and VJ performance', 'LED and large-format display content', 'Generative video', 'Diffusion model fine-tuning', 'StreamDiffusion', 'Notch', 'TouchDesigner', 'ComfyUI', 'AI software development'];

// Pictures that play on the LED wall of the 3D truss cathedral (the closing scene of the home page).
// Upright ones only: the wall is 9:16.
const venuePics = [
    'assets/images/newidk.jpg',
    'assets/images/hallway_Main0006_00000.jpg',
    'assets/images/woman_00000.jpg',
    'assets/images/thelostgirl4 (00000).jpg',
    'assets/images/newidk2.jpg',
    'assets/images/thelostgirl2_00000.jpg'
];

module.exports = { LINKS, work, gallery, showcase, venuePics, team, achievements, services, practice };
