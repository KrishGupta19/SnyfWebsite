// Force page to start from the top when refreshed
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);
window.addEventListener('beforeunload', () => {
    window.scrollTo(0, 0);
});
window.addEventListener('load', () => {
    window.scrollTo(0, 0);
});

// ── 0. Preloader Logic ───────────────────────────────────────
(function () {
    const preloader    = document.getElementById('preloader');
    if (!preloader) return;

    const chars        = preloader.querySelectorAll('.pl-char');
    const scanBeam     = document.getElementById('pl-scan-beam');
    const underline    = document.getElementById('pl-logo-underline');
    const tagline      = document.getElementById('pl-tagline');
    const progressWrap = document.getElementById('pl-progress-wrap');
    const fill         = document.getElementById('preloader-fill');
    const statusEl     = document.getElementById('preloader-status');
    const pctEl        = document.getElementById('pl-pct');
    const terminal     = document.getElementById('pl-terminal');
    const logoEl       = document.getElementById('preloader-logo');
    const body         = document.body;
    const gsap         = window.gsap;

    // ── Inject helper layers into preloader ──────────
    // Background layer (so we can fade it independently)
    const bgLayer = document.createElement('div');
    bgLayer.className = 'pl-bg-layer';
    preloader.insertBefore(bgLayer, preloader.firstChild);

    // Auth flash overlay
    const authFlash = document.createElement('div');
    authFlash.className = 'pl-auth-flash';
    authFlash.id = 'pl-auth-flash';
    preloader.appendChild(authFlash);

    // Three radar rings inside logo-wrap
    const logoWrap = preloader.querySelector('.pl-logo-wrap');
    if (logoWrap) {
        [1, 2, 3].forEach(n => {
            const ring = document.createElement('div');
            ring.className = `pl-radar-ring${n > 1 ? ' pl-radar-ring-' + n : ''}`;
            ring.id = `pl-ring-${n}`;
            logoWrap.appendChild(ring);
        });
    }

    // ── Scramble config ──────────────────────────────
    const POOL         = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!?';
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

    // Quick scramble used for final pre-flight effect
    function quickScramble(onDone) {
        const targets = ['S','N','Y','F'];
        let done = 0;
        chars.forEach((el, i) => {
            el.classList.remove('decoded');
            el.classList.add('scrambling');
            let iter = 0;
            const id = setInterval(() => {
                iter++;
                if (iter >= 5) {
                    clearInterval(id);
                    el.textContent = targets[i];
                    el.classList.remove('scrambling');
                    el.classList.add('decoded');
                    done++;
                    if (done === chars.length && onDone) onDone();
                } else {
                    el.textContent = POOL[Math.floor(Math.random() * POOL.length)];
                }
            }, 38);
        });
    }

    // ── Progress & log state ─────────────────────────
    let progress = 0;
    let loaded   = false;
    let logIdx   = 0;

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
        for (const [t, label] of STATUS_MAP) {
            if (pct >= t) s = label;
        }
        return s;
    }

    function appendLog() {
        if (logIdx >= LOG_LINES.length) return;
        const line = document.createElement('div');
        line.className = 'pl-log-line';
        line.textContent = LOG_LINES[logIdx++];
        terminal.appendChild(line);
        void line.offsetWidth;
        line.classList.add('active-line');
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

        if (Math.random() < 0.28 && logIdx < LOG_LINES.length) appendLog();

        if (progress >= 100 && loaded) {
            fill.style.width = '100%';
            pctEl.textContent = '100%';
            statusEl.textContent = '✓ AUTHENTICATED';
            statusEl.classList.add('authenticated');
            pctEl.style.color = 'rgba(255,255,255,0.9)';
            triggerAuthMoment();
        } else {
            setTimeout(tickProgress, 55 + Math.random() * 110);
        }
    }

    // ── AUTHENTICATED moment ─────────────────────────
    function triggerAuthMoment() {
        // 1. Fire radar rings
        ['pl-ring-1','pl-ring-2','pl-ring-3'].forEach(id => {
            const ring = document.getElementById(id);
            if (ring) ring.classList.add('fire');
        });

        // 2. White screen flash
        authFlash.style.transition = 'opacity 0.07s ease';
        authFlash.style.opacity = '0.18';
        setTimeout(() => {
            authFlash.style.transition = 'opacity 0.3s ease';
            authFlash.style.opacity = '0';
        }, 120);

        // 3. After flash settles, fly
        setTimeout(beginExit, 600);
    }

    // ── BEGIN EXIT ───────────────────────────────────
    function beginExit() {
        // Step 1: fade out terminal + progress + tagline
        const fadeEls = [progressWrap, terminal, tagline,
                         preloader.querySelector('.pl-eyebrow')].filter(Boolean);

        if (gsap) {
            gsap.to(fadeEls, {
                opacity: 0,
                y: -10,
                duration: 0.28,
                stagger: 0.04,
                ease: 'power2.in',
                onComplete: doFinalScramble
            });
        } else {
            fadeEls.forEach(el => { el.style.opacity = '0'; });
            setTimeout(doFinalScramble, 300);
        }
    }

    // Step 2: final micro-scramble on letters
    function doFinalScramble() {
        setTimeout(() => {
            quickScramble(flyToNav);
        }, 80);
    }

    // ── FLY TO NAV ───────────────────────────────────
    function flyToNav() {
        const navLogo = document.getElementById('nav-logo');
        if (!gsap || !navLogo || !logoEl) {
            fallbackExit();
            return;
        }

        // Make body visible so we can measure navLogo position correctly
        body.classList.remove('loading');

        // Measure after layout is live
        requestAnimationFrame(() => {
            const targetRect  = navLogo.getBoundingClientRect();
            const currentRect = logoEl.getBoundingClientRect();

            const navFS   = parseFloat(window.getComputedStyle(navLogo).fontSize);
            const logoFS  = parseFloat(window.getComputedStyle(logoEl).fontSize);
            const scale   = navFS / logoFS;

            const dx = targetRect.left - currentRect.left
                     + (targetRect.width  - currentRect.width  * scale) / 2;
            const dy = targetRect.top  - currentRect.top
                     + (targetRect.height - currentRect.height * scale) / 2;

            // Hide nav logo while ours is flying in
            navLogo.style.opacity = '0';

            // Simultaneously fade the dark background out
            // so the logo appears to cross from dark → light world
            gsap.to(bgLayer, {
                opacity: 0,
                duration: 0.6,
                ease: 'power2.inOut',
                delay: 0.15
            });

            // Fade grid + scanlines + corners
            const decorEls = preloader.querySelectorAll(
                '.pl-grid, .pl-scanlines, .pl-corner, .pl-logo-underline, .pl-scan-beam'
            );
            gsap.to(decorEls, {
                opacity: 0,
                duration: 0.4,
                ease: 'power2.in'
            });

            // FLY the logo
            gsap.to(logoEl, {
                x: dx,
                y: dy,
                scale: scale,
                duration: 1.0,
                ease: 'power4.inOut',
                onUpdate: function () {
                    // At 55% of the flight, shift color to dark
                    if (this.progress() > 0.55 && logoEl.style.color !== 'rgb(26, 26, 26)') {
                        gsap.to(logoEl, {
                            color: '#1A1A1A',
                            duration: 0.25,
                            ease: 'none'
                        });
                    }
                },
                onComplete: () => {
                    // Snap real nav logo back, hide ours
                    navLogo.style.opacity = '1';
                    navLogo.classList.add('nav-logo-ping');
                    setTimeout(() => navLogo.classList.remove('nav-logo-ping'), 700);
                    gsap.to(logoEl, { opacity: 0, duration: 0.08 });
                    finishPreloader();
                }
            });

            // Fade the whole preloader overlay out toward the end of the flight
            gsap.to(preloader, {
                opacity: 0,
                duration: 0.55,
                ease: 'power2.inOut',
                delay: 0.55
            });
        });
    }

    function finishPreloader() {
        window.scrollTo(0, 0);
        setTimeout(() => {
            preloader.style.display = 'none';
            if (typeof AOS !== 'undefined') {
                AOS.init({
                    once: true,
                    offset: 60,
                    duration: 800,
                    easing: 'ease-out-cubic',
                });
            }
        }, 200);
    }

    function fallbackExit() {
        window.scrollTo(0, 0);
        body.classList.remove('loading');
        preloader.style.transition = 'opacity 0.6s ease';
        preloader.style.opacity = '0';
        setTimeout(() => {
            preloader.style.display = 'none';
            if (typeof AOS !== 'undefined') AOS.init({ once: true });
        }, 650);
    }

    // ── SEQUENCE START ───────────────────────────────
    setTimeout(() => {
        chars.forEach((el, i) => {
            const isLast = i === chars.length - 1;
            setTimeout(() => {
                scrambleChar(el, el.dataset.char, isLast ? onAllDecoded : null);
            }, i * STAGGER_MS);
        });
    }, 500);

    function onAllDecoded() {
        // Fire radar rings on decode
        setTimeout(() => {
            ['pl-ring-1','pl-ring-2','pl-ring-3'].forEach(id => {
                const ring = document.getElementById(id);
                if (ring) ring.classList.add('fire');
            });
        }, 60);

        // Scan beam sweep
        setTimeout(() => {
            scanBeam.classList.add('active');
        }, 100);

        // Underline
        setTimeout(() => {
            underline.classList.add('drawn');
        }, 320);

        // Tagline
        setTimeout(() => {
            tagline.classList.add('visible');
        }, 520);

        // Reset rings so they can fire again at auth moment
        setTimeout(() => {
            ['pl-ring-1','pl-ring-2','pl-ring-3'].forEach(id => {
                const ring = document.getElementById(id);
                if (ring) ring.classList.remove('fire');
            });
        }, 1400);

        // Progress + terminal appear
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

// ── 1. Custom Cybernetic Cursor Tracking ───────────────────────────
(function () {
    const isFinePointer = window.matchMedia('(pointer: fine)').matches;
    if (!isFinePointer) return;

    const dot = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');
    if (!dot || !ring) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    
    let ringX = mouseX;
    let ringY = mouseY;
    let dotX = mouseX;
    let dotY = mouseY;

    window.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    }, { passive: true });

    // Hide on mouseleave window, show on mouseenter
    document.addEventListener('mouseleave', () => {
        dot.style.opacity = '0';
        ring.style.opacity = '0';
    });
    document.addEventListener('mouseenter', () => {
        dot.style.opacity = '1';
        ring.style.opacity = '1';
    });

    // High performance spring interpolation animation frame loop
    function updateCursor() {
        // Instant dot lock for zero lag feel
        dotX += (mouseX - dotX);
        dotY += (mouseY - dotY);
        dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0)`;

        // Spring damped delay loop for elegant organic trailing ring
        ringX += (mouseX - ringX) * 0.15;
        ringY += (mouseY - ringY) * 0.15;
        ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;

        requestAnimationFrame(updateCursor);
    }
    requestAnimationFrame(updateCursor);

    // Interactive element hover detection
    const hoverTargets = 'a, button, input, select, textarea, [role="button"], .feature-card, .visual-mode-toggle, .logo, .pl-char';
    
    function addHoverClass() {
        document.body.classList.add('cursor-hovering');
    }
    function removeHoverClass() {
        document.body.classList.remove('cursor-hovering');
    }

    // Dynamic event delegate listeners for performance
    document.addEventListener('mouseover', e => {
        if (e.target && e.target.closest(hoverTargets)) {
            addHoverClass();
        }
    }, { passive: true });

    document.addEventListener('mouseout', e => {
        if (e.target && !e.target.closest(hoverTargets)) {
            removeHoverClass();
        }
    }, { passive: true });
})();

// ── 2. Card Mouse-Tracking Spotlight ─────────────────────────
document.querySelectorAll('.feature-card, .problem-card, .value-card, .story-content, .ai-card, .hero-intel-card').forEach(card => {
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

    // Tab Visibility Title Toggle (Creative tab away hint)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            document.title = 'Hey! You are missing something... 👀';
        } else {
            document.title = 'Snyf';
        }
    });

    // ── 5. Creative Brand Logo Typing Effect & Interactivity ─────────────
    document.querySelectorAll('.logo').forEach(logo => {
        const textSpan = logo.querySelector('span');
        if (!textSpan) return;

        const originalText = 'Snyf';
        let isTyping = false;
        let typingTimer = null;

        function typeText() {
            if (isTyping) return;
            isTyping = true;
            
            let currentLength = 0;
            textSpan.textContent = '';
            
            logo.classList.add('logo-typing');

            function step() {
                if (currentLength <= originalText.length) {
                    textSpan.textContent = originalText.substring(0, currentLength);
                    currentLength++;
                    typingTimer = setTimeout(step, 80); // Hyper-premium cybernetic type delay
                } else {
                    isTyping = false;
                    logo.classList.remove('logo-typing');
                }
            }
            step();
        }

        // Trigger typing effect on hover
        logo.addEventListener('mouseenter', () => {
            clearTimeout(typingTimer);
            isTyping = false;
            typeText();
        });
    });

})();

