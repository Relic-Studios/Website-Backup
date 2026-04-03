# Motion Graphics Portfolio

An interactive Three.js portfolio website showcasing your motion graphics work.

## Setup Instructions

### 1. Add Your Motion Graphics Files

Copy your motion graphics files into the following folders:

- **Videos**: Place video files (MP4, MOV, WebM) in `assets/videos/`
- **Images**: Place images (JPG, PNG, GIF) in `assets/images/`
- **Thumbnails**: Place thumbnail images in `assets/images/` (name them thumb1.jpg, thumb2.jpg, etc.)

### 2. Configure Your Gallery

Edit `js/main.js` and update the `portfolioConfig.galleryItems` array with your projects:

```javascript
galleryItems: [
    {
        type: 'video',                          // 'video' or 'image'
        src: 'assets/videos/your-video.mp4',    // Path to your video/image
        thumbnail: 'assets/images/thumb1.jpg',   // Path to thumbnail
        title: 'Your Project Title',             // Project name
        description: 'Project description here'  // Brief description
    },
    // Add more items...
]
```

### 3. Customize Content

#### Update Contact Information
In `index.html`, update the contact links (around line 65):
```html
<a href="mailto:your.email@example.com" class="contact-link">Email</a>
<a href="https://instagram.com/yourhandle" class="contact-link">Instagram</a>
<a href="https://linkedin.com/in/yourprofile" class="contact-link">LinkedIn</a>
```

#### Update About Section
Edit the about section in `index.html` (around line 54) to tell your story.

#### Change Colors
The portfolio uses a teal/cyan color scheme. To change colors, edit these values in `css/style.css`:
- Primary color: `#00ff88` (teal green)
- Secondary color: `#00aaff` (cyan blue)

### 4. Run the Portfolio

Simply open `index.html` in a modern web browser (Chrome, Firefox, Safari, Edge).

For a local server (recommended):
```bash
# Using Python 3
python -m http.server 8000

# Using Node.js
npx http-server

# Using PHP
php -S localhost:8000
```

Then visit: `http://localhost:8000`

## Features

- **Interactive 3D Background**: Particle system and floating geometric shapes using Three.js
- **Responsive Gallery**: Grid layout that adapts to different screen sizes
- **Lightbox Modal**: Click any project to view full-size with navigation
- **Smooth Animations**: Page transitions and hover effects
- **Keyboard Navigation**: Use arrow keys in modal, ESC to close
- **Mobile Friendly**: Fully responsive design

## File Structure

```
Website/
├── index.html          # Main HTML file
├── css/
│   └── style.css       # All styles
├── js/
│   └── main.js         # Three.js scene and portfolio logic
├── assets/
│   ├── videos/         # Your video files go here
│   └── images/         # Your images and thumbnails go here
└── README.md           # This file
```

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

Requires a browser with WebGL support for 3D effects.

## Tips

1. **Video Format**: Use MP4 (H.264) for best browser compatibility
2. **Thumbnail Size**: Recommended 800x450px (16:9 aspect ratio)
3. **File Sizes**: Compress videos to reduce loading times
4. **Performance**: Limit to 10-15 high-quality pieces for optimal performance

## Next Steps

1. Copy your motion graphics files to the `assets` folder
2. Edit `js/main.js` to add your project details
3. Customize colors and text to match your brand
4. Test in a browser
5. Deploy to a web host when ready

Enjoy your new portfolio!
