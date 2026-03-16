// ============================================================
//  Snyf — Interactions & Animations
//  Institutional Light Mode
// ============================================================

const isFinePonter = window.matchMedia('(pointer: fine)').matches;
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── 1. Custom Cursor ─────────────────────────────────────────
// Cursor ring color is controlled by CSS: border-color #1A1A1A
if (isFinePonter && !prefersReduced) {
    document.body.classList.add('has-cursor');

    const ring = document.getElementById('cursor-ring');
    const dot  = document.getElementById('cursor-dot-el');

    let mx = -200, my = -200, rx = -200, ry = -200;

    document.addEventListener('mousemove', e => {
        mx = e.clientX; my = e.clientY;
        dot.style.transform = `translate(${mx - 3}px, ${my - 3}px)`;
    }, { passive: true });

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
        card.style.setProperty('--my', (e.clientY - r.top)  + 'px');
        card.style.setProperty('--spotlight', '1');
    }, { passive: true });
    card.addEventListener('mouseleave', () => {
        card.style.setProperty('--spotlight', '0');
    });
});

// ── 3. AI Card 3D Tilt ────────────────────────────────────────
if (isFinePonter && !prefersReduced) {
    const visual = document.querySelector('.solution-visual');
    const card   = document.querySelector('.ai-card');
    if (visual && card) {
        visual.addEventListener('mousemove', e => {
            const r = visual.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width  - 0.5;
            const y = (e.clientY - r.top)  / r.height - 0.5;
            card.style.transform = `perspective(900px) rotateY(${x * 14}deg) rotateX(${-y * 9}deg) translateZ(16px)`;
        }, { passive: true });
        visual.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(900px) rotateY(0) rotateX(0) translateZ(0)';
        });
    }
}

// ── 4. Animated Number Counters ───────────────────────────────
function runCounter(el) {
    const target   = parseFloat(el.dataset.target);
    const suffix   = el.dataset.suffix  || '';
    const decimals = el.dataset.decimals ? parseInt(el.dataset.decimals) : 0;
    const duration = 1600;
    const start    = performance.now();

    (function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 4);
        const val   = eased * target;
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
            const x = (e.clientX - r.left - r.width  / 2) * 0.25;
            const y = (e.clientY - r.top  - r.height / 2) * 0.25;
            btn.style.transform = `translate(${x}px, ${y}px) translateY(-2px)`;
        }, { passive: true });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
        });
    });
}

// ── 7. Staggered Card Entrance ────────────────────────────────
document.querySelectorAll('.features-grid .feature-card').forEach((card, i) => {
    card.style.transitionDelay = `${i * 55}ms`;
});
document.querySelectorAll('.cards-grid .problem-card').forEach((card, i) => {
    card.style.transitionDelay = `${i * 80}ms`;
});

// ── 8. Typing / Word-Cycle in Hero ───────────────────────────
if (!prefersReduced) {
    const typingEl = document.getElementById('typing-word');
    if (typingEl) {
        const words = ['Influence Is Over.', 'Trust Is Restored.', 'Truth Is Indexed.', 'Data Is Verified.', 'Standard Is Set.'];
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
const navAs    = document.querySelectorAll('.nav-links a[href^="#"]');

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
