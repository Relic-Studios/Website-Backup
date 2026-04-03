// FocusCards Component - Vanilla JS Implementation
// Inspired by Aceternity UI

class FocusCards {
    constructor(containerSelector, cards, options = {}) {
        this.container = document.querySelector(containerSelector);
        if (!this.container) {
            console.error(`Container ${containerSelector} not found`);
            return;
        }

        this.cards = cards;
        this.options = {
            defaultFilter: options.defaultFilter || 'image',
            enableModal: options.enableModal !== false,
            ...options
        };

        this.currentFilter = this.options.defaultFilter;
        this.modal = null;
        this.currentIndex = 0;

        this.init();
    }

    init() {
        this.container.innerHTML = '';
        this.container.className = 'focus-cards-container';
        this.renderCards();

        if (this.options.enableModal) {
            this.setupModal();
        }
    }

    filterCards(filter) {
        this.currentFilter = filter;
        this.renderCards();
    }

    renderCards() {
        this.container.innerHTML = '';

        const filteredCards = this.currentFilter === 'all'
            ? this.cards
            : this.cards.filter(card => card.type === this.currentFilter);

        filteredCards.forEach((card, index) => {
            const cardElement = this.createCard(card, index);
            this.container.appendChild(cardElement);
        });

        // Add intersection observer for scroll animations
        this.observeCards();
    }

    createCard(card, index) {
        const cardDiv = document.createElement('div');
        cardDiv.className = `focus-card ${card.type}-card`;
        cardDiv.setAttribute('data-index', index);

        // Create loading placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'focus-card-placeholder';
        cardDiv.appendChild(placeholder);

        // Create media element
        let mediaElement;
        if (card.type === 'video' || card.type === 'live') {
            // For videos and live, use poster image
            mediaElement = document.createElement('img');
            mediaElement.src = card.thumbnail || card.src;
            mediaElement.alt = card.title || 'Video thumbnail';
        } else {
            mediaElement = document.createElement('img');
            mediaElement.src = card.src;
            mediaElement.alt = card.title || 'Gallery image';
        }
        mediaElement.className = 'focus-card-image';
        mediaElement.loading = 'lazy';
        mediaElement.decoding = 'async'; // Async image decoding for performance

        // Error handling for missing images
        mediaElement.onerror = () => {
            console.warn(`Failed to load image: ${mediaElement.src}`);
            placeholder.innerHTML = `<span style="color: #666;">Image unavailable</span>`;
            placeholder.style.display = 'flex';
        };

        // Remove placeholder when image loads
        mediaElement.onload = () => {
            placeholder.style.display = 'none';
            mediaElement.style.opacity = '1';
        };

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'focus-card-overlay';

        const title = document.createElement('h3');
        title.className = 'focus-card-title';
        title.textContent = card.title || `${card.type.charAt(0).toUpperCase() + card.type.slice(1)} ${index + 1}`;
        overlay.appendChild(title);

        if (card.description) {
            const description = document.createElement('p');
            description.className = 'focus-card-description';
            description.textContent = card.description;
            overlay.appendChild(description);
        }

        cardDiv.appendChild(mediaElement);
        cardDiv.appendChild(overlay);

        // Add click handler
        if (this.options.enableModal) {
            cardDiv.addEventListener('click', () => this.openModal(index));
        }

        return cardDiv;
    }

    observeCards() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'scale(1) translateY(0)';
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '50px'
        });

        this.container.querySelectorAll('.focus-card').forEach(card => {
            observer.observe(card);
        });
    }

    setupModal() {
        // Use existing modal or create new one
        this.modal = document.getElementById('gallery-modal');
        if (!this.modal) {
            console.warn('Gallery modal not found');
            return;
        }

        const closeBtn = this.modal.querySelector('.modal-close');
        const prevBtn = this.modal.querySelector('.modal-nav.prev');
        const nextBtn = this.modal.querySelector('.modal-nav.next');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.navigateModal(-1));
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.navigateModal(1));
        }

        // Close on background click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (this.modal.style.display === 'flex') {
                if (e.key === 'Escape') this.closeModal();
                if (e.key === 'ArrowLeft') this.navigateModal(-1);
                if (e.key === 'ArrowRight') this.navigateModal(1);
            }
        });
    }

    openModal(index) {
        if (!this.modal) return;

        this.currentIndex = index;
        const filteredCards = this.currentFilter === 'all'
            ? this.cards
            : this.cards.filter(card => card.type === this.currentFilter);

        const card = filteredCards[index];
        const container = this.modal.querySelector('#modal-media-container');

        if (!container) return;

        container.innerHTML = '';

        if (card.type === 'video' || card.type === 'live') {
            const video = document.createElement('video');
            video.src = card.src;
            video.controls = true;
            video.autoplay = true;
            video.loop = true;
            video.preload = 'metadata'; // Only preload metadata for performance
            video.playsInline = true; // Better mobile playback
            container.appendChild(video);
        } else {
            const img = document.createElement('img');
            img.src = card.src;
            img.alt = card.title || 'Gallery image';
            img.decoding = 'async'; // Async decoding
            container.appendChild(img);
        }

        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        if (!this.modal) return;

        this.modal.style.display = 'none';
        document.body.style.overflow = 'auto';

        // Stop any playing videos
        const video = this.modal.querySelector('video');
        if (video) {
            video.pause();
            video.currentTime = 0;
        }
    }

    navigateModal(direction) {
        const filteredCards = this.currentFilter === 'all'
            ? this.cards
            : this.cards.filter(card => card.type === this.currentFilter);

        this.currentIndex = (this.currentIndex + direction + filteredCards.length) % filteredCards.length;
        this.openModal(this.currentIndex);
    }

    destroy() {
        this.container.innerHTML = '';
    }
}

// Export for use
window.FocusCards = FocusCards;
