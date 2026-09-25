(() => {
    'use strict';

    const storage = {
        getItem(key) {
            try { return window.localStorage.getItem(key); } catch { return null; }
        },
        setItem(key, value) {
            try { window.localStorage.setItem(key, value); } catch { /* Preferences remain in memory. */ }
        }
    };
    window.addEventListener('pageshow', () => {
        document.body.classList.remove('page-exit');
    });
    const savedTheme = storage.getItem('bemike-theme');
    let isMuted = storage.getItem('bemike-mute') === 'true';

    const themeToggle = document.querySelector('.floating-brand');
    const muteToggle = document.querySelector('.floating-mute');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // The site intentionally starts in light mode unless the visitor has chosen a theme.
    if (savedTheme === null || savedTheme === 'light') {
        document.body.classList.add('light-theme');
    }

    const heroVideos = [...document.querySelectorAll('.hero-video')];
    const hero = document.querySelector('.hero');
    const canAnimateHero = () => heroVideos.length === 2 && !reduceMotion &&
        !window.matchMedia('(max-width: 900px)').matches &&
        !navigator.connection?.saveData &&
        window.CSS?.supports('clip-path', 'circle(0% at 50% 50%)');

    function updateHeroVideo(keepPlaying) {
        if (!heroVideos.length) return;

        const isLight = document.body.classList.contains('light-theme');
        const activeClass = isLight ? 'hero-video-light' : 'hero-video-dark';

        heroVideos.forEach(video => {
            const source = video.querySelector('source[data-src]');
            const shouldPlay = (video.classList.contains(activeClass) || video === keepPlaying) && !reduceMotion &&
                !window.matchMedia('(max-width: 900px)').matches &&
                !navigator.connection?.saveData;

            if (shouldPlay && source && !source.getAttribute('src')) {
                source.src = source.dataset.src;
                video.load();
            }

            if (shouldPlay) {
                video.play().catch(() => {});
            } else {
                video.pause();
            }
        });
    }

    function updateThemeToggle() {
        if (!themeToggle) return;
        const isLightTheme = document.body.classList.contains('light-theme');
        themeToggle.setAttribute('aria-pressed', String(isLightTheme));
        themeToggle.setAttribute(
            'aria-label',
            isLightTheme ? 'Switch to dark theme' : 'Switch to light theme'
        );
    }

    updateThemeToggle();
    updateHeroVideo();

    let themeTransitionTimer;
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            if (hero?.classList.contains('is-morphing')) return;
            window.clearTimeout(themeTransitionTimer);
            document.body.classList.add('theme-transition');
            void document.body.offsetWidth;

            window.requestAnimationFrame(() => {
                const isLightTheme = document.body.classList.toggle('light-theme');
                const incoming = heroVideos.find(video => video.classList.contains(
                    isLightTheme ? 'hero-video-light' : 'hero-video-dark'
                ));
                const outgoing = heroVideos.find(video => video !== incoming);

                if (canAnimateHero() && incoming && outgoing) {
                    // Keep the old scene moving while the new scene grows from its centre.
                    hero.classList.add('is-morphing');
                    incoming.classList.add('is-incoming');
                    outgoing.classList.add('is-outgoing');
                    updateHeroVideo(outgoing);
                    void hero.offsetWidth;
                    window.requestAnimationFrame(() => incoming.classList.add('is-revealing'));

                    window.setTimeout(() => {
                        hero.classList.add('is-morph-complete');
                        incoming.classList.remove('is-incoming', 'is-revealing');
                        outgoing.classList.remove('is-outgoing');
                        hero.classList.remove('is-morphing');
                        updateHeroVideo();
                        window.requestAnimationFrame(() => hero.classList.remove('is-morph-complete'));
                    }, 1450);
                } else {
                    updateHeroVideo();
                }

                storage.setItem('bemike-theme', isLightTheme ? 'light' : 'dark');
                updateThemeToggle();

                themeTransitionTimer = window.setTimeout(() => {
                    document.body.classList.remove('theme-transition');
                }, reduceMotion ? 0 : 650);
            });
        });
    }

    function updateMuteToggle() {
        if (!muteToggle) return;

        muteToggle.setAttribute('aria-pressed', String(isMuted));
        muteToggle.setAttribute('aria-label', isMuted ? 'Unmute local beat previews' : 'Mute local beat previews');
        muteToggle.title = muteToggle.getAttribute('aria-label');

        const svg = muteToggle.querySelector('svg');
        if (!svg) return;

        svg.innerHTML = isMuted
            ? `
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <line x1="23" y1="9" x2="17" y2="15"></line>
                <line x1="17" y1="9" x2="23" y2="15"></line>
            `
            : `
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            `;
    }

    function applyMuteState() {
        document.querySelectorAll('audio').forEach(audio => {
            audio.muted = isMuted;
        });
    }

    updateMuteToggle();
    applyMuteState();

    if (muteToggle) {
        muteToggle.addEventListener('click', () => {
            isMuted = !isMuted;
            storage.setItem('bemike-mute', String(isMuted));
            updateMuteToggle();
            applyMuteState();
        });

        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    if (node.matches?.('audio')) node.muted = isMuted;
                    node.querySelectorAll?.('audio').forEach(audio => {
                        audio.muted = isMuted;
                    });
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Reveal sections only when they approach the viewport.
    const revealElements = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -100px' });

        revealElements.forEach(element => revealObserver.observe(element));
    } else {
        revealElements.forEach(element => element.classList.add('active'));
    }

    // Mobile navigation.
    const menuToggle = document.querySelector('.header-icon-button');
    const navigation = document.querySelector('.header-center');

    if (menuToggle && navigation) {
        navigation.id = 'site-navigation';

        const closeMenu = () => {
            document.body.classList.remove('menu-open', 'menu-scroll-locked');
            menuToggle.setAttribute('aria-expanded', 'false');
            menuToggle.setAttribute('aria-label', 'Open menu');
        };

        menuToggle.addEventListener('click', () => {
            const isOpen = document.body.classList.toggle('menu-open');
            document.body.classList.toggle('menu-scroll-locked', isOpen);
            menuToggle.setAttribute('aria-expanded', String(isOpen));
            menuToggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
        });

        document.addEventListener('click', event => {
            if (!document.body.classList.contains('menu-open') ||
                menuToggle.contains(event.target) || navigation.contains(event.target)) return;
            closeMenu();
        });

        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape' || !document.body.classList.contains('menu-open')) return;
            closeMenu();
            menuToggle.focus();
        });

        navigation.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', closeMenu);
        });
    }

    // Prefetch internal pages on pointer hover, but never interfere with normal navigation.
    const prefetchedPages = new Set();
    document.querySelectorAll('a[href]').forEach(link => {
        link.addEventListener('pointerenter', () => {
            if (link.target === '_blank' || link.hasAttribute('download')) return;
            const destination = new URL(link.href, window.location.href);
            const isInternalPage = destination.origin === window.location.origin &&
                destination.pathname !== window.location.pathname &&
                !prefetchedPages.has(destination.pathname);

            if (!isInternalPage) return;

            const prefetch = document.createElement('link');
            prefetch.rel = 'prefetch';
            prefetch.href = destination.href;
            document.head.appendChild(prefetch);
            prefetchedPages.add(destination.pathname);
        }, { once: true });
    });

    // Short exit cue for ordinary internal navigation. Modified clicks keep browser semantics.
    document.querySelectorAll('a[href]').forEach(link => {
        link.addEventListener('click', event => {
            const destination = new URL(link.href, window.location.href);
            const isInternalPage = destination.origin === window.location.origin &&
                destination.pathname !== window.location.pathname &&
                !event.defaultPrevented &&
                !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey &&
                link.target !== '_blank' &&
                !link.hasAttribute('download') &&
                !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            if (!isInternalPage) return;

            event.preventDefault();
            document.body.classList.add('page-exit');
            window.setTimeout(() => {
                window.location.assign(destination.href);
            }, 140);
        });
    });

    // === WAVEFORM VISUALIZER ===
    const audioElements = [...document.querySelectorAll('audio')];
    const canvasTopEl = document.getElementById('beats-visualizer-top');
    const canvasBottomEl = document.getElementById('beats-visualizer');
    const ctxTop = canvasTopEl?.getContext('2d');
    const ctxBottom = canvasBottomEl?.getContext('2d');

    let audioContext;
    let analyser;
    let dataArray;
    let activeAudio;
    let animationFrameId;
    const connectedAudios = new WeakSet();

    function setCanvasSizes() {
        [canvasTopEl, canvasBottomEl].forEach(canvas => {
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const cssWidth = Math.max(1, Math.round(rect.width || window.innerWidth));
            const cssHeight = 120;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(cssWidth * dpr);
            canvas.height = Math.round(cssHeight * dpr);
            canvas.style.height = `${cssHeight}px`;
            const ctx = canvas.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        });
    }

    function drawBaseLine() {
        [ctxTop, ctxBottom].forEach(ctx => {
            if (!ctx) return;
            const canvas = ctx.canvas;
            const cssWidth = canvas.clientWidth || window.innerWidth;
            const cssHeight = 120;
            ctx.clearRect(0, 0, cssWidth, cssHeight);
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#ff1a1a';
            ctx.shadowColor = '#ff1a1a';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(0, cssHeight / 2);
            ctx.lineTo(cssWidth, cssHeight / 2);
            ctx.stroke();
        });
    }

    if (ctxTop || ctxBottom) {
        setCanvasSizes();
        drawBaseLine();
        window.addEventListener('resize', () => {
            setCanvasSizes();
            drawBaseLine();
        }, { passive: true });
    }

    function setupVisualizer(audio) {
        if (!window.AudioContext && !window.webkitAudioContext) return false;

        if (!audioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioContextClass();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 1024;
            dataArray = new Uint8Array(analyser.fftSize);
        }

        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }

        if (connectedAudios.has(audio)) return true;

        try {
            const source = audioContext.createMediaElementSource(audio);
            source.connect(analyser);
            analyser.connect(audioContext.destination);
            connectedAudios.add(audio);
            return true;
        } catch (error) {
            // A browser may reject connecting the same media element more than once.
            console.warn('Visualizer audio connection unavailable:', error);
            return false;
        }
    }

    function drawOnContext(ctx) {
        if (!ctx || !dataArray) return;
        const canvas = ctx.canvas;
        const width = canvas.clientWidth || window.innerWidth;
        const height = 120;
        ctx.clearRect(0, 0, width, height);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ff1a1a';
        ctx.shadowColor = '#ff1a1a';
        ctx.shadowBlur = 12;
        ctx.beginPath();

        const sliceWidth = width / dataArray.length;
        let x = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * height) / 2;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
        }
        ctx.stroke();
    }

    function animateWaveGlow() {
        if (!analyser || !activeAudio || activeAudio.paused || activeAudio.ended) {
            animationFrameId = undefined;
            return;
        }

        analyser.getByteTimeDomainData(dataArray);
        drawOnContext(ctxTop);
        drawOnContext(ctxBottom);
        animationFrameId = window.requestAnimationFrame(animateWaveGlow);
    }

    audioElements.forEach(audio => {
        audio.muted = isMuted;
        const previewDuration = Number(audio.dataset.previewDuration || 0);

        audio.addEventListener('timeupdate', () => {
            if (!previewDuration || audio.currentTime < previewDuration) return;
            audio.pause();
            audio.currentTime = 0;
        });

        audio.addEventListener('seeking', () => {
            if (!previewDuration || audio.currentTime <= previewDuration) return;
            audio.currentTime = previewDuration;
        });

        audio.addEventListener('play', () => {
            if (previewDuration && audio.currentTime >= previewDuration) {
                audio.currentTime = 0;
            }

            audioElements.forEach(otherAudio => {
                if (otherAudio === audio) return;
                otherAudio.pause();
                otherAudio.closest('.latest-card')?.classList.remove('is-playing');
            });

            activeAudio = audio;
            audio.closest('.latest-card')?.classList.add('is-playing');
            setupVisualizer(audio);

            if (!animationFrameId && (ctxTop || ctxBottom)) animateWaveGlow();
        });

        const stopVisualizer = () => {
            if (activeAudio !== audio) return;
            activeAudio = undefined;
            audio.closest('.latest-card')?.classList.remove('is-playing');
            if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
            animationFrameId = undefined;
            drawBaseLine();
        };

        audio.addEventListener('pause', stopVisualizer);
        audio.addEventListener('ended', stopVisualizer);
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && activeAudio) activeAudio.pause();
    });

    // Page entrance stagger animations. No automatic audio playback: sound starts only after user interaction.
    (() => {
        document.querySelector('.navbar')?.classList.add('show');

        const latest = [...document.querySelectorAll('.latest-card')];
        latest.forEach((el, i) => setTimeout(() => el.classList.add('animate'), i * 120));

        const services = [...document.querySelectorAll('.service-card')];
        services.forEach((el, i) => setTimeout(() => el.classList.add('animate'), 300 + i * 120));

        const featured = [...document.querySelectorAll('.featured-card')];
        featured.forEach((el, i) => setTimeout(() => el.classList.add('animate'), 600 + i * 120));
    })();

    // === SCROLL PARALLAX + MICRO-INTERACTIONS ===
    (() => {
        if (reduceMotion) return;

        const parallaxItems = [...document.querySelectorAll('.parallax')];
        let ticking = false;
        const parallaxOffsets = new WeakMap();

        const updateParallax = () => {
            parallaxItems.forEach(el => {
                const speed = Number(el.dataset.speed || 0.08);
                const rect = el.getBoundingClientRect();
                const center = rect.top - (parallaxOffsets.get(el) || 0) + rect.height / 2 - window.innerHeight / 2;
                const offset = center * speed;
                parallaxOffsets.set(el, offset);
                el.style.transform = `translate3d(0, ${offset}px, 0)`;
            });
            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(updateParallax);
                ticking = true;
            }
        }, { passive: true });
        updateParallax();

        const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        if (!canHover) return;

        document.querySelectorAll('.magnetic').forEach(button => {
            button.addEventListener('pointermove', event => {
                const r = button.getBoundingClientRect();
                const x = event.clientX - (r.left + r.width / 2);
                const y = event.clientY - (r.top + r.height / 2);
                button.style.transform = `translate(${x * 0.08}px, ${y * 0.08}px)`;
            });
            button.addEventListener('pointerleave', () => {
                button.style.transform = '';
            });
        });
    })();

    // === PROJECT VIDEO GALLERY ===
    (() => {
        const projectCards = document.querySelectorAll('.project-card');
        if (!projectCards.length) return;

        const modal = document.querySelector('.video-modal');
        const modalVideo = modal?.querySelector('video');
        const closeButton = modal?.querySelector('.video-modal-close');
        let lastFocusedElement = null;

        const stopAllProjectVideos = except => {
            document.querySelectorAll('.project-card video').forEach(video => {
                if (video !== except) {
                    video.pause();
                    if (video.readyState) video.currentTime = 0;
                }
            });
        };

        const openVideo = (src, poster, trigger) => {
            if (!modal || !modalVideo || !src) return;
            stopAllProjectVideos();
            lastFocusedElement = trigger || document.activeElement;
            modalVideo.src = src;
            if (poster) modalVideo.poster = poster;
            if (!modal.open) modal.showModal();
            modal.classList.add('is-open');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('menu-scroll-locked');
            closeButton?.focus();
            modalVideo.play().catch(() => {});
        };

        const closeVideo = () => {
            if (!modal || !modalVideo) return;
            modal.classList.remove('is-open');
            if (modal.open) modal.close();
            modal.setAttribute('aria-hidden', 'true');
            modalVideo.pause();
            modalVideo.removeAttribute('src');
            modalVideo.load();
            document.body.classList.remove('menu-scroll-locked');
            lastFocusedElement?.focus?.();
            lastFocusedElement = null;
        };

        projectCards.forEach(card => {
            const video = card.querySelector('video');
            const playButton = card.querySelector('.project-play');
            if (!video) return;

            card.addEventListener('pointerenter', () => {
                if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion) {
                    stopAllProjectVideos(video);
                    if (!video.getAttribute('src')) {
                        video.src = card.dataset.preview;
                        video.load();
                    }
                    video.play().catch(() => {});
                }
            });

            card.addEventListener('pointerleave', () => {
                if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                    video.pause();
                    if (video.readyState) video.currentTime = 0;
                }
            });

            playButton?.addEventListener('click', event => {
                event.stopPropagation();
                stopAllProjectVideos(video);
                openVideo(card.dataset.video, video.poster, playButton);
            });

            card.querySelector('.project-media')?.addEventListener('click', event => {
                if (event.target.closest('.project-play')) return;
                openVideo(card.dataset.video, video.poster, card);
            });
        });

        modal?.addEventListener('cancel', event => {
            event.preventDefault();
            closeVideo();
        });
        closeButton?.addEventListener('click', closeVideo);
        modal?.addEventListener('click', event => {
            if (event.target === modal) closeVideo();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && modal?.classList.contains('is-open')) closeVideo();
        });
    })();
})();
