'use strict';
// Both pages read the same project data. Edit projects.json to update the collection.
(async function () {
  const list = document.querySelector('[data-project-list]');
  if (!list) return;
  const isWorkPage = list.dataset.projectList === 'all';
  const categories = {
    'ai-automations': 'AI & automations',
    'workflow-tooling': 'Workflow tooling',
    '3d': '3D',
    'vfx': 'VFX'
  };
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function makeTags(values, className, label) {
    const ul = element('ul', className);
    ul.setAttribute('aria-label', label);
    for (const value of values) ul.append(element('li', '', value));
    return ul;
  }
  // Optional mixed media collection. Existing image/imageAlt fields still work.
  const pauseProjectMedia = new Map();
  function mediaFigure(project, projectIndex) {
    const legacy = project.image ? [{ type: 'image', src: project.image, alt: project.imageAlt || project.title, caption: project.imageCaption || '' }] : [];
    const items = (Array.isArray(project.media) && project.media.length ? project.media : legacy)
      .filter(item => ['image', 'video', 'youtube', 'p5'].includes(item.type));
    const figure = element('figure', 'media-carousel');
    figure.setAttribute('role', 'region');
    figure.setAttribute('aria-roledescription', 'carousel');
    figure.setAttribute('aria-label', `${project.title} media`);
    figure.tabIndex = 0;
    if (!items.length) return figure;
    let current = 0;
    let visibleIndex = 0;
    let changeRequest = 0;
    let hasShown = false;
    const stage = element('div', 'carousel-stage');
    const mediaRatios = new Map();
    function explicitRatio(item) {
      const width = Number(item.width), height = Number(item.height);
      if (width > 0 && height > 0) return width / height;
      if (typeof item.aspectRatio === 'number' && item.aspectRatio > 0) return item.aspectRatio;
      if (typeof item.aspectRatio === 'string') {
        const parts = item.aspectRatio.split(/[/:]/).map(Number);
        if (parts.length === 2 && parts.every(n => Number.isFinite(n) && n > 0)) return parts[0] / parts[1];
      }
      return null;
    }
    function mediaHeight(item) {
      const setting = item.maxHeight ?? project.maxHeight;
      const value = typeof setting === 'number' && setting > 0 ? `${setting}px` : setting;
      return typeof value === 'string' && CSS.supports('max-height', value) ? value : 'var(--default-media-max-height)';
    }
    // A collection keeps one frame throughout; media fits inside it with bars.
    const fixedRatio = explicitRatio({aspectRatio:project.frameAspectRatio}) ||
      (items.length > 1 ? 4 / 3 : explicitRatio(items[0]) || 16 / 9);
    function updateStageRatio(index, width, height) {
      if (width > 0 && height > 0) mediaRatios.set(index, width / height);
      // A single image may resolve its natural dimensions after loading.
      if (items.length === 1 && !project.frameAspectRatio && width > 0 && height > 0)
        stage.style.aspectRatio = String(width / height);
    }
    stage.style.aspectRatio = String(fixedRatio);
    // Honour every cap without changing height when a different slide is chosen.
    const caps = [...new Set(items.map(mediaHeight))].filter(value => value !== 'none');
    const frameCap = caps.length > 1 ? `min(${caps.join(', ')})` : caps[0] || 'none';
    stage.style.setProperty('--media-max-height', frameCap);
    const caption = element('figcaption', 'carousel-caption');
    const slideStops = [];
    const slides = items.map((item, index) => {
      const slide = element('div', 'carousel-slide');
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', `${index + 1} of ${items.length}`);
      slide.hidden = index !== 0;
      const label = item.alt || item.title || `${project.title}, media ${index + 1}`;
      let stop = () => {};
      if (item.type === 'image') {
        const image = element('img', 'carousel-image');
        image.src = item.src;
        image.alt = label;
        image.loading = projectIndex === 0 && index === 0 ? 'eager' : 'lazy';
        image.decoding = 'async';
        if (item.width && item.height) { image.width = item.width; image.height = item.height; }
        // Prefer actual image dimensions so portrait and square work stay that shape.
        image.addEventListener('load', () => updateStageRatio(index, image.naturalWidth, image.naturalHeight));
        if (image.complete && image.naturalWidth) updateStageRatio(index, image.naturalWidth, image.naturalHeight);
        slide.append(image);
        image.addEventListener('error', () => {
          image.hidden = true;
          slide.append(element('p', 'media-fallback', 'This image could not load.'));
        }, { once: true });
      } else if (item.type === 'video') {
        const video = element('video', 'carousel-video');
        video.controls = true;
        video.playsInline = true;
        video.preload = 'none';
        video.addEventListener('loadedmetadata', () => updateStageRatio(index, video.videoWidth, video.videoHeight));
        video.src = item.src;
        video.setAttribute('aria-label', label);
        if (item.poster) video.poster = item.poster;
        if (item.captions) {
          const track = element('track');
          track.kind = 'captions';
          track.src = item.captions;
          track.srclang = item.language || 'en';
          track.label = item.captionLabel || 'English';
          video.append(track);
        }
        const fallback = element('a', 'media-download', 'Open video directly ↗');
        fallback.href = item.src;
        slide.append(video, fallback);
        video.addEventListener('error', () => {
          if (!slide.querySelector('.media-fallback')) slide.append(element('p', 'media-fallback', 'This video could not load. Try the direct link.'));
        });
        stop = () => video.pause();
      } else if (item.type === 'p5') {
        const host = element('div', 'sketch-host');
        let sketchURL = null;
        try {
          const url = new URL(item.src, location.href);
          if (url.origin === location.origin || (url.protocol === 'https:' && url.hostname === 'editor.p5js.org')) sketchURL = url.href;
        } catch (_) {}
        function launcher() {
          const button = element('button', 'sketch-launch', `▶ Run ${item.title || 'interactive sketch'}`);
          button.type = 'button';
          button.disabled = !sketchURL;
          if (!sketchURL) button.textContent = 'Sketch URL is missing or unsupported';
          button.addEventListener('click', () => {
            const frame = element('iframe', 'carousel-sketch');
            frame.title = item.title || `${project.title} interactive sketch`;
            frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
            frame.referrerPolicy = 'no-referrer';
            frame.src = sketchURL;
            host.replaceChildren(frame);
            frame.focus();
          });
          return button;
        }
        host.append(launcher());
        slide.append(host);
        stop = () => { if (host.querySelector('iframe')) host.replaceChildren(launcher()); };
        // Unload the sketch once its gallery leaves the viewport.
        if ('IntersectionObserver' in window) {
          const observer = new IntersectionObserver(entries => {
            if (entries.every(entry => !entry.isIntersecting)) stop();
          });
          observer.observe(figure);
        }
      } else {
        // Only YouTube IDs are accepted; no arbitrary embed HTML is inserted.
        const validId = /^[A-Za-z0-9_-]{11}$/.test(item.videoId || '');
        const host = element('div', 'youtube-host');
        const watch = element('a', 'media-download', 'Watch on YouTube ↗');
        if (validId) watch.href = `https://www.youtube.com/watch?v=${item.videoId}`;
        else { watch.textContent = 'Invalid YouTube video ID'; watch.removeAttribute('href'); }
        const posterButton = () => {
          const button = element('button', 'youtube-load');
          button.type = 'button';
          button.disabled = !validId;
          if (item.poster) {
            const poster = element('img', 'youtube-poster');
            poster.src = item.poster;
            poster.alt = '';
            poster.loading = 'lazy';
            poster.addEventListener('load', () => {
              if (!explicitRatio(item)) updateStageRatio(index, poster.naturalWidth, poster.naturalHeight);
            });
            button.append(poster);
          }
          button.append(element('span', 'youtube-play', `▶ Play ${item.title || 'video'}`));
          button.addEventListener('click', () => {
            const frame = element('iframe', 'carousel-youtube');
            frame.title = item.title || project.title;
            frame.src = `https://www.youtube-nocookie.com/embed/${item.videoId}?autoplay=1&rel=0`;
            frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
            frame.allowFullscreen = true;
            frame.referrerPolicy = 'strict-origin-when-cross-origin';
            host.replaceChildren(frame);
            frame.focus();
          });
          return button;
        };
        host.append(posterButton());
        slide.append(host, watch);
        stop = () => { if (host.querySelector('iframe')) host.replaceChildren(posterButton()); };
      }
      slideStops.push(stop);
      stage.append(slide);
      return slide;
    });
    const controls = element('div', 'carousel-controls');
    const previous = element('button', 'carousel-arrow', '←');
    const next = element('button', 'carousel-arrow', '→');
    previous.type = next.type = 'button';
    previous.setAttribute('aria-label', `Previous media for ${project.title}`);
    next.setAttribute('aria-label', `Next media for ${project.title}`);
    const count = element('span', 'carousel-count');
    count.setAttribute('role', 'status');
    count.setAttribute('aria-live', 'polite');
    count.setAttribute('aria-atomic', 'true');
    const dots = element('div', 'carousel-dots');
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', 'Choose a slide');
    const dotButtons = items.map((item, index) => {
      const button = element('button', 'carousel-dot');
      button.type = 'button';
      button.setAttribute('aria-label', `Show ${item.type === 'image' ? 'image' : item.type === 'p5' ? 'sketch' : 'video'} ${index + 1}`);
      button.addEventListener('click', () => show(index));
      dots.append(button);
      return button;
    });
    function preloadNext() {
      const upcoming = slides[(current + 1) % items.length].querySelector('img.carousel-image');
      if (upcoming) upcoming.loading = 'eager';
    }
    async function show(index) {
      const request = ++changeRequest;
      current = (index + items.length) % items.length;
      const target = current;
      const incoming = slides[target];
      const image = incoming.querySelector('img.carousel-image');
      if (image) {
        image.loading = 'eager';
        // Keep the previous image visible until the new one is decoded.
        try { await image.decode(); } catch (_) { /* The image error handler supplies a fallback. */ }
      }
      if (request !== changeRequest) return;
      const outgoing = slides[visibleIndex];
      const animate = hasShown && visibleIndex !== target &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (visibleIndex !== target) slideStops[visibleIndex]();
      slides.forEach(slide => {
        slide.getAnimations().forEach(animation => animation.cancel());
        slide.hidden = true;
        slide.inert = true;
        slide.style.zIndex = '';
      });
      incoming.hidden = false;
      incoming.inert = false;
      incoming.style.zIndex = '1';
      updateStageRatio(target);
      if (animate) {
        outgoing.hidden = false;
        outgoing.inert = true;
        const fadeOut = outgoing.animate([{opacity:1}, {opacity:0}], {duration:240, easing:'ease-out', fill:'forwards'});
        incoming.animate([{opacity:0}, {opacity:1}], {duration:280, easing:'ease-out'});
        fadeOut.finished.then(() => {
          if (visibleIndex !== slides.indexOf(outgoing)) outgoing.hidden = true;
          fadeOut.cancel();
        }).catch(() => {});
      }
      visibleIndex = target;
      hasShown = true;
      const activeVideo = incoming.querySelector('video');
      if (activeVideo) {
        activeVideo.preload = 'metadata';
        if (activeVideo.videoWidth) updateStageRatio(target, activeVideo.videoWidth, activeVideo.videoHeight);
      }
      dotButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === target)));
      count.textContent = `${target + 1} / ${items.length}`;
      caption.textContent = items[target].caption || '';
      caption.hidden = !caption.textContent;
      if (figure.dataset.nearViewport) preloadNext();
    }
    previous.addEventListener('click', () => show(current - 1));
    next.addEventListener('click', () => show(current + 1));
    // Don't intercept arrows used by native video controls or embedded players.
    figure.addEventListener('keydown', event => {
      if (event.target !== figure && !controls.contains(event.target)) return;
      if (items.length > 1 && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        if (event.key === 'Home') show(0);
        else if (event.key === 'End') show(items.length - 1);
        else show(current + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
    // Swipe images only; native video gestures and controls remain untouched.
    let touchStart = null;
    stage.addEventListener('touchstart', event => {
      touchStart = event.touches.length === 1 && items[current].type === 'image'
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    }, { passive: true });
    stage.addEventListener('touchend', event => {
      if (!touchStart || items.length < 2) return;
      const dx = event.changedTouches[0].clientX - touchStart.x;
      const dy = event.changedTouches[0].clientY - touchStart.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
      touchStart = null;
    }, { passive: true });
    pauseProjectMedia.set(project.id, () => slideStops.forEach(stop => stop()));
    controls.append(previous, count, dots, next);
    controls.hidden = items.length < 2;
    figure.append(stage, controls, caption);
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          figure.dataset.nearViewport = 'true';
          preloadNext();
          observer.disconnect();
        }
      }, {rootMargin:'300px'});
      observer.observe(figure);
    } else figure.dataset.nearViewport = 'true';
    show(0);
    return figure;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseProjectMedia.forEach(stop => stop());
  });

  function projectCard(project, index) {
    const article = element('article', 'project');
    article.id = project.id;
    article.dataset.tags = project.categories.join(' ');
    article.dataset.selected = String(project.selected);
    article.append(element('h2', '', project.title));
    article.append(mediaFigure(project, index), element('p', 'project-lead', project.description));
    if (project.body) article.append(element('p', 'project-description', project.body));
    if (project.metrics) article.append(element('p', 'metrics', project.metrics));
    article.append(makeTags(project.categories.map(key => categories[key] || key), 'category-tags', 'Project categories'));
    if (project.technologies?.length) article.append(makeTags(project.technologies, 'tags', 'Technologies'));
    if (project.details?.length) {
      const details = element('details', 'case-study');
      const summary = element('summary', '', 'Behind the project ');
      const icon = element('span', '', '+');
      icon.setAttribute('aria-hidden', 'true');
      summary.append(icon);
      const body = element('div', 'case-body');
      for (const section of project.details) body.append(element('h3', '', section.heading), element('p', '', section.text));
      details.append(summary, body);
      article.append(details);
    }
    if (project.links?.length) {
      const links = element('div', 'project-links');
      for (const link of project.links) {
        const a = element('a', '', `${link.label} ↗`);
        a.href = link.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        links.append(a);
      }
      article.append(links);
    }
    // Prepare the entrance before insertion so the first card cannot flash into view.
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!motion.matches) {
      article.classList.add('project-entry-pending');
      const firstImage = article.querySelector('.carousel-image');
      let started = false;
      let timeout;
      function beginEntrance() {
        if (started) return;
        started = true;
        clearTimeout(timeout);
        window.requestAnimationFrame(() => {
          article.classList.remove('project-entry-pending');
          if (motion.matches) return;
          article.style.setProperty('--entry-delay', `calc(var(--page-entry-delay, 250ms) + ${Math.min(index * 90, 540)}ms)`);
          article.classList.add('soft-entry');
          function cleanup(event) {
            if (event.target !== article || event.animationName !== 'soft-page-enter') return;
            article.classList.remove('soft-entry');
            article.style.removeProperty('--entry-delay');
            article.removeEventListener('animationend', cleanup);
          }
          article.addEventListener('animationend', cleanup);
        });
      }
      // Give the lead image a chance to decode; never hold up a card indefinitely.
      timeout = window.setTimeout(beginEntrance, 1800);
      if (firstImage) firstImage.decode().catch(() => {}).then(beginEntrance);
      else beginEntrance();
    }
    return article;
  }
  try {
    const response = await fetch('projects.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Project data returned ${response.status}`);
    const projects = await response.json();
    if (!Array.isArray(projects) || projects.some(p => !p.id || !p.title || !Array.isArray(p.categories))) {
      throw new Error('Invalid project collection');
    }
    const selected = isWorkPage ? projects : projects.filter(p => p.selected === true);
    list.replaceChildren(...selected.map(projectCard));
    if (!selected.length) list.append(element('p', 'load-status', 'No projects to show yet.'));
    if (!isWorkPage) return;

    const nav = document.querySelector('#project-navigation');
    const jump = document.querySelector('#project-jump');
    const status = document.querySelector('#filter-status');
    const filterButtons = [...document.querySelectorAll('[data-filter]')];
    let activeFilter = 'all';
    let observer;
    function setFilter(filter) {
      activeFilter = filter === 'all' || categories[filter] ? filter : 'all';
      const visible = selected.filter(p => activeFilter === 'all' || p.categories.includes(activeFilter));
      const collectionHeading = document.querySelector('.nav-caption');
      if (collectionHeading) collectionHeading.textContent = activeFilter === 'all' ? 'All work' : categories[activeFilter];
      selected.forEach(p => {
        const hidden = !visible.includes(p);
        document.getElementById(p.id).hidden = hidden;
        if (hidden) pauseProjectMedia.get(p.id)?.();
      });
      filterButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === activeFilter)));
      status.textContent = `${visible.length} ${visible.length === 1 ? 'project' : 'projects'}${activeFilter === 'all' ? ' in the collection' : ` in ${categories[activeFilter]}`}`;
      nav.replaceChildren();
      jump.replaceChildren(element('option', '', 'Choose a project…'));
      jump.firstElementChild.value = '';
      visible.forEach((p, index) => {
        const link = element('a', 'nav-link');
        link.href = `#${p.id}`;
        link.append(element('span', '', String(index + 1).padStart(2, '0')), document.createTextNode(p.title));
        nav.append(link);
        const option = element('option', '', p.title);
        option.value = p.id;
        jump.append(option);
      });
      if (observer) observer.disconnect();
      function highlight(id) {
        nav.querySelectorAll('a').forEach(link => {
          const active = link.hash === `#${id}`;
          link.classList.toggle('active', active);
          if (active) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      }
      if (visible[0]) highlight(visible[0].id);
      if ('IntersectionObserver' in window) {
        observer = new IntersectionObserver(entries => {
          for (const entry of entries) if (entry.isIntersecting) highlight(entry.target.id);
        }, { rootMargin: '-5% 0px -65% 0px' });
        visible.forEach(p => observer.observe(document.getElementById(p.id)));
      }
    }
    function filterFromURL() {
      const params = new URLSearchParams(location.search);
      setFilter(params.get('filter') || 'all');
    }
    filterButtons.forEach(button => button.addEventListener('click', () => {
      const url = new URL(location.href);
      if (button.dataset.filter === 'all') url.searchParams.delete('filter');
      else url.searchParams.set('filter', button.dataset.filter);
      url.hash = '';
      history.pushState({}, '', url);
      setFilter(button.dataset.filter);
    }));
    jump.addEventListener('change', () => {
      if (jump.value) location.hash = jump.value;
    });
    window.addEventListener('popstate', filterFromURL);
    filterFromURL();
    // Handle direct project links after the asynchronous data load.
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target && !target.hidden) target.scrollIntoView();
    }
  } catch (error) {
    console.error('Unable to load projects:', error);
    list.replaceChildren(element('p', 'load-status', location.protocol === 'file:'
      ? 'To preview the projects, open this site through a local web server (see README), or visit the deployed website.'
      : 'The project collection could not load. Please refresh the page or try again shortly.'));
  }
})();
