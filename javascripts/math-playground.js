(function (global) {
  "use strict";

  const TWO_PI = Math.PI * 2;
  const PRESETS = [[2, 3], [3, 4], [5, 6]];

  function normalizePhase(value) {
    return ((value % 360) + 360) % 360;
  }

  function sampleCurve(a, b, phase, segments) {
    const count = segments === undefined ? 240 : segments;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1 || a > 16 || b > 16 ||
        !Number.isFinite(phase) || !Number.isInteger(count) || count < 12 || count > 4096) {
      throw new RangeError("Invalid curve parameters");
    }
    const offset = normalizePhase(phase) * Math.PI / 180;
    return Array.from({ length: count + 1 }, function (_, index) {
      const t = index / count * TWO_PI;
      return [180 + 116 * Math.sin(a * t + offset), 86 - 63 * Math.sin(b * t)];
    });
  }

  function curvePath(a, b, phase, segments) {
    return sampleCurve(a, b, phase, segments).map(function (point, index) {
      return (index ? "L" : "M") + point[0].toFixed(2) + "," + point[1].toFixed(2);
    }).join(" ");
  }

  if (typeof module === "object" && module.exports) {
    module.exports = { normalizePhase: normalizePhase, sampleCurve: sampleCurve, curvePath: curvePath };
  }
  if (!global.document || global.__hmMathPlayground) return;
  global.__hmMathPlayground = true;

  let cleanup = function () {};
  function mount() {
    cleanup();
    cleanup = function () {};
    const document = global.document;
    const figure = document.querySelector("[data-hm-playground]");
    if (!figure) return;
    const svg = figure.querySelector("[data-hm-curve]");
    const trace = figure.querySelector("[data-hm-trace]");
    const highlight = figure.querySelector("[data-hm-highlight]");
    const point = figure.querySelector("[data-hm-point]");
    const phaseInput = figure.querySelector("[data-hm-phase]");
    const output = figure.querySelector("[data-hm-phase-value]");
    const play = figure.querySelector("[data-hm-play]");
    const reset = figure.querySelector("[data-hm-reset]");
    const controls = figure.querySelector("[data-hm-math-controls]");
    const ratioButtons = Array.from(figure.querySelectorAll("[data-hm-ratio]"));
    if (!svg || !trace || !highlight || !point || !phaseInput || !output || !play || !reset || !controls) return;

    const media = global.matchMedia("(prefers-reduced-motion: reduce)");
    const pointerMedia = global.matchMedia("(pointer: coarse)");
    const listeners = [];
    let a = 2, b = 3, phase = 45;
    let playing = false, frame = 0, lastTime = null, revealFrame = 0;
    let visible = !global.IntersectionObserver, revealed = false, destroyed = false;
    let drag = null;

    function listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      listeners.push(function () { target.removeEventListener(type, handler, options); });
    }
    function motionAllowed() {
      return !media.matches && document.documentElement.dataset.hmMotion !== "off";
    }
    function stopReveal() {
      if (revealFrame) global.cancelAnimationFrame(revealFrame);
      revealFrame = 0;
      trace.style.removeProperty("stroke-dasharray");
      trace.style.removeProperty("stroke-dashoffset");
      figure.classList.remove("is-revealing");
    }
    function stop() {
      playing = false;
      if (frame) global.cancelAnimationFrame(frame);
      frame = 0;
      lastTime = null;
      play.textContent = "播放";
      play.setAttribute("aria-pressed", "false");
      stopReveal();
    }
    function render(updateLabel) {
      const path = curvePath(a, b, phase);
      trace.setAttribute("d", path);
      highlight.setAttribute("d", path);
      const start = sampleCurve(a, b, phase, 12)[0];
      point.setAttribute("cx", start[0].toFixed(2));
      point.setAttribute("cy", start[1].toFixed(2));
      const degrees = Math.round(phase);
      phaseInput.value = String(degrees);
      output.textContent = degrees + "°";
      phaseInput.setAttribute("aria-valuetext", degrees + " 度");
      if (updateLabel) {
        const title = svg.querySelector("title");
        if (title) title.textContent = "利萨如曲线：频率比 " + a + " 比 " + b + "，相位 " + degrees + " 度";
        figure.querySelector("[data-hm-current-ratio]").textContent = a + " : " + b;
        figure.querySelector("[data-hm-formula]").textContent = "x = sin(" + a + "t + φ); y = sin(" + b + "t)";
        ratioButtons.forEach(function (button) {
          button.setAttribute("aria-pressed", String(button.dataset.hmRatio === a + ":" + b));
        });
      }
    }
    function evolve(time) {
      frame = 0;
      if (!playing || destroyed || !visible || document.hidden || !motionAllowed()) { stop(); render(true); return; }
      if (lastTime !== null) phase = normalizePhase(phase + Math.min(time - lastTime, 80) * .012);
      lastTime = time;
      render(false);
      frame = global.requestAnimationFrame(evolve);
    }
    function reveal() {
      if (revealed || document.hidden || !visible || !motionAllowed()) return;
      revealed = true;
      const start = global.performance.now();
      figure.classList.add("is-revealing");
      trace.style.strokeDasharray = "1";
      trace.style.strokeDashoffset = "1";
      function tick(time) {
        if (destroyed || document.hidden || !visible || !motionAllowed()) { stopReveal(); return; }
        const progress = Math.min(1, (time - start) / 1200);
        trace.style.strokeDashoffset = String(1 - progress);
        if (progress < 1) revealFrame = global.requestAnimationFrame(tick);
        else stopReveal();
      }
      revealFrame = global.requestAnimationFrame(tick);
    }
    function syncMotion() {
      if (!motionAllowed()) { stop(); render(true); }
      play.disabled = !motionAllowed();
      play.title = motionAllowed() ? "缓慢改变相位；再次点击暂停" : "动效已关闭，仍可手动调节相位";
    }
    function syncPointerHint() {
      figure.querySelector("#hm-math-hint").textContent = pointerMedia.matches ? "调节相位，观察曲线" : "拖动曲线或调节相位";
    }

    ratioButtons.forEach(function (button) {
      listen(button, "click", function () {
        const next = button.dataset.hmRatio.split(":").map(Number);
        if (!PRESETS.some(function (preset) { return preset[0] === next[0] && preset[1] === next[1]; })) return;
        stop(); revealed = true; a = next[0]; b = next[1]; render(true);
      });
    });
    listen(phaseInput, "input", function () {
      stop(); revealed = true; phase = Number(phaseInput.value); render(true);
    });
    listen(play, "click", function () {
      revealed = true;
      if (playing) { stop(); render(true); return; }
      if (!motionAllowed() || document.hidden || !visible) return;
      stopReveal(); playing = true; lastTime = null;
      play.textContent = "暂停";
      play.setAttribute("aria-pressed", "true");
      frame = global.requestAnimationFrame(evolve);
    });
    listen(reset, "click", function () {
      stop(); revealed = true; a = 2; b = 3; phase = 45; render(true);
    });
    listen(svg, "pointerdown", function (event) {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      stop(); revealed = true;
      drag = { id: event.pointerId, x: event.clientX, phase: phase };
      svg.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    listen(svg, "pointermove", function (event) {
      if (!drag || drag.id !== event.pointerId) return;
      const width = svg.getBoundingClientRect().width;
      if (!width) return;
      phase = Math.round(normalizePhase(drag.phase + (event.clientX - drag.x) / width * 360));
      render(true);
    });
    function endDrag() { drag = null; }
    listen(svg, "pointerup", endDrag);
    listen(svg, "pointercancel", endDrag);
    listen(svg, "lostpointercapture", endDrag);
    listen(document, "visibilitychange", function () {
      if (document.hidden) { stop(); render(true); } else reveal();
    });
    listen(document, "hm:motion-change", syncMotion);
    if (media.addEventListener) listen(media, "change", syncMotion);
    else if (media.addListener) { media.addListener(syncMotion); listeners.push(function () { media.removeListener(syncMotion); }); }
    if (pointerMedia.addEventListener) listen(pointerMedia, "change", syncPointerHint);

    let observer = null;
    if (global.IntersectionObserver) {
      observer = new global.IntersectionObserver(function (entries) {
        visible = entries.some(function (entry) { return entry.isIntersecting; });
        if (!visible) { stop(); render(true); } else reveal();
      }, { threshold: .1 });
      observer.observe(figure);
    }
    render(true);
    syncMotion();
    syncPointerHint();
    controls.hidden = false;
    figure.classList.add("is-ready");
    if (!observer) reveal();

    cleanup = function () {
      destroyed = true;
      stop();
      if (observer) observer.disconnect();
      listeners.forEach(function (remove) { remove(); });
      controls.hidden = true;
      figure.classList.remove("is-ready");
    };
  }

  if (global.document$ && typeof global.document$.subscribe === "function") global.document$.subscribe(mount);
  else if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})(typeof window !== "undefined" ? window : globalThis);
