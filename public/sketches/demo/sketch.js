// A sample sketch: replace this with your own work.
let reducedMotion;
function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
  describe('Cyan and fuchsia circles form a flowing pattern that responds to the pointer.');
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) noLoop();
}
function draw() {
  background('#10131e');
  noFill();
  strokeWeight(1.5);
  const t = reducedMotion ? 0 : frameCount * 0.012;
  const shift = constrain(mouseX / Math.max(width, 1), 0, 1);
  for (let i = 0; i < 28; i++) {
    stroke(lerpColor(color('#26c6eb'), color('#f365bb'), i / 27));
    const x = width * 0.5 + sin(t + i * 0.19) * width * 0.2;
    const y = height * 0.5 + cos(t * 0.7 + i * 0.22) * height * 0.18;
    circle(x, y, Math.min(width, height) * (0.12 + i * 0.016 + shift * 0.04));
  }
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); }
function mouseMoved() { if (reducedMotion) redraw(); }
