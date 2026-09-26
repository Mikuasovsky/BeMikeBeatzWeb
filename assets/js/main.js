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
    const heroMorphDuration = 1450;
    const canPlayHeroVideo = () => !reduceMotion &&
        !window.matchMedia('(max-width: 900px)').matches && !navigator.connection?.saveData;
    const canAnimateHero = () => hero && heroVideos.length === 2 && !reduceMotion &&
        window.CSS?.supports('clip-path', 'circle(0% at 50% 50%)');

    function setHeroMorphGeometry() {
        const { width, height } = hero.getBoundingClientRect();
        // Both 2560 × 1440 scenes place the planet at their centre, about 610 px in radius.
        const planetRadius = 610 * Math.max(width / 2560, height / 1440);
        const fullRadius = Math.hypot(width / 2, height / 2) + 24;
        hero.style.setProperty('--hero-corona-radius', `${planetRadius * 1.16}px`);
        hero.style.setProperty('--hero-full-radius', `${fullRadius}px`);
        hero.style.setProperty('--hero-ring-diameter', `${planetRadius * 2}px`);
        hero.style.setProperty('--hero-ring-end-scale', String(fullRadius / planetRadius));
    }

    function primeHeroVideo(video) {
        if (!canPlayHeroVideo()) return Promise.resolve();
        const source = video.querySelector('source[data-src]');
        if (!source) return Promise.resolve();

        const firstFrame = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
            ? Promise.resolve()
            : new Promise(resolve => {
                let timeout;
                const done = () => {
                    window.clearTimeout(timeout);
                    video.removeEventListener('loadeddata', done);
                    video.removeEventListener('error', done);
                    resolve();
                };
                video.addEventListener('loadeddata', done);
                video.addEventListener('error', done);
                timeout = window.setTimeout(done, 900);
            });

        if (!source.getAttribute('src')) {
            source.src = source.dataset.src;
            video.load();
        }
        video.play().catch(() => {});
        return firstFrame;
    }

    function updateHeroVideo(keepPlaying) {
        if (!heroVideos.length) return;

        const isLight = document.body.classList.contains('light-theme');
        const activeClass = isLight ? 'hero-video-light' : 'hero-video-dark';

        heroVideos.forEach(video => {
            const source = video.querySelector('source[data-src]');
            const shouldPlay = (video.classList.contains(activeClass) || video === keepPlaying) && canPlayHeroVideo();

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
    let switchingTheme = false;
    if (themeToggle) {
        themeToggle.addEventListener('click', async () => {
            if (switchingTheme) return;
            switchingTheme = true;
            window.clearTimeout(themeTransitionTimer);
            const isLightTheme = !document.body.classList.contains('light-theme');
            const incoming = heroVideos.find(video => video.classList.contains(
                isLightTheme ? 'hero-video-light' : 'hero-video-dark'
            ));
            const outgoing = heroVideos.find(video => video !== incoming);
            const morph = canAnimateHero() && incoming && outgoing;

            if (morph) {
                setHeroMorphGeometry();
                hero.classList.add('is-morphing');
                incoming.classList.add('is-incoming');
                outgoing.classList.add('is-outgoing');
                // Keep the old scene on screen until the new video has a frame to reveal.
                await primeHeroVideo(incoming);
            }

            document.body.classList.add('theme-transition');
            void document.body.offsetWidth;
            window.requestAnimationFrame(() => {
                document.body.classList.toggle('light-theme', isLightTheme);
                storage.setItem('bemike-theme', isLightTheme ? 'light' : 'dark');
                updateThemeToggle();
                updateHeroVideo(morph ? outgoing : undefined);

                if (morph) {
                    hero.classList.add('is-revealing');
                    window.setTimeout(() => {
                        hero.classList.add('is-morph-complete');
                        hero.classList.remove('is-morphing', 'is-revealing');
                        incoming.classList.remove('is-incoming');
                        outgoing.classList.remove('is-outgoing');
                        updateHeroVideo();
                        window.requestAnimationFrame(() => hero.classList.remove('is-morph-complete'));
                        switchingTheme = false;
                    }, heroMorphDuration);
                } else {
                    switchingTheme = false;
                }

                themeTransitionTimer = window.setTimeout(() => {
                    document.body.classList.remove('theme-transition');
                }, reduceMotion ? 0 : morph ? heroMorphDuration + 50 : 650);
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
        if (document.hidden) {
            if (activeAudio) activeAudio.pause();
            heroVideos.forEach(video => video.pause());
        } else {
            updateHeroVideo();
        }
    });

    // Beat discovery and licensing share the same small, known catalogue.
    const beatNames = { flor: 'Flor', dougie: 'Dougie', weak: 'Weak', crip: 'Crip' };
    const licenseNames = { basic: 'Basic', premium: 'Premium', exclusive: 'Exclusive' };
    const beatCards = [...document.querySelectorAll('.latest-card[data-beat-id]')];
    const favoriteStorageKey = 'bemike-favorites';

    function readFavorites() {
        try {
            const saved = JSON.parse(storage.getItem(favoriteStorageKey) || '[]');
            return new Set(Array.isArray(saved) ? saved.filter(id => Object.hasOwn(beatNames, id)) : []);
        } catch {
            return new Set();
        }
    }

    let favorites = readFavorites();
    let battleResultBeatId = null;
    const savedFilter = document.querySelector('.beat-saved-filter');
    const savedCount = savedFilter?.querySelector('.saved-count');
    const emptyState = document.querySelector('.beat-empty-state');
    const filterStatus = document.querySelector('.beat-filter-status');
    let showSavedOnly = false;

    function renderFavorites() {
        beatCards.forEach(card => {
            const id = card.dataset.beatId;
            const saved = favorites.has(id);
            const button = card.querySelector('.beat-favorite');
            if (button) {
                button.setAttribute('aria-pressed', String(saved));
                button.setAttribute('aria-label', `${saved ? 'Remove' : 'Save'} ${beatNames[id]} ${saved ? 'from' : 'to'} favourites`);
                button.textContent = saved ? '♥ Saved' : '♡ Save';
            }
            card.hidden = showSavedOnly && !saved;
            if (card.hidden) card.querySelector('audio')?.pause();
        });

        if (savedCount) savedCount.textContent = String(favorites.size);
        if (savedFilter) {
            savedFilter.setAttribute('aria-pressed', String(showSavedOnly));
            savedFilter.firstChild.textContent = showSavedOnly ? 'Show all ' : 'Show saved ';
        }
        if (emptyState) emptyState.hidden = !showSavedOnly || beatCards.some(card => !card.hidden);
        if (filterStatus) filterStatus.textContent = showSavedOnly ? `${favorites.size} saved beat${favorites.size === 1 ? '' : 's'}` : '';
        const battleSave = document.querySelector('.battle-result-save');
        if (battleSave && battleResultBeatId) {
            const saved = favorites.has(battleResultBeatId);
            battleSave.setAttribute('aria-pressed', String(saved));
            battleSave.textContent = saved ? '♥ Saved' : '♡ Save beat';
        }
    }

    beatCards.forEach(card => {
        card.querySelector('.beat-favorite')?.addEventListener('click', () => {
            const id = card.dataset.beatId;
            if (favorites.has(id)) favorites.delete(id);
            else favorites.add(id);
            storage.setItem(favoriteStorageKey, JSON.stringify([...favorites]));
            renderFavorites();
        });
    });
    savedFilter?.addEventListener('click', () => {
        showSavedOnly = !showSavedOnly;
        renderFavorites();
    });
    window.addEventListener('storage', event => {
        if (event.key !== favoriteStorageKey) return;
        favorites = readFavorites();
        renderFavorites();
    });
    renderFavorites();

    let showComparisonPair;
    const compareDock = document.querySelector('.compare-dock');
    if (compareDock) {
        const selected = [null, null];
        const slotButtons = [...compareDock.querySelectorAll('.compare-play')];
        const compareHelp = compareDock.querySelector('.compare-help');
        const cardById = new Map(beatCards.map(card => [card.dataset.beatId, card]));

        const renderComparison = () => {
            compareDock.hidden = !selected.some(Boolean);
            const ready = selected.every(Boolean);

            beatCards.forEach(card => {
                const button = card.querySelector('.beat-compare');
                if (!button) return;
                const slot = selected.indexOf(card.dataset.beatId);
                button.setAttribute('aria-pressed', String(slot !== -1));
                button.setAttribute('aria-label', slot === -1 ? `Add ${beatNames[card.dataset.beatId]} to comparison` : `Remove ${beatNames[card.dataset.beatId]} from comparison`);
                button.textContent = slot === -1 ? 'Compare' : `Selected ${slot === 0 ? 'A' : 'B'}`;
            });

            slotButtons.forEach((button, index) => {
                const id = selected[index];
                const audio = id && cardById.get(id)?.querySelector('audio');
                const playing = Boolean(audio && !audio.paused);
                button.disabled = !ready;
                button.querySelector('.compare-slot-title').textContent = id ? beatNames[id] : 'Choose a beat';
                button.querySelector('.compare-play-icon').textContent = playing ? 'Ⅱ' : '▶';
                button.setAttribute('aria-label', id ? `${playing ? 'Pause' : 'Play'} ${beatNames[id]} as ${index === 0 ? 'A' : 'B'}` : `Choose beat ${index === 0 ? 'A' : 'B'}`);
                button.classList.toggle('is-playing', playing);
            });

            if (compareHelp) compareHelp.textContent = ready
                ? 'Switch at the same point during the first 15 seconds. Keys 1 and 2 work too.'
                : 'Choose one more beat to compare.';
        };

        beatCards.forEach(card => {
            const id = card.dataset.beatId;
            card.querySelector('.beat-compare')?.addEventListener('click', () => {
                const currentSlot = selected.indexOf(id);
                if (currentSlot !== -1) {
                    card.querySelector('audio')?.pause();
                    selected.splice(currentSlot, 1);
                    selected.push(null);
                } else if (selected[0] === null) selected[0] = id;
                else if (selected[1] === null) selected[1] = id;
                else {
                    cardById.get(selected[1])?.querySelector('audio')?.pause();
                    selected[1] = id;
                }
                renderComparison();
            });
            ['play', 'pause', 'ended'].forEach(type => card.querySelector('audio')?.addEventListener(type, renderComparison));
        });

        slotButtons.forEach((button, index) => button.addEventListener('click', () => {
            const id = selected[index];
            const audio = id && cardById.get(id)?.querySelector('audio');
            if (!audio) return;
            if (!audio.paused) {
                audio.pause();
            } else {
                const otherAudio = cardById.get(selected[1 - index])?.querySelector('audio');
                const position = otherAudio && !otherAudio.paused && otherAudio.currentTime < 15
                    ? otherAudio.currentTime : 0;
                audioElements.forEach(other => { if (other !== audio) other.pause(); });
                const seek = () => {
                    try { audio.currentTime = Math.min(position, Number.isFinite(audio.duration) ? Math.max(0, audio.duration - 0.1) : position); }
                    catch { /* The player can still start at the beginning. */ }
                };
                if (audio.readyState) seek();
                else audio.addEventListener('loadedmetadata', seek, { once: true });
                audio.play().catch(() => {});
            }
            renderComparison();
        }));
        showComparisonPair = (first, second) => {
            audioElements.forEach(audio => audio.pause());
            selected[0] = first;
            selected[1] = second;
            renderComparison();
            slotButtons[0].focus();
        };
        document.addEventListener('keydown', event => {
            if (event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
                !selected.every(Boolean) ||
                (event.target instanceof Element &&
                    event.target.closest('input, textarea, select, button, a, [contenteditable="true"]'))) return;
            if (event.key === '1' || event.key === '2') slotButtons[Number(event.key) - 1].click();
        });
        compareDock.querySelector('.compare-clear')?.addEventListener('click', () => {
            selected.forEach(id => cardById.get(id)?.querySelector('audio')?.pause());
            selected[0] = null;
            selected[1] = null;
            renderComparison();
        });
        renderComparison();
    }

    // A three-choice tournament uses the existing local beat players, so no extra media is fetched.
    const battle = document.querySelector('.beat-battle');
    if (battle && ['flor', 'dougie', 'weak', 'crip'].every(id => beatCards.some(card => card.dataset.beatId === id))) {
        const cardById = new Map(beatCards.map(card => [card.dataset.beatId, card]));
        const startButton = battle.querySelector('.battle-start');
        const stage = battle.querySelector('.battle-stage');
        const result = battle.querySelector('.battle-result');
        const options = [...battle.querySelectorAll('.battle-option')];
        const roundLabel = battle.querySelector('.battle-round-label');
        const help = battle.querySelector('.battle-help');
        const progressDots = [...battle.querySelectorAll('.battle-progress i')];
        const resultName = battle.querySelector('.battle-result-name');
        const resultListen = battle.querySelector('.battle-result-listen');
        const resultCompare = battle.querySelector('.battle-result-compare');
        const resultLicense = battle.querySelector('.battle-result-license');
        const shareStatus = battle.querySelector('.battle-share-status');
        const openingPairs = [['flor', 'dougie'], ['weak', 'crip']];
        let round = 0;
        let finalists = [];
        let currentPair = openingPairs[0];
        let battleAudio = null;

        const getAudio = id => cardById.get(id)?.querySelector('audio');
        const getBeatMeta = id => cardById.get(id)?.querySelector('.latest-info p')?.textContent || '';
        const stopBattleAudio = () => {
            if (!battleAudio) return;
            battleAudio.pause();
            battleAudio = null;
        };

        const renderPlayback = () => {
            options.forEach(option => {
                const id = option.dataset.beatId;
                const playing = Boolean(id && battleAudio === getAudio(id) && !battleAudio.paused);
                const button = option.querySelector('.battle-listen');
                button.textContent = playing ? 'Ⅱ Pause preview' : '▶ Listen for 15s';
                button.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${beatNames[id] || 'beat'} preview`);
            });
            const resultPlaying = battleResultBeatId && !getAudio(battleResultBeatId)?.paused;
            resultListen.textContent = resultPlaying ? 'Ⅱ Pause beat' : '▶ Listen again';
        };

        const renderRound = () => {
            currentPair = round < 2 ? openingPairs[round] : finalists;
            stage.hidden = false;
            result.hidden = true;
            startButton.hidden = true;
            roundLabel.textContent = `Round ${round + 1} of 3${round === 2 ? ' · Final' : ''}`;
            progressDots.forEach((dot, index) => {
                dot.classList.toggle('is-current', index === round);
                dot.classList.toggle('is-complete', index < round);
            });
            options.forEach((option, index) => {
                const id = currentPair[index];
                const card = cardById.get(id);
                option.dataset.beatId = id;
                option.querySelector('img').src = card.querySelector('img').src;
                option.querySelector('img').alt = `${beatNames[id]} cover art`;
                option.querySelector('.battle-option-name').textContent = beatNames[id];
                option.querySelector('.battle-option-meta').textContent = `${getBeatMeta(id)}${id === 'crip' ? ' · Preview only' : ''}`;
                option.querySelector('.battle-pick').setAttribute('aria-label', `Choose ${beatNames[id]}${round === 2 ? ' as your match' : ' and continue'}`);
                option.querySelector('.battle-preview-progress').value = 0;
            });
            help.textContent = 'Listen, then pick one to continue.';
            renderPlayback();
            roundLabel.focus();
        };

        const renderResult = (winner, runnerUp = null, shared = false) => {
            stopBattleAudio();
            battleResultBeatId = winner;
            stage.hidden = true;
            result.hidden = false;
            startButton.hidden = true;
            result.querySelector('.battle-result-art').src = cardById.get(winner).querySelector('img').src;
            result.querySelector('.battle-result-art').alt = `${beatNames[winner]} cover art`;
            resultName.textContent = beatNames[winner];
            result.querySelector('.battle-result-meta').textContent = `${getBeatMeta(winner)}${runnerUp ? ` · Chosen over ${beatNames[runnerUp]}` : ''}`;
            result.querySelector('.battle-result-kicker').textContent = shared ? 'A shared beat match.' : 'This one made it through.';
            resultLicense.href = winner === 'crip' ? 'contact.html?beat=crip' : `licensing.html?beat=${winner}`;
            resultLicense.textContent = winner === 'crip' ? 'Ask availability ↗' : 'Explore licensing ↗';
            resultCompare.hidden = !runnerUp;
            resultCompare.dataset.runnerUp = runnerUp || '';
            shareStatus.textContent = '';
            renderFavorites();
            renderPlayback();
            resultName.focus();
        };

        const start = () => {
            stopBattleAudio();
            battleResultBeatId = null;
            finalists = [];
            round = 0;
            renderRound();
        };

        startButton.addEventListener('click', start);
        battle.querySelector('.battle-stage-restart').addEventListener('click', start);
        battle.querySelector('.battle-restart').addEventListener('click', start);
        options.forEach(option => {
            option.querySelector('.battle-listen').addEventListener('click', () => {
                const id = option.dataset.beatId;
                const audio = getAudio(id);
                if (!audio) return;
                if (battleAudio === audio && !audio.paused) {
                    audio.pause();
                    return;
                }
                stopBattleAudio();
                battleAudio = audio;
                if (audio.readyState) audio.currentTime = 0;
                audio.play().catch(() => {
                    battleAudio = null;
                    help.textContent = 'Could not play this preview. Try the player in Featured beats below.';
                    renderPlayback();
                });
                help.textContent = isMuted
                    ? 'Local previews are muted. Use the sound button to hear them.'
                    : `Listening to ${beatNames[id]} · first 15 seconds.`;
                renderPlayback();
            });
            option.querySelector('.battle-pick').addEventListener('click', () => {
                const id = option.dataset.beatId;
                stopBattleAudio();
                if (round < 2) {
                    finalists.push(id);
                    round += 1;
                    renderRound();
                } else {
                    renderResult(id, currentPair.find(other => other !== id));
                }
            });
        });

        beatCards.forEach(card => {
            const audio = card.querySelector('audio');
            ['play', 'pause', 'ended'].forEach(type => audio?.addEventListener(type, () => {
                if (type !== 'play' && audio === battleAudio) battleAudio = null;
                renderPlayback();
            }));
            audio?.addEventListener('timeupdate', () => {
                if (audio !== battleAudio) return;
                const option = options.find(item => item.dataset.beatId === card.dataset.beatId);
                if (option) option.querySelector('.battle-preview-progress').value = Math.min(15, audio.currentTime);
                if (audio.currentTime < 15) return;
                audio.pause();
                battleAudio = null;
                help.textContent = 'Preview complete. Pick your favourite or listen again.';
                renderPlayback();
            });
        });

        resultListen.addEventListener('click', () => {
            const audio = getAudio(battleResultBeatId);
            if (!audio) return;
            if (audio.paused) {
                if (audio.readyState) audio.currentTime = 0;
                audio.play().catch(() => { shareStatus.textContent = 'Could not play this beat. Use the player below.'; });
            } else audio.pause();
        });
        battle.querySelector('.battle-result-save').addEventListener('click', () => {
            cardById.get(battleResultBeatId)?.querySelector('.beat-favorite')?.click();
        });
        resultCompare.addEventListener('click', () => {
            if (battleResultBeatId && resultCompare.dataset.runnerUp) {
                showComparisonPair?.(battleResultBeatId, resultCompare.dataset.runnerUp);
            }
        });
        battle.querySelector('.battle-share').addEventListener('click', async () => {
            const url = new URL('beats.html', window.location.href);
            url.searchParams.set('match', battleResultBeatId);
            url.hash = 'beat-battle';
            try {
                if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
                await navigator.clipboard.writeText(url.href);
                shareStatus.textContent = 'Result link copied.';
            } catch {
                shareStatus.textContent = `Copy this link: ${url.href}`;
            }
        });

        const sharedMatch = new URLSearchParams(window.location.search).get('match');
        if (Object.hasOwn(beatNames, sharedMatch)) renderResult(sharedMatch, null, true);
    }

    const pageParams = new URLSearchParams(window.location.search);
    const selectedBeatId = pageParams.get('beat');
    const selectedBeatName = Object.hasOwn(beatNames, selectedBeatId) ? beatNames[selectedBeatId] : null;
    const selectedLicenseId = pageParams.get('license');
    const selectedLicenseName = Object.hasOwn(licenseNames, selectedLicenseId) ? licenseNames[selectedLicenseId] : null;
    const licensingContext = document.querySelector('.selected-beat-context');

    if (licensingContext && selectedBeatName) {
        licensingContext.hidden = false;
        licensingContext.querySelector('.selected-beat-name').textContent = selectedBeatName;
        document.querySelectorAll('.license-link[data-license]').forEach(link => {
            const params = new URLSearchParams({ beat: selectedBeatId, license: link.dataset.license });
            link.href = `contact.html?${params}`;
        });
    }

    const contactContext = document.querySelector('.contact-selection');
    if (contactContext && (selectedBeatName || selectedLicenseName)) {
        contactContext.hidden = false;
        const summary = [selectedBeatName, selectedLicenseName && `${selectedLicenseName} license`].filter(Boolean).join(' · ');
        contactContext.querySelector('.contact-selection-summary').textContent = summary;

        const subject = selectedBeatName
            ? `${selectedBeatId === 'crip' ? 'Availability' : 'Licensing'} enquiry — ${selectedBeatName}${selectedLicenseName ? ` (${selectedLicenseName})` : ''}`
            : `${selectedLicenseName} licensing enquiry`;
        const body = `Hi BeMikeBeatz,\n\nI am interested in ${summary}.\n\nMy project: \nMy release plans: \n\nThanks!`;
        document.querySelector('.contact-email').href = `mailto:bemike.off@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        const gmail = new URL('https://mail.google.com/mail/');
        gmail.search = new URLSearchParams({ view: 'cm', fs: '1', to: 'bemike.off@gmail.com', su: subject, body });
        document.querySelector('.contact-gmail').href = gmail.href;
    }

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
