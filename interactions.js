// ============================================================
//  Snyf — Interactions & Animations
//  Institutional Light Mode
// ============================================================

// ── 0. Preloader Logic ───────────────────────────────────────
(function () {
    const preloader = document.getElementById('preloader');
    if (!preloader) return;

    const chars        = preloader.querySelectorAll('.pl-char');
    const scanBeam     = document.getElementById('pl-scan-beam');
    const underline    = document.getElementById('pl-logo-underline');
    const tagline      = document.getElementById('pl-tagline');
    const progressWrap = document.getElementById('pl-progress-wrap');
    const fill         = document.getElementById('preloader-fill');
    const fillGlow     = preloader.querySelector('.pl-fill-glow');
    const statusEl     = document.getElementById('preloader-status');
    const pctEl        = document.getElementById('pl-pct');
    const terminal     = document.getElementById('pl-terminal');
    const body         = document.body;

    // ── Scramble config ──────────────────────────────────────────
    const POOL          = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!?';
    const SCRAMBLE_ITER = 11;
    const ITER_MS       = 42;
    const STAGGER_MS    = 260;

    function scrambleChar(el, target, onDone) {
        let i = 0;
        el.classList.add('scrambling');
        const id = setInterval(() => {
            i++;
            if (i >= SCRAMBLE_ITER) {
                clearInterval(id);
                el.textContent = target;
                el.classList.remove('scrambling');
                el.classList.add('decoded');
                if (onDone) onDone();
            } else {
                el.textContent = POOL[Math.floor(Math.random() * POOL.length)];
            }
        }, ITER_MS);
    }

    // ── Progress & log state ─────────────────────────────────────
    let progress  = 0;
    let loaded    = false;
    let logIdx    = 0;

    window.addEventListener('load', () => { loaded = true; });

    const LOG_LINES = [
        '› SYS_BOOT SEQUENCE COMPLETE',
        '› NEURAL_NETWORK ONLINE',
        '› BOT_DETECTION ENGINE READY',
        '› CONNECTING TO TRUTH INDEX',
        '› FRAUD VECTORS NEUTRALIZED',
        '› IDENTITY PROTOCOLS ACTIVE',
        '› LOCAL INTEL NODES SYNCED',
        '› VERIFICATION ENGINE ARMED',
        '› ALL SYSTEMS NOMINAL',
    ];

    const STATUS_MAP = [
        [0,  'SYS_INIT'],
        [15, 'LOADING_MODULES'],
        [35, 'AUTH_NODES'],
        [55, 'SYNCING_INTEL'],
        [75, 'VERIFYING_SOURCES'],
        [92, 'FINALIZING'],
    ];

    function getStatus(pct) {
        let s = STATUS_MAP[0][1];
        for (const [threshold, label] of STATUS_MAP) {
            if (pct >= threshold) s = label;
        }
        return s;
    }

    function appendLog() {
        if (logIdx >= LOG_LINES.length) return;
        const line = document.createElement('div');
        line.className = 'pl-log-line';
        line.textContent = LOG_LINES[logIdx++];
        terminal.appendChild(line);
        // Force reflow for animation
        void line.offsetWidth;
        line.classList.add('active-line');
        // Keep max 3 lines
        while (terminal.children.length > 3) {
            terminal.removeChild(terminal.firstChild);
        }
    }

    function tickProgress() {
        let step = Math.random() * 7 + 2;
        if (progress > 78 && !loaded) step *= 0.12;
        progress = Math.min(progress + step, loaded ? 100 : 98.5);

        const rounded = Math.round(progress);
        fill.style.width = progress + '%';
        pctEl.textContent = rounded + '%';
        statusEl.textContent = getStatus(rounded);

        // Occasional log line
        if (Math.random() < 0.28 && logIdx < LOG_LINES.length) appendLog();

        if (progress >= 100 && loaded) {
            fill.style.width = '100%';
            pctEl.textContent = '100%';
            pctEl.style.color = 'rgba(255,255,255,0.85)';
            statusEl.textContent = '✓ AUTHENTICATED';
            statusEl.classList.add('authenticated');
            setTimeout(exitPreloader, 520);
        } else {
            setTimeout(tickProgress, 55 + Math.random() * 110);
        }
    }

    // ── EXIT ─────────────────────────────────────────────────────
    function exitPreloader() {
        const gsap    = window.gsap;
        const navLogo = document.getElementById('nav-logo');
        const logoEl  = document.getElementById('preloader-logo');

        if (!gsap || !navLogo || !logoEl) {
            preloader.style.transition = 'opacity 0.6s ease';
            preloader.style.opacity = '0';
            setTimeout(() => {
                preloader.style.display = 'none';
                body.classList.remove('loading');
                if (typeof AOS !== 'undefined') AOS.init({ once: true, offset: 60, duration: 800, easing: 'ease-out-cubic' });
            }, 650);
            return;
        }

        const targetRect  = navLogo.getBoundingClientRect();
        const currentRect = logoEl.getBoundingClientRect();
        const navFontSize = parseFloat(window.getComputedStyle(navLogo).fontSize);
        const logoFontSize = parseFloat(window.getComputedStyle(logoEl).fontSize);
        const targetScale = navFontSize / logoFontSize;

        const exitTl = gsap.timeline({
            onComplete: () => {
                preloader.style.display = 'none';
                body.classList.remove('loading');
                if (typeof AOS !== 'undefined') {
                    AOS.init({ once: true, offset: 60, duration: 800, easing: 'ease-out-cubic' });
                }
            }
        });

        exitTl
            .to([progressWrap, terminal], {
                opacity: 0, y: -10, duration: 0.25, stagger: 0.05, ease: 'power2.in'
            })
            .to([tagline, preloader.querySelector('.pl-eyebrow')], {
                opacity: 0, duration: 0.2, ease: 'power2.in'
            }, '-=0.2')
            .to(logoEl, {
                x: targetRect.left - currentRect.left + (targetRect.width - currentRect.width * targetScale) / 2,
                y: targetRect.top  - currentRect.top  + (targetRect.height - currentRect.height * targetScale) / 2,
                scale: targetScale,
                duration: 0.95,
                ease: 'power4.inOut',
                onStart: () => {
                    body.classList.remove('loading');
                    navLogo.style.opacity = '0';
                },
                onComplete: () => {
                    navLogo.style.opacity = '1';
                    gsap.to(logoEl, { opacity: 0, duration: 0.08 });
                }
            }, '-=0.1')
            .to(preloader, {
                opacity: 0, duration: 0.7, ease: 'power2.inOut'
            }, '-=0.75');
    }

    // ── SEQUENCE START ────────────────────────────────────────────
    // T+0.5s: begin scrambling letters one by one
    setTimeout(() => {
        chars.forEach((el, i) => {
            const isLast = i === chars.length - 1;
            setTimeout(() => {
                scrambleChar(el, el.dataset.char, isLast ? onAllDecoded : null);
            }, i * STAGGER_MS);
        });
    }, 500);

    function onAllDecoded() {
        // Beam sweep
        setTimeout(() => {
            scanBeam.classList.add('active');
        }, 80);

        // Underline draws
        setTimeout(() => {
            underline.classList.add('drawn');
        }, 320);

        // Tagline fades in
        setTimeout(() => {
            tagline.classList.add('visible');
        }, 520);

        // Progress section + terminal appear, tick starts
        setTimeout(() => {
            progressWrap.classList.add('visible');
            terminal.classList.add('visible');
            appendLog();
            appendLog();
            setTimeout(tickProgress, 250);
        }, 820);
    }

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

// ── 10. Visual Mode Toggle & Bento Grid ──────────────────────
(function () {
    const toggle     = document.getElementById('view-toggle');
    const visualMode = document.getElementById('visual-mode');
    const pill       = toggle?.querySelector('.vt-pill');
    const readOpt    = toggle?.querySelector('.vt-opt--read');
    const visualOpt  = toggle?.querySelector('.vt-opt--visual');
    const body       = document.body;
    const gsap       = window.gsap;

    if (!toggle || !visualMode) return;

    let isVisual = localStorage.getItem('snyfView') === 'visual';

    function triggerWipe(callback) {
        const wipe = document.getElementById('hud-wipe');
        if (!wipe) return callback();
        wipe.classList.remove('active');
        void wipe.offsetWidth;
        wipe.classList.add('active');
        setTimeout(callback, 400);
    }

    // ── Pill positioning ──────────────────────────────
    function positionPill(mode) {
        if (!pill || !readOpt || !visualOpt) return;
        if (mode === 'visual') {
            pill.style.width     = visualOpt.offsetWidth + 'px';
            pill.style.transform = `translateX(${readOpt.offsetWidth}px)`;
        } else {
            pill.style.width     = readOpt.offsetWidth + 'px';
            pill.style.transform = 'translateX(0)';
        }
    }

    // ── Animate metric fills ──────────────────────────
    function animateFills() {
        visualMode.querySelectorAll('.vmc-metric-fill').forEach((el, i) => {
            el.style.width = '0%';
            setTimeout(() => {
                el.style.width = (el.dataset.fill || 0) + '%';
            }, 350 + i * 130);
        });
    }

    // ── Page sections list ────────────────────────────
    function getPageSections() {
        return document.querySelectorAll(
            '.hero, .proof-section, .marquee-strip, .section, .top-banner'
        );
    }

    // ── ENTER ─────────────────────────────────────────
    function enterVisual() {
        triggerWipe(() => {
            isVisual = true;
            localStorage.setItem('snyfView', 'visual');
            window.scrollTo(0, 0);
            body.classList.add('visual-mode-on');
            positionPill('visual');

            if (window.snyfTransitionAct) window.snyfTransitionAct(3);

            const sections = getPageSections();

            if (gsap) {
                gsap.to(sections, {
                    opacity: 0, scale: 0.97, duration: 0.3, ease: 'power2.in',
                    onComplete: () => sections.forEach(s => s.style.visibility = 'hidden')
                });
                visualMode.style.visibility = 'visible';
                const cards = visualMode.querySelectorAll('.vm-card');
                gsap.fromTo(visualMode, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out', delay: 0.2 });
                gsap.fromTo(cards,
                    { opacity: 0, y: 24, scale: 0.96 },
                    { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.07,
                      ease: 'power3.out', delay: 0.3,
                      onStart: animateFills }
                );
            } else {
                sections.forEach(s => { s.style.visibility = 'hidden'; s.style.opacity = '0'; });
                visualMode.style.visibility = 'visible';
                visualMode.style.opacity = '1';
                animateFills();
            }

            visualMode.setAttribute('aria-hidden', 'false');
        });
    }

    // ── EXIT ──────────────────────────────────────────
    function exitVisual() {
        triggerWipe(() => {
            isVisual = false;
            localStorage.setItem('snyfView', 'read');
            body.classList.remove('visual-mode-on');
            positionPill('read');

            if (window.snyfTransitionAct) window.snyfTransitionAct(1);
            if (window.ScrollTrigger) window.ScrollTrigger.refresh();

            const sections = getPageSections();

            if (gsap) {
                const cards = visualMode.querySelectorAll('.vm-card');
                gsap.to(cards, {
                    opacity: 0, y: -16, scale: 0.97, duration: 0.25, stagger: 0.04,
                    ease: 'power2.in',
                    onComplete: () => {
                        visualMode.style.visibility = 'hidden';
                        visualMode.style.opacity = '0';
                        gsap.set(cards, { clearProps: 'all' });
                    }
                });
                sections.forEach(s => { s.style.visibility = 'visible'; });
                gsap.to(sections, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out', delay: 0.2 });
            } else {
                visualMode.style.visibility = 'hidden';
                visualMode.style.opacity = '0';
                sections.forEach(s => { s.style.visibility = 'visible'; s.style.opacity = '1'; });
            }

            visualMode.setAttribute('aria-hidden', 'true');
        });
    }

    // ── Toggle click ──────────────────────────────────
    toggle.addEventListener('click', () => isVisual ? exitVisual() : enterVisual());

    // ── Exit when nav links clicked ───────────────────
    document.querySelectorAll('.vmc-btn-primary, .vmc-btn-ghost, .nav-links a').forEach(a => {
        a.addEventListener('click', () => { if (isVisual) exitVisual(); });
    });

    // ── Waitlist form handler ─────────────────────────
    const vmForm = document.getElementById('vm-waitlist-form');
    if (vmForm) {
        vmForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name  = document.getElementById('vm-wl-name').value.trim();
            const email = document.getElementById('vm-wl-email').value.trim();
            const type  = vmForm.querySelector('input[name="vm-type"]:checked')?.value || 'user';
            const btn   = vmForm.querySelector('.vmc-submit');
            btn.disabled = true;
            btn.textContent = 'Sending…';
            try {
                const res = await fetch('/.netlify/functions/waitlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, type }),
                });
                if (!res.ok) throw new Error();
                btn.textContent = '✓ You\'re in!';
                btn.style.background = 'rgba(80,200,120,0.9)';
                btn.style.color = '#000';
            } catch {
                btn.disabled = false;
                btn.textContent = 'Try Again';
            }
        });
    }

    // ── Mouse spotlight & Magnetic Tilt ─────────────────
    visualMode.querySelectorAll('.vm-card').forEach(card => {
        card.addEventListener('mousemove', e => {
            const r = card.getBoundingClientRect();
            const x = e.clientX - r.left;
            const y = e.clientY - r.top;
            
            // Spotlight
            card.style.setProperty('--mx', x + 'px');
            card.style.setProperty('--my', y + 'px');
            card.style.setProperty('--spotlight', '1');

            // Magnetic Tilt
            const dx = (x - r.width / 2) / (r.width / 2);
            const dy = (y - r.height / 2) / (r.height / 2);
            gsap.to(card, {
                rotateY: dx * 4,
                rotateX: -dy * 4,
                x: dx * 8,
                y: dy * 8,
                duration: 0.4,
                ease: 'power2.out'
            });
        }, { passive: true });

        card.addEventListener('mouseleave', () => {
            card.style.setProperty('--spotlight', '0');
            gsap.to(card, {
                rotateY: 0,
                rotateX: 0,
                x: 0,
                y: 0,
                duration: 0.6,
                ease: 'elastic.out(1, 0.3)'
            });
        });
    });

    // ── Init ──────────────────────────────────────────
    requestAnimationFrame(() => {
        positionPill(isVisual ? 'visual' : 'read');
        if (isVisual) enterVisual();
    });

})();

