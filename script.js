/* =========================================================
   TECHFEST 2026 — script.js
   Three.js scene + GSAP scroll choreography + UI interactions
========================================================= */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

gsap.registerPlugin(ScrollTrigger);

/* ---------------------------------------------------------
   0. ENVIRONMENT / CAPABILITY DETECTION
--------------------------------------------------------- */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
const isSmallScreen = window.innerWidth < 760;
const isLowPower = isSmallScreen || isCoarsePointer;

const state = {
  mouseX: 0, mouseY: 0,        // normalized -1..1
  targetMouseX: 0, targetMouseY: 0,
  scrollY: 0,
  docHeight: 1,
  ready: false
};

/* ---------------------------------------------------------
   1. LOADER
--------------------------------------------------------- */
const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loaderFill');
const loaderPct = document.getElementById('loaderPct');

function runLoader(onDone){
  const obj = { p: 0 };
  gsap.to(obj, {
    p: 100,
    duration: prefersReducedMotion ? 0.4 : 2.1,
    ease: 'power2.inOut',
    onUpdate: () => {
      const v = Math.round(obj.p);
      loaderFill.style.width = v + '%';
      loaderPct.textContent = String(v).padStart(2, '0') + '%';
    },
    onComplete: () => {
      loaderEl.classList.add('is-hidden');
      document.body.style.overflow = '';
      onDone && onDone();
    }
  });
}
document.body.style.overflow = 'hidden';

/* ---------------------------------------------------------
   2. THREE.JS SCENE SETUP
--------------------------------------------------------- */
const canvas = document.getElementById('webgl-bg');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !isLowPower,
  alpha: false,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isLowPower ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060a, 0.018);

const camera = new THREE.PerspectiveCamera(
  55, window.innerWidth / window.innerHeight, 0.1, 200
);
camera.position.set(0, 0, 14);

/* Lighting */
const ambient = new THREE.AmbientLight(0x404060, 1.1);
scene.add(ambient);

const keyLight = new THREE.PointLight(0x00e5ff, 14, 40, 2);
keyLight.position.set(6, 4, 8);
scene.add(keyLight);

const rimLight = new THREE.PointLight(0x9b5cff, 12, 40, 2);
rimLight.position.set(-7, -3, -4);
scene.add(rimLight);

const coreLight = new THREE.PointLight(0x3b6dff, 18, 18, 2);
coreLight.position.set(0, 0, 2);
scene.add(coreLight);

/* ---------------------------------------------------------
   3. HOLOGRAPHIC CORE (hero signature object)
--------------------------------------------------------- */
const core = new THREE.Group();

const outerGeo = new THREE.IcosahedronGeometry(2.1, 1);
const outerWire = new THREE.LineSegments(
  new THREE.EdgesGeometry(outerGeo),
  new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.55 })
);
core.add(outerWire);

const innerGeo = new THREE.IcosahedronGeometry(1.15, 0);
const innerMesh = new THREE.Mesh(
  innerGeo,
  new THREE.MeshStandardMaterial({
    color: 0x9b5cff, transparent: true, opacity: 0.22,
    emissive: 0x6f2bff, emissiveIntensity: 0.7,
    roughness: 0.2, metalness: 0.3
  })
);
core.add(innerMesh);

const ringGeoA = new THREE.TorusGeometry(2.7, 0.012, 8, 96);
const ringMatA = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.5 });
const ringA = new THREE.Mesh(ringGeoA, ringMatA);
ringA.rotation.x = Math.PI / 2.4;
core.add(ringA);

const ringB = new THREE.Mesh(
  new THREE.TorusGeometry(3.15, 0.01, 8, 96),
  new THREE.MeshBasicMaterial({ color: 0x3b6dff, transparent: true, opacity: 0.4 })
);
ringB.rotation.x = Math.PI / 1.7;
ringB.rotation.y = Math.PI / 5;
core.add(ringB);

const ringC = new THREE.Mesh(
  new THREE.TorusGeometry(2.4, 0.008, 8, 96),
  new THREE.MeshBasicMaterial({ color: 0x9b5cff, transparent: true, opacity: 0.45 })
);
ringC.rotation.y = Math.PI / 2.2;
core.add(ringC);

/* orbiting "electrons" */
const orbitGroup = new THREE.Group();
const orbiters = [];
const orbiterColors = [0x00e5ff, 0x9b5cff, 0x3b6dff];
for (let i = 0; i < 3; i++){
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 12, 12),
    new THREE.MeshBasicMaterial({ color: orbiterColors[i] })
  );
  const radius = 3.4 + i * 0.3;
  const speed = 0.4 + i * 0.18;
  const tilt = (i / 3) * Math.PI;
  orbiters.push({ mesh: m, radius, speed, tilt, offset: i * 2.1 });
  orbitGroup.add(m);
}
core.add(orbitGroup);

core.position.set(0, 0, 0);
scene.add(core);

/* ---------------------------------------------------------
   4. FLOATING GEOMETRIC SHAPES
--------------------------------------------------------- */
const shapesGroup = new THREE.Group();
const shapeDefs = [
  { geo: new THREE.OctahedronGeometry(0.45), color: 0x00e5ff, wire: true },
  { geo: new THREE.TetrahedronGeometry(0.5), color: 0x9b5cff, wire: false },
  { geo: new THREE.TorusGeometry(0.4, 0.12, 8, 24), color: 0x3b6dff, wire: false },
  { geo: new THREE.IcosahedronGeometry(0.4, 0), color: 0x00e5ff, wire: true },
  { geo: new THREE.OctahedronGeometry(0.3), color: 0x9b5cff, wire: false },
  { geo: new THREE.BoxGeometry(0.5, 0.5, 0.5), color: 0x3b6dff, wire: true },
  { geo: new THREE.TetrahedronGeometry(0.35), color: 0x00e5ff, wire: false },
  { geo: new THREE.IcosahedronGeometry(0.3, 0), color: 0x9b5cff, wire: false },
];

const floaters = [];
const FLOATER_COUNT = isLowPower ? 8 : shapeDefs.length;

for (let i = 0; i < FLOATER_COUNT; i++){
  const def = shapeDefs[i % shapeDefs.length];
  let mat;
  if (def.wire){
    mat = new THREE.MeshBasicMaterial({ color: def.color, wireframe: true, transparent: true, opacity: 0.7 });
  } else {
    mat = new THREE.MeshStandardMaterial({
      color: def.color, transparent: true, opacity: 0.85,
      emissive: def.color, emissiveIntensity: 0.35,
      roughness: 0.35, metalness: 0.4
    });
  }
  const mesh = new THREE.Mesh(def.geo, mat);

  const angle = (i / FLOATER_COUNT) * Math.PI * 2;
  const radius = 6 + Math.random() * 5;
  mesh.position.set(
    Math.cos(angle) * radius,
    (Math.random() - 0.5) * 8,
    Math.sin(angle) * radius - 6
  );
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

  const data = {
    mesh,
    baseY: mesh.position.y,
    baseX: mesh.position.x,
    baseZ: mesh.position.z,
    rotSpeed: 0.15 + Math.random() * 0.3,
    bobSpeed: 0.3 + Math.random() * 0.4,
    bobAmp: 0.4 + Math.random() * 0.5,
    bobOffset: Math.random() * Math.PI * 2,
    parallaxFactor: 0.3 + Math.random() * 0.7
  };
  floaters.push(data);
  shapesGroup.add(mesh);
}
scene.add(shapesGroup);

/* ---------------------------------------------------------
   5. PARTICLE FIELD
--------------------------------------------------------- */
const PARTICLE_COUNT = isLowPower ? 700 : 2200;
const particleGeo = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLE_COUNT * 3);
const particleColors = new Float32Array(PARTICLE_COUNT * 3);

const palette = [
  new THREE.Color(0x00e5ff),
  new THREE.Color(0x3b6dff),
  new THREE.Color(0x9b5cff)
];

for (let i = 0; i < PARTICLE_COUNT; i++){
  const i3 = i * 3;
  positions[i3] = (Math.random() - 0.5) * 60;
  positions[i3 + 1] = (Math.random() - 0.5) * 60;
  positions[i3 + 2] = (Math.random() - 0.5) * 90 - 20;

  const c = palette[Math.floor(Math.random() * palette.length)];
  particleColors[i3] = c.r;
  particleColors[i3 + 1] = c.g;
  particleColors[i3 + 2] = c.b;
}
particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

const particleMat = new THREE.PointsMaterial({
  size: 0.065,
  vertexColors: true,
  transparent: true,
  opacity: 0.75,
  sizeAttenuation: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

/* ---------------------------------------------------------
   6. POST-PROCESSING (bloom) — skipped on low-power devices
--------------------------------------------------------- */
let composer = null;
if (!isLowPower){
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.85,   // strength
    0.6,    // radius
    0.15    // threshold
  );
  composer.addPass(bloom);
}

/* ---------------------------------------------------------
   7. RESIZE
--------------------------------------------------------- */
function onResize(){
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  if (composer) composer.setSize(w, h);
}
window.addEventListener('resize', onResize);

/* ---------------------------------------------------------
   8. MOUSE PARALLAX
--------------------------------------------------------- */
window.addEventListener('mousemove', (e) => {
  state.targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
  state.targetMouseY = (e.clientY / window.innerHeight) * 2 - 1;
});

/* ---------------------------------------------------------
   9. SCROLL-DRIVEN CAMERA JOURNEY (GSAP ScrollTrigger)
--------------------------------------------------------- */
const scrollState = { progress: 0 };

ScrollTrigger.create({
  trigger: document.body,
  start: 'top top',
  end: 'bottom bottom',
  scrub: 0.6,
  onUpdate: (self) => { scrollState.progress = self.progress; }
});

/* Hero core scales down & recedes as user leaves the hero section */
gsap.to(core.scale, {
  x: 0.35, y: 0.35, z: 0.35,
  scrollTrigger: {
    trigger: '#hero',
    start: 'top top',
    end: 'bottom top',
    scrub: 0.6
  }
});
gsap.to(core.position, {
  z: -6,
  scrollTrigger: {
    trigger: '#hero',
    start: 'top top',
    end: 'bottom top',
    scrub: 0.6
  }
});
gsap.to([outerWire.material, ringMatA, ringB.material, ringC.material], {
  opacity: 0,
  scrollTrigger: {
    trigger: '#hero',
    start: 'center top',
    end: 'bottom top',
    scrub: 0.6
  }
});
gsap.to(innerMesh.material, {
  opacity: 0,
  scrollTrigger: {
    trigger: '#hero',
    start: 'center top',
    end: 'bottom top',
    scrub: 0.6
  }
});

/* ---------------------------------------------------------
   10. RENDER LOOP
--------------------------------------------------------- */
const clock = new THREE.Clock();

function animate(){
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  const dt = clock.getDelta();

  // smooth mouse follow
  state.mouseX += (state.targetMouseX - state.mouseX) * 0.04;
  state.mouseY += (state.targetMouseY - state.mouseY) * 0.04;

  // core idle motion
  if (!prefersReducedMotion){
    core.rotation.y = t * 0.18;
    core.rotation.x = Math.sin(t * 0.25) * 0.12;
    outerWire.rotation.y = -t * 0.1;
    innerMesh.rotation.y = t * 0.3;
    innerMesh.rotation.x = t * 0.15;
    ringA.rotation.z = t * 0.25;
    ringB.rotation.z = -t * 0.18;
    ringC.rotation.x = t * 0.2;
    core.position.y = Math.sin(t * 0.5) * 0.18;

    orbiters.forEach((o) => {
      const a = t * o.speed + o.offset;
      o.mesh.position.set(
        Math.cos(a) * o.radius * Math.cos(o.tilt),
        Math.sin(a) * o.radius * 0.4,
        Math.sin(a) * o.radius * Math.sin(o.tilt) + Math.cos(a) * 0.4
      );
    });
  }

  // floating shapes: idle bob + rotation + mouse parallax
  floaters.forEach((f) => {
    if (!prefersReducedMotion){
      f.mesh.rotation.x += dt * f.rotSpeed * 0.4;
      f.mesh.rotation.y += dt * f.rotSpeed;
      f.mesh.position.y = f.baseY + Math.sin(t * f.bobSpeed + f.bobOffset) * f.bobAmp;
    }
    f.mesh.position.x = f.baseX + state.mouseX * f.parallaxFactor * 1.4;
    f.mesh.position.z = f.baseZ + state.mouseY * f.parallaxFactor * 0.6;
  });

  // particle drift
  if (!prefersReducedMotion){
    particles.rotation.y = t * 0.012;
    particles.rotation.x = Math.sin(t * 0.05) * 0.03;
  }

  // camera: idle parallax + mouse + scroll-driven dolly through the field
  const scrollDolly = scrollState.progress * 34; // travel depth across whole page
  const targetX = state.mouseX * 1.1;
  const targetY = -state.mouseY * 0.7;
  camera.position.x += (targetX - camera.position.x) * 0.05;
  camera.position.y += (targetY - camera.position.y) * 0.05;
  camera.position.z = 14 - scrollDolly;
  camera.lookAt(0, 0, -scrollDolly * 0.4);

  // keep lights lively
  keyLight.intensity = 12 + Math.sin(t * 1.4) * 3;
  rimLight.intensity = 10 + Math.cos(t * 1.1) * 2.5;

  if (composer){
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}

/* ---------------------------------------------------------
   11. NAV BEHAVIOR
--------------------------------------------------------- */
const navEl = document.getElementById('siteNav');
const navBurger = document.getElementById('navBurger');
const navMobile = document.getElementById('navMobile');

function onScrollNav(){
  navEl.classList.toggle('is-scrolled', window.scrollY > 40);
}
window.addEventListener('scroll', onScrollNav, { passive: true });

navBurger.addEventListener('click', () => {
  const open = navMobile.classList.toggle('is-open');
  navBurger.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
});
navMobile.querySelectorAll('a').forEach((a) => {
  a.addEventListener('click', () => {
    navMobile.classList.remove('is-open');
    navBurger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  });
});

/* ---------------------------------------------------------
   12. CUSTOM CURSOR (desktop only)
--------------------------------------------------------- */
if (!isCoarsePointer){
  const glow = document.getElementById('cursorGlow');
  const ring = document.getElementById('cursorRing');
  const quickGlowX = gsap.quickTo(glow, 'x', { duration: 0.5, ease: 'power3' });
  const quickGlowY = gsap.quickTo(glow, 'y', { duration: 0.5, ease: 'power3' });
  const quickRingX = gsap.quickTo(ring, 'x', { duration: 0.15, ease: 'power3' });
  const quickRingY = gsap.quickTo(ring, 'y', { duration: 0.15, ease: 'power3' });

  window.addEventListener('mousemove', (e) => {
    quickGlowX(e.clientX); quickGlowY(e.clientY);
    quickRingX(e.clientX); quickRingY(e.clientY);
  });

  document.querySelectorAll('a, button, .tilt-card, input, textarea').forEach((el) => {
    el.addEventListener('mouseenter', () => ring.classList.add('is-active'));
    el.addEventListener('mouseleave', () => ring.classList.remove('is-active'));
  });
}

/* ---------------------------------------------------------
   13. SCROLL REVEALS (sections, cards, copy)
--------------------------------------------------------- */
function initReveals(){
  gsap.utils.toArray('.reveal-up').forEach((el, i) => {
    gsap.to(el, {
      opacity: 1, y: 0,
      duration: 0.9, ease: 'power3.out',
      delay: i * 0.08,
      scrollTrigger: { trigger: el, start: 'top 90%' }
    });
  });

  gsap.utils.toArray('.reveal').forEach((el) => {
    gsap.to(el, {
      opacity: 1, y: 0,
      duration: 0.8, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' }
    });
  });

  gsap.utils.toArray('.tilt-card').forEach((card, i) => {
    gsap.fromTo(card,
      { opacity: 0, y: 40, rotateX: -8 },
      {
        opacity: 1, y: 0, rotateX: 0,
        duration: 0.8, ease: 'power3.out', delay: (i % 3) * 0.08,
        scrollTrigger: { trigger: card, start: 'top 92%' }
      }
    );
  });

  gsap.utils.toArray('.showcase-card').forEach((card, i) => {
    gsap.fromTo(card,
      { opacity: 0, y: 50 },
      {
        opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', delay: i * 0.1,
        scrollTrigger: { trigger: card, start: 'top 90%' }
      }
    );
  });

  gsap.utils.toArray('.workshop-row').forEach((row, i) => {
    gsap.fromTo(row,
      { opacity: 0, x: -24 },
      {
        opacity: 1, x: 0, duration: 0.7, ease: 'power3.out', delay: i * 0.06,
        scrollTrigger: { trigger: row, start: 'top 92%' }
      }
    );
  });
}

/* ---------------------------------------------------------
   14. HERO STAT COUNTERS
--------------------------------------------------------- */
function initCounters(){
  document.querySelectorAll('.hero-stat .num').forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target,
      duration: 1.8,
      ease: 'power2.out',
      delay: 0.6,
      onUpdate: () => { el.textContent = Math.round(obj.v).toLocaleString(); }
    });
  });
}

/* ---------------------------------------------------------
   15. 3D TILT FOR EVENT CARDS (vanilla pointer tracking)
--------------------------------------------------------- */
function initTiltCards(){
  const maxTilt = isCoarsePointer ? 0 : 10;
  document.querySelectorAll('.tilt-card').forEach((card) => {
    if (maxTilt === 0) return;
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rotY = (px - 0.5) * maxTilt;
      const rotX = (0.5 - py) * maxTilt;
      gsap.to(card, {
        rotateX: rotX, rotateY: rotY,
        duration: 0.4, ease: 'power2.out',
        overwrite: true
      });
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
    });
    card.addEventListener('mouseleave', () => {
      gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.6, ease: 'power3.out' });
    });
  });
}

/* ---------------------------------------------------------
   16. CONTACT FORM
--------------------------------------------------------- */
function initContactForm(){
  const form = document.getElementById('contactForm');
  const status = document.getElementById('formStatus');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('.form-submit');
    submitBtn.disabled = true;
    status.textContent = 'Transmitting…';
    setTimeout(() => {
      status.textContent = 'Message received — we\u2019ll reply within 24 hours.';
      form.reset();
      submitBtn.disabled = false;
    }, 900);
  });
}

/* ---------------------------------------------------------
   17. HERO LOAD-IN SEQUENCE
--------------------------------------------------------- */
function playHeroIntro(){
  gsap.set(core.scale, { x: 0.001, y: 0.001, z: 0.001 });
  gsap.to(core.scale, {
    x: 1, y: 1, z: 1,
    duration: 1.6, ease: 'elastic.out(0.7, 0.5)'
  });
}

/* ---------------------------------------------------------
   INIT
--------------------------------------------------------- */
function init(){
  initReveals();
  initCounters();
  initTiltCards();
  initContactForm();
  playHeroIntro();
  animate();
  state.ready = true;
}

runLoader(init);

window.addEventListener('load', () => {
  ScrollTrigger.refresh();
});
