(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const body = document.body;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (a, b, t) => a + (b - a) * t;

  body.classList.add('is-loading');

  /* ------------------------------------------------------------
     Preloader: an eased counter, not a fake network loader.
     ------------------------------------------------------------ */
  const preloader = document.getElementById('preloader');
  const loadBar = document.getElementById('loadBar');
  const loadCount = document.getElementById('loadCount');
  let loaded = false;

  function finishLoad() {
    if (loaded) return;
    loaded = true;
    let value = 0;
    const start = performance.now();
    const duration = reduced ? 0 : 900;

    function tick(now) {
      const t = duration ? clamp((now - start) / duration, 0, 1) : 1;
      const eased = 1 - Math.pow(1 - t, 4);
      value = Math.round(eased * 100);
      loadBar.style.transform = `scaleX(${value / 100})`;
      loadCount.textContent = String(value).padStart(3, '0');
      if (t < 1) requestAnimationFrame(tick);
      else {
        body.classList.add('is-ready');
        body.classList.remove('is-loading');
        setTimeout(() => preloader?.setAttribute('aria-hidden', 'true'), 1200);
      }
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener('load', finishLoad, { once: true });
  setTimeout(finishLoad, 1400);

  /* ------------------------------------------------------------
     Reveal on scroll
     ------------------------------------------------------------ */
  const revealItems = [...document.querySelectorAll('.reveal')];
  revealItems.forEach((item, index) => {
    item.style.setProperty('--i', item.style.getPropertyValue('--i') || String(index % 6));
  });

  if (reduced) {
    revealItems.forEach((item) => item.classList.add('in'));
    document.querySelectorAll('.manifesto__rule, .security__line').forEach((line) => line.classList.add('in'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    revealItems.forEach((item) => observer.observe(item));
    document.querySelectorAll('.manifesto__rule, .security__line').forEach((line) => observer.observe(line));
  }

  /* ------------------------------------------------------------
     Scroll progress and section snap
     ------------------------------------------------------------ */
  const progress = document.getElementById('scrollProgress');
  let scrollTarget = 0;
  let scrollCurrent = 0;

  function updateScrollTarget() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollTarget = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
  }

  window.addEventListener('scroll', updateScrollTarget, { passive: true });
  updateScrollTarget();

  const securitySection = document.getElementById('security');
  function scrollTick() {
    scrollCurrent = lerp(scrollCurrent, scrollTarget, 0.12);
    progress.style.transform = `scaleX(${scrollCurrent})`;
    if (securitySection) {
      const top = securitySection.offsetTop;
      const bottom = top + securitySection.offsetHeight;
      body.classList.toggle('on-dark', window.scrollY > top - 90 && window.scrollY < bottom - 90);
    }
    requestAnimationFrame(scrollTick);
  }
  requestAnimationFrame(scrollTick);

  /* ------------------------------------------------------------
     Cursor: a damped ring, never a snapping dot.
     ------------------------------------------------------------ */
  if (finePointer && !reduced) {
    const cursor = document.getElementById('cursor');
    let cx = window.innerWidth / 2;
    let cy = window.innerHeight / 2;
    let tx = cx;
    let ty = cy;
    let visible = false;

    window.addEventListener('pointermove', (event) => {
      tx = event.clientX;
      ty = event.clientY;
      if (!visible) {
        visible = true;
        cursor.classList.add('is-active');
      }
    }, { passive: true });

    document.querySelectorAll('a, button, .panel, .feature, .download__button').forEach((el) => {
      el.addEventListener('pointerenter', () => cursor.classList.add('is-hover'));
      el.addEventListener('pointerleave', () => cursor.classList.remove('is-hover'));
    });

    function cursorTick() {
      cx = lerp(cx, tx, 0.22);
      cy = lerp(cy, ty, 0.22);
      cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(cursorTick);
    }
    requestAnimationFrame(cursorTick);
  }

  /* ------------------------------------------------------------
     Marquee: velocity eases toward its target; no linear CSS.
     ------------------------------------------------------------ */
  const marquee = document.getElementById('marquee');
  const track = document.getElementById('marqueeTrack');
  if (track) {
    track.innerHTML += track.innerHTML;
    let x = 0;
    let speed = reduced ? 0 : 0.55;
    let targetSpeed = speed;
    let width = track.scrollWidth / 2;

    window.addEventListener('resize', () => { width = track.scrollWidth / 2; }, { passive: true });
    marquee?.addEventListener('pointerenter', () => { targetSpeed = 0.12; });
    marquee?.addEventListener('pointerleave', () => { targetSpeed = 0.55; });

    function marqueeTick() {
      speed = lerp(speed, targetSpeed, 0.06);
      x -= speed;
      if (-x >= width) x += width;
      track.style.transform = `translate3d(${x}px,0,0)`;
      requestAnimationFrame(marqueeTick);
    }
    requestAnimationFrame(marqueeTick);
  }

  /* ------------------------------------------------------------
     Magnetic buttons: elastic pull, eased return.
     ------------------------------------------------------------ */
  if (finePointer && !reduced) {
    document.querySelectorAll('.magnetic').forEach((el) => {
      let raf = 0;
      el.addEventListener('pointermove', (event) => {
        const rect = el.getBoundingClientRect();
        const dx = (event.clientX - (rect.left + rect.width / 2)) * 0.16;
        const dy = (event.clientY - (rect.top + rect.height / 2)) * 0.16;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        });
      });
      el.addEventListener('pointerleave', () => {
        cancelAnimationFrame(raf);
        el.style.transform = 'translate3d(0,0,0)';
      });
    });
  }

  /* ------------------------------------------------------------
     Tilt: the two panels lean toward the pointer, then settle.
     ------------------------------------------------------------ */
  if (finePointer && !reduced) {
    document.querySelectorAll('[data-tilt]').forEach((panel) => {
      let currentX = 0;
      let currentY = 0;
      let targetX = 0;
      let targetY = 0;
      let raf = 0;

      panel.addEventListener('pointermove', (event) => {
        const rect = panel.getBoundingClientRect();
        targetX = ((event.clientY - rect.top) / rect.height - 0.5) * -5;
        targetY = ((event.clientX - rect.left) / rect.width - 0.5) * 7;
        if (!raf) raf = requestAnimationFrame(tick);
      });

      panel.addEventListener('pointerleave', () => {
        targetX = 0;
        targetY = 0;
        if (!raf) raf = requestAnimationFrame(tick);
      });

      function tick() {
        currentX = lerp(currentX, targetX, 0.1);
        currentY = lerp(currentY, targetY, 0.1);
        panel.style.transform = `perspective(900px) rotateX(${currentX}deg) rotateY(${currentY}deg)`;
        if (Math.abs(currentX - targetX) > 0.01 || Math.abs(currentY - targetY) > 0.01) {
          raf = requestAnimationFrame(tick);
        } else {
          raf = 0;
        }
      }
    });
  }

  /* ------------------------------------------------------------
     Hero field: sparse grid + red pulses.
     ------------------------------------------------------------ */
  const canvas = document.getElementById('field');
  if (canvas && !reduced) {
    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let points = [];
    let pointer = { x: -999, y: -999 };
    let t = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const gap = Math.max(54, Math.min(width, height) / 12);
      points = [];
      for (let x = gap; x < width; x += gap) {
        for (let y = gap; y < height; y += gap) {
          points.push({
            x: x + (Math.sin(y * 0.03) * gap) / 5,
            y: y + (Math.cos(x * 0.025) * gap) / 5,
            phase: Math.random() * Math.PI * 2,
            red: Math.random() > 0.86,
          });
        }
      }
    }

    function draw() {
      t += 0.007;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        const pulse = 0.45 + Math.sin(t * 1.8 + a.phase) * 0.35;
        for (let j = i + 1; j < points.length; j += 1) {
          const b = points[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 92) {
            ctx.strokeStyle = `rgba(22,18,14,${0.08 * (1 - dist / 92)})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }

        const pdx = a.x - pointer.x;
        const pdy = a.y - pointer.y;
        const pd = Math.hypot(pdx, pdy);
        const near = pd < 170 ? (1 - pd / 170) : 0;
        ctx.fillStyle = a.red ? `rgba(212,43,31,${0.3 + near * 0.5})` : `rgba(22,18,14,${0.18 + near * 0.35})`;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.red ? 2.2 + near * 2.2 : 1.2 + near, 0, Math.PI * 2);
        ctx.fill();

        if (a.red && near > 0.25) {
          ctx.strokeStyle = `rgba(212,43,31,${near * 0.35})`;
          ctx.beginPath();
          ctx.arc(a.x, a.y, 10 + Math.sin(t * 3 + a.phase) * 5 + near * 14, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      requestAnimationFrame(draw);
    }

    canvas.addEventListener('pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    }, { passive: true });
    canvas.addEventListener('pointerleave', () => { pointer.x = -999; pointer.y = -999; });

    window.addEventListener('resize', resize, { passive: true });
    resize();
    draw();
  }

  /* ------------------------------------------------------------
     Hero art: a slow breathing rotation with a sine phase.
     ------------------------------------------------------------ */
  const art = document.querySelector('.hero__art');
  if (art && !reduced) {
    const rings = art.querySelector('.art__rings');
    const logo = art.querySelector('.art__logo');
    let mx = 0;
    let my = 0;
    let tx = 0;
    let ty = 0;

    art.addEventListener('pointermove', (event) => {
      const rect = art.getBoundingClientRect();
      tx = ((event.clientX - rect.left) / rect.width - 0.5) * 12;
      ty = ((event.clientY - rect.top) / rect.height - 0.5) * 12;
    });
    art.addEventListener('pointerleave', () => { tx = 0; ty = 0; });

    function artTick(time) {
      mx = lerp(mx, tx, 0.06);
      my = lerp(my, ty, 0.06);
      const breathe = Math.sin(time * 0.00042);
      rings.style.transform = `rotate(${breathe * 5 + mx * 0.35}deg) scale(${1 + breathe * 0.006})`;
      logo.style.transform = `translate3d(${mx * 0.4}px, ${my * 0.4}px, 0) rotate(${-8 + breathe * 1.6 + mx * 0.2}deg)`;
      requestAnimationFrame(artTick);
    }
    requestAnimationFrame(artTick);
  }
})();
