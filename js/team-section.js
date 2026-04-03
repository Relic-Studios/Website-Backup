// Team Section Component
// Manages team member profiles with tabs, photos, descriptions, and showreels

class TeamSection {
    constructor(containerSelector, teamData) {
        console.log('TeamSection constructor called with', teamData.length, 'members');
        this.container = document.querySelector(containerSelector);
        if (!this.container) {
            console.error(`Container ${containerSelector} not found`);
            return;
        }

        console.log('Team container found, initializing...');
        this.teamData = teamData;
        this.currentIndex = 0;

        this.init();
        console.log('Team section initialized successfully');
    }

    init() {
        this.render();
        this.attachEventListeners();
    }

    render() {
        console.log('Rendering team section...');
        // Create section structure
        const section = document.createElement('div');
        section.className = 'team-section';

        // Title
        const title = document.createElement('h3');
        title.className = 'team-section-title';
        title.textContent = 'Meet The Team';
        section.appendChild(title);
        console.log('Title added');

        // Tabs
        const tabs = document.createElement('div');
        tabs.className = 'team-tabs';

        this.teamData.forEach((member, index) => {
            const tab = document.createElement('button');
            tab.className = `team-tab ${index === 0 ? 'active' : ''}`;
            tab.setAttribute('data-index', index);
            tab.textContent = member.name;
            tabs.appendChild(tab);
            console.log('Tab added for', member.name);
        });

        section.appendChild(tabs);
        console.log('Tabs container added, total tabs:', this.teamData.length);

        // Content containers
        this.teamData.forEach((member, index) => {
            const content = this.createMemberContent(member, index);
            section.appendChild(content);
            console.log('Content added for', member.name);
        });

        this.container.appendChild(section);
        console.log('Team section appended to container');
    }

    createMemberContent(member, index) {
        const content = document.createElement('div');
        content.className = `team-content ${index === 0 ? 'active' : ''}`;
        content.setAttribute('data-index', index);
        // Explicitly set display for first member
        if (index === 0) {
            content.style.display = 'grid';
        }

        // Photo Container
        const photoContainer = document.createElement('div');
        photoContainer.className = 'team-photo-container';

        // Create flip container for 3D flip effect
        const flipContainer = document.createElement('div');
        flipContainer.className = 'photo-flip-container';

        // Front side (original photo)
        const frontSide = document.createElement('div');
        frontSide.className = 'photo-flip-front';

        const photoFront = document.createElement('img');
        photoFront.className = 'team-photo';
        photoFront.src = member.photo;
        photoFront.alt = member.name;
        photoFront.loading = 'lazy';
        frontSide.appendChild(photoFront);

        const overlayFront = document.createElement('div');
        overlayFront.className = 'team-photo-overlay';
        overlayFront.innerHTML = `
            <p class="team-role">${member.role}</p>
            <h4 class="team-name">${member.displayName || member.name}</h4>
        `;
        frontSide.appendChild(overlayFront);

        // Back side (alternate photo)
        const backSide = document.createElement('div');
        backSide.className = 'photo-flip-back';

        const photoBack = document.createElement('img');
        photoBack.className = 'team-photo';
        photoBack.src = member.alternatePhoto || member.photo;
        photoBack.alt = member.name;
        photoBack.loading = 'lazy';
        backSide.appendChild(photoBack);

        const overlayBack = document.createElement('div');
        overlayBack.className = 'team-photo-overlay';
        overlayBack.innerHTML = `
            <p class="team-role">${member.role}</p>
            <h4 class="team-name">${member.displayName || member.name}</h4>
        `;
        backSide.appendChild(overlayBack);

        // Add both sides to flip container
        flipContainer.appendChild(frontSide);
        flipContainer.appendChild(backSide);
        photoContainer.appendChild(flipContainer);

        // Add click tracking for flip effect
        let clickCount = 0;
        photoContainer.addEventListener('click', () => {
            clickCount++;
            if (clickCount === 5) {
                flipContainer.classList.toggle('flipped');
                clickCount = 0; // Reset counter after flip
            }
        });

        content.appendChild(photoContainer);

        // Info Container
        const infoContainer = document.createElement('div');
        infoContainer.className = 'team-info';

        // Description
        const description = document.createElement('div');
        description.className = 'team-description';
        description.innerHTML = `
            <h3>About</h3>
            <p>${member.description}</p>
        `;

        // Skills (if provided)
        if (member.skills && member.skills.length > 0) {
            const skillsContainer = document.createElement('div');
            skillsContainer.className = 'team-skills';
            member.skills.forEach(skill => {
                const skillTag = document.createElement('span');
                skillTag.className = 'team-skill-tag';
                skillTag.textContent = skill;
                skillsContainer.appendChild(skillTag);
            });
            description.appendChild(skillsContainer);
        }

        infoContainer.appendChild(description);

        // Showreel
        if (member.showreel) {
            const showreel = document.createElement('div');
            showreel.className = 'team-showreel';
            showreel.innerHTML = `
                <h3>Work Example</h3>
                <div class="showreel-container">
                    ${this.createShowreelContent(member.showreel)}
                </div>
            `;
            infoContainer.appendChild(showreel);
        }

        content.appendChild(infoContainer);

        return content;
    }

    createShowreelContent(showreel) {
        // Support both local video files and YouTube/Vimeo embeds
        if (showreel.type === 'video') {
            return `
                <video controls preload="metadata">
                    <source src="${showreel.src}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            `;
        } else if (showreel.type === 'youtube') {
            return `
                <iframe
                    src="https://www.youtube.com/embed/${showreel.videoId}?rel=0&modestbranding=1&showinfo=0"
                    style="border: none; width: 100%; height: 100%; position: absolute; top: 0; left: 0;"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen>
                </iframe>
            `;
        } else if (showreel.type === 'vimeo') {
            return `
                <iframe
                    src="https://player.vimeo.com/video/${showreel.videoId}?title=0&byline=0&portrait=0"
                    style="border: none; width: 100%; height: 100%; position: absolute; top: 0; left: 0;"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowfullscreen>
                </iframe>
            `;
        }
        return '';
    }

    attachEventListeners() {
        const tabs = this.container.querySelectorAll('.team-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const index = parseInt(tab.getAttribute('data-index'));
                this.switchTab(index);
            });
        });
    }

    switchTab(index) {
        if (index === this.currentIndex) return;

        // Update tabs
        const tabs = this.container.querySelectorAll('.team-tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        tabs[index].classList.add('active');

        // Update content
        const contents = this.container.querySelectorAll('.team-content');
        contents.forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none';
        });

        contents[index].classList.add('active');
        contents[index].style.display = 'grid';

        this.currentIndex = index;
    }

    destroy() {
        this.container.innerHTML = '';
    }
}

// Export
window.TeamSection = TeamSection;
