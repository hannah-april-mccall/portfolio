'use strict';
// The page and all project write-ups also work without JavaScript.
const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

const navigation = [...document.querySelectorAll('.nav-link')];
const sections = navigation.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
function updateNavigation() {
  if (!sections.length) return;
  const marker = window.innerHeight * 0.3;
  let current = sections[0];
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= marker) current = section;
  }
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 20) {
    current = sections[sections.length - 1];
  }
  for (const link of navigation) {
    const active = link.getAttribute('href') === `#${current.id}`;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}
let scrollPending = false;
window.addEventListener('scroll', () => {
  if (scrollPending) return;
  scrollPending = true;
  window.requestAnimationFrame(() => { updateNavigation(); scrollPending = false; });
}, { passive: true });
window.addEventListener('resize', updateNavigation);
updateNavigation();

// A quiet cyan-to-fuchsia light, enabled only for mouse/trackpad users.
(() => {
  const enabled = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const glow = document.createElement('div');
  glow.className = 'cursor-glow';
  glow.setAttribute('aria-hidden', 'true');
  document.body.append(glow);
  let frame = 0;
  let x = 0, y = 0;
  const hide = () => { glow.classList.remove('is-visible'); };
  function paint() {
    frame = 0;
    if (!enabled.matches || document.hidden) return;
    const t = Math.max(0, Math.min(1, x / Math.max(1, window.innerWidth)));
    // Interpolate the site's cyan and fuchsia colours across the viewport.
    const rgb = [38 + (243 - 38) * t, 198 + (101 - 198) * t, 235 + (187 - 235) * t].map(Math.round);
    glow.style.setProperty('--glow-colour', rgb.join(', '));
    glow.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    glow.classList.add('is-visible');
  }
  window.addEventListener('pointermove', event => {
    if (!enabled.matches || event.pointerType !== 'mouse') { hide(); return; }
    x = event.clientX; y = event.clientY;
    if (!frame) frame = window.requestAnimationFrame(paint);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', hide);
  window.addEventListener('blur', hide);
  document.addEventListener('visibilitychange', hide);
  enabled.addEventListener('change', hide);
})();

// Static entrances are defined in CSS so they apply before the first paint.
// Project entrances are prepared by projects.js before cards enter the document.
