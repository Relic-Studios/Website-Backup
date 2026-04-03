// Get Involved Section Interactive Elements

(function() {
    'use strict';

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        initializeTabs();
        initializeScrollAnimations();
        initializeCounterAnimations();
    }

    // Tab Functionality
    function initializeTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        if (tabButtons.length === 0) return;

        tabButtons.forEach((button, index) => {
            button.addEventListener('click', () => {
                // Remove active class from all buttons and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // Add active class to clicked button and corresponding content
                button.classList.add('active');
                if (tabContents[index]) {
                    tabContents[index].classList.add('active');
                }
            });
        });

        // Activate first tab by default
        if (tabButtons[0] && tabContents[0]) {
            tabButtons[0].classList.add('active');
            tabContents[0].classList.add('active');
        }
    }

    // Scroll Animations
    function initializeScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -100px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        // Animate cards on scroll
        const cards = document.querySelectorAll('.principle-card, .feature-card, .timeline-item');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            card.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
            observer.observe(card);
        });
    }

    // Counter Animation for Statistics
    function initializeCounterAnimations() {
        const counters = document.querySelectorAll('[data-counter]');

        if (counters.length === 0) return;

        const observerOptions = {
            threshold: 0.5
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
                    animateCounter(entry.target);
                    entry.target.classList.add('counted');
                }
            });
        }, observerOptions);

        counters.forEach(counter => observer.observe(counter));
    }

    function animateCounter(element) {
        const target = parseInt(element.getAttribute('data-counter'));
        const duration = 2000; // 2 seconds
        const increment = target / (duration / 16); // 60fps
        let current = 0;

        const updateCounter = () => {
            current += increment;
            if (current < target) {
                element.textContent = Math.floor(current);
                requestAnimationFrame(updateCounter);
            } else {
                element.textContent = target;
            }
        };

        updateCounter();
    }

    // Smooth scroll to contact section
    function scrollToContact() {
        const contactSection = document.getElementById('contact');
        if (contactSection) {
            contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // Smooth scroll to application form
    function scrollToForm() {
        const formSection = document.getElementById('application-form');
        if (formSection) {
            formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // Netlify Forms handles the submission natively
    // No JavaScript interception needed - form will submit to Netlify and redirect to success page

    // Export functions for external use
    window.getInvolved = {
        scrollToContact: scrollToContact
    };

    // Export scrollToForm globally for inline onclick handler
    window.scrollToForm = scrollToForm;

    // Add hover effect to framework pills
    const frameworkPills = document.querySelectorAll('.framework-pill');
    frameworkPills.forEach(pill => {
        pill.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px) scale(1.05)';
        });

        pill.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });

    // Parallax effect for timeline dots
    window.addEventListener('scroll', () => {
        const timelineDots = document.querySelectorAll('.timeline-dot');
        const scrollPosition = window.pageYOffset;

        timelineDots.forEach((dot, index) => {
            const speed = 0.5;
            const yPos = -(scrollPosition * speed * (index % 2 === 0 ? 1 : -1)) * 0.02;
            dot.style.transform = `translate(-50%, ${yPos}px)`;
        });
    });

    // Add glitch effect to section title on hover
    const sectionTitles = document.querySelectorAll('.get-involved-container h3');
    sectionTitles.forEach(title => {
        title.addEventListener('mouseenter', function() {
            this.style.textShadow = '2px 2px 4px rgba(255,255,255,0.3)';
        });

        title.addEventListener('mouseleave', function() {
            this.style.textShadow = 'none';
        });
    });

})();
