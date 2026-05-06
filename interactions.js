// ============================================================
//  Snyf — Interactions & Animations
//  Institutional Light Mode
// ============================================================

// ── 0. Preloader Logic ───────────────────────────────────────
(function() {
    const preloader = document.getElementById('preloader');
    if (!preloader) return;

    const logo = preloader.querySelector('.preloader-logo');
    const bar = preloader.querySelector('.preloader-bar');
    const fill = preloader.querySelector('.preloader-fill');
    const status = preloader.querySelector('.preloader-status');
    const body = document.body;
    const gsap = window.gsap;

    if (!gsap) {
        // Fallback if GSAP fails to load
        window.addEventListener('load', () => {
            preloader.style.display = 'none';
            body.classList.remove('loading');
        });
        return;
    }

    // ── Preloader Data Stream ──────────────────────────────────
    const bg = preloader.querySelector('.preloader-bg');
    const technicalTerms = [
        "VERIFYING_IDENTITY", "AUTHENTICATING_SOURCE", "AI_SYNTHESIS_ACTIVE",
        "FRAUD_DETECTION_RUNNING", "LOCAL_INTEL_INDEXING", "TRUTH_INDEX_V2.1",
        "DATA_INTEGRITY_CHECK", "BOT_BLOCK_PROTOCOL", "VERIFIED_SOURCE",
        "ANALYZING_SENTIMENT", "GEO_LOCATION_CONFIRMED", "TRUST_PROTOCOL_01",
        "NEURAL_VERIFICATION", "CRYPTOGRAPHIC_HASH", "SECURE_HANDSHAKE"
    ];
    
    function spawnBit() {
        if (!preloader || preloader.style.display === 'none') return;
        const bit = document.createElement('div');
        bit.className = 'data-bit';
        bit.textContent = technicalTerms[Math.floor(Math.random() * technicalTerms.length)];
        bit.style.left = Math.random() * 90 + '%';
        bit.style.top = Math.random() * 90 + '%';
        bit.style.fontSize = (Math.random() * 4 + 8) + 'px'; // Varied sizes
        bg.appendChild(bit);
        setTimeout(() => bit.remove(), 3000);
        setTimeout(spawnBit, Math.random() * 400 + 200);
    }
    spawnBit();


    const tl = gsap.timeline();

    // 1. Entrance Animation (Typing Effect)
    const logoText = "Snyf";
    logo.textContent = ""; // Clear initial text
    logo.style.opacity = "1";
    logo.style.transform = "translateY(0)";

    logoText.split("").forEach((char, i) => {
        tl.to({}, {
            duration: 0.15,
            onStart: () => {
                logo.textContent += char;
            }
        });
    });

    tl.call(() => logo.classList.add('glitch'))
      .to(bar, { opacity: 1, duration: 0.6 }, "-=0.2")
      .to(status, { opacity: 1, duration: 0.6 }, "-=0.4")
      .to({}, { duration: 1.0 }) // Stay glitchy for a bit
      .call(() => logo.classList.remove('glitch'));


    let isLoaded = false;
    let progress = 0;


    window.addEventListener('load', () => {
        isLoaded = true;
    });

    const updateProgress = () => {
        // Simulated progress that slows down at 90% if not actually loaded
        let increment = Math.random() * 10;
        if (progress > 80 && !isLoaded) increment *= 0.2; 
        
        progress += increment;
        
        if (progress >= 100 && isLoaded) {
            progress = 100;
            fill.style.width = '100%';
            status.textContent = "Verification Complete.";
            logo.classList.remove('glitch'); // Ensure glitch is off for flight
            finishLoading();
        } else {

            if (progress >= 99) progress = 99;
            fill.style.width = progress + '%';
            
            if (progress > 30 && progress < 60) status.textContent = "Authenticating Node Identities...";
            if (progress > 60 && progress < 90) status.textContent = "Synthesizing Local Intelligence...";
            if (progress > 90) status.textContent = "Finalizing Secure Handshake...";

            setTimeout(updateProgress, 60 + Math.random() * 100);
        }
    };

    const finishLoading = () => {
        const navLogo = document.getElementById('nav-logo');
        
        // 1. Measure target position while still hidden
        const targetRect = navLogo ? navLogo.getBoundingClientRect() : { top: 20, left: 20, width: 100 };
        const currentRect = logo.getBoundingClientRect();
        const targetScale = navLogo ? parseFloat(window.getComputedStyle(navLogo).fontSize) / parseFloat(window.getComputedStyle(logo).fontSize) : 0.4;

        const exitTl = gsap.timeline({
            onComplete: () => {
                preloader.style.display = 'none';
                if (typeof AOS !== 'undefined') {
                    AOS.init({
                        once: true,
                        offset: 60,
                        duration: 800,
                        easing: 'ease-out-cubic',
                    });
                }
            }
        });

        // 2. Animation Sequence: Tightened and simultaneous
        exitTl.to([bar, status], { 
            opacity: 0, 
            y: -10, 
            duration: 0.3, 
            stagger: 0.05, 
            ease: "power2.in" 
        })
        .to(logo, {
            x: targetRect.left - currentRect.left + (targetRect.width - currentRect.width * targetScale) / 2,
            y: targetRect.top - currentRect.top + (targetRect.height - currentRect.height * targetScale) / 2,
            scale: targetScale,
            duration: 1.0,
            ease: "power4.inOut",
            onStart: () => {
                body.classList.remove('loading');
                if (navLogo) navLogo.style.opacity = '0';
            },
            onComplete: () => {
                if (navLogo) navLogo.style.opacity = '1';
                gsap.to(logo, { opacity: 0, duration: 0.1 });
            }
        }, "-=0.2") // Slight overlap with bar fade-out
        .to(preloader, { 
            opacity: 0, 
            duration: 0.7, 
            ease: "power2.inOut"
        }, "-=0.7");
    };




    updateProgress();
})();

const isFinePonter = window.matchMedia('(pointer: fine)').matches;
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── 1. Custom Cursor ─────────────────────────────────────────
// Cursor ring color is controlled by CSS: border-color #1A1A1A
if (isFinePonter && !prefersReduced) {
    document.body.classList.add('has-cursor');

    const ring = document.getElementById('cursor-ring');
    const dot = document.getElementById('cursor-dot-el');

    let mx = -200, my = -200, rx = -200, ry = -200;

    document.addEventListener('mousemove', e => {
        mx = e.clientX; my = e.clientY;
        dot.style.transform = `translate(${mx - 3}px, ${my - 3}px)`;
    }, { passive: true, capture: true });

    (function animateRing() {
        rx += (mx - rx) * 0.1;
        ry += (my - ry) * 0.1;
        ring.style.transform = `translate(${rx - 20}px, ${ry - 20}px)`;
        requestAnimationFrame(animateRing);
    })();

    // Expand ring on interactive elements
    const interactives = 'a, button, .feature-card, .problem-card, .value-card, .ai-card, input, label';
    document.querySelectorAll(interactives).forEach(el => {
        el.addEventListener('mouseenter', () => ring.classList.add('expanded'));
        el.addEventListener('mouseleave', () => ring.classList.remove('expanded'));
    });

    // Hide when leaving window
    document.addEventListener('mouseleave', () => { ring.style.opacity = '0'; dot.style.opacity = '0'; });
    document.addEventListener('mouseenter', () => { ring.style.opacity = ''; dot.style.opacity = ''; });
}

// ── 2. Card Mouse-Tracking Spotlight ─────────────────────────
document.querySelectorAll('.feature-card, .problem-card, .value-card').forEach(card => {
    card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
        card.style.setProperty('--spotlight', '1');
    }, { passive: true });
    card.addEventListener('mouseleave', () => {
        card.style.setProperty('--spotlight', '0');
    });
});

// ── 3. AI Card 3D Tilt ────────────────────────────────────────
if (isFinePonter && !prefersReduced) {
    const visual = document.querySelector('.solution-visual');
    const card = document.querySelector('.ai-card');
    if (visual && card) {
        visual.addEventListener('mousemove', e => {
            const r = visual.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            card.style.transform = `perspective(900px) rotateY(${x * 14}deg) rotateX(${-y * 9}deg) translateZ(16px)`;
        }, { passive: true });
        visual.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(900px) rotateY(0) rotateX(0) translateZ(0)';
        });
    }
}

// ── 4. Animated Number Counters ───────────────────────────────
function runCounter(el) {
    const target = parseFloat(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    const decimals = el.dataset.decimals ? parseInt(el.dataset.decimals) : 0;
    const duration = 1600;
    const start = performance.now();

    (function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 4);
        const val = eased * target;
        el.textContent = (decimals ? val.toFixed(decimals) : Math.round(val).toLocaleString()) + suffix;
        if (t < 1) requestAnimationFrame(tick);
    })(start);
}

const counterObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            runCounter(entry.target);
            counterObs.unobserve(entry.target);
        }
    });
}, { threshold: 0.6 });

document.querySelectorAll('.counter').forEach(el => counterObs.observe(el));

// ── 5. Progress Bar Animation ─────────────────────────────────
const barObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.querySelectorAll('.chip-fill').forEach((fill, i) => {
                setTimeout(() => {
                    fill.style.width = fill.dataset.fill + '%';
                }, 150 + i * 120);
            });
            barObs.unobserve(entry.target);
        }
    });
}, { threshold: 0.4 });

const aiBlock = document.querySelector('.ai-review-block');
if (aiBlock) barObs.observe(aiBlock);

// ── 6. Magnetic Buttons ───────────────────────────────────────
if (isFinePonter && !prefersReduced) {
    document.querySelectorAll('.btn-primary').forEach(btn => {
        btn.addEventListener('mousemove', e => {
            const r = btn.getBoundingClientRect();
            const x = (e.clientX - r.left - r.width / 2) * 0.25;
            const y = (e.clientY - r.top - r.height / 2) * 0.25;
            btn.style.transform = `translate(${x}px, ${y}px) translateY(-2px)`;
        }, { passive: true });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
        });
    });
}

// ── 8. Typing / Word-Cycle in Hero ───────────────────────────
if (!prefersReduced) {
    const typingEl = document.getElementById('typing-word');
    if (typingEl) {
        const words = ['Fake Ratings Are Over.', 'Trust Is Restored.', 'The Truth Is Indexed.', 'Bots Are Blocked.', 'Standard Is Set.'];
        let wi = 0, ci = 0, deleting = false;
        const WRITE_MS = 80, DELETE_MS = 45, PAUSE_MS = 2000;

        function type() {
            const word = words[wi];
            if (!deleting) {
                typingEl.textContent = word.slice(0, ++ci);
                if (ci === word.length) { deleting = true; return setTimeout(type, PAUSE_MS); }
                setTimeout(type, WRITE_MS);
            } else {
                typingEl.textContent = word.slice(0, --ci);
                if (ci === 0) { deleting = false; wi = (wi + 1) % words.length; }
                setTimeout(type, DELETE_MS);
            }
        }
        setTimeout(type, 1200);
    }
}

// ── 9. Active Nav Link Highlighting ──────────────────────────
const sections = document.querySelectorAll('section[id]');
const navAs = document.querySelectorAll('.nav-links a[href^="#"]');

const navObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            navAs.forEach(a => a.classList.remove('active'));
            const active = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
            if (active) active.classList.add('active');
        }
    });
}, { rootMargin: '-40% 0px -55% 0px' });

sections.forEach(s => navObs.observe(s));
