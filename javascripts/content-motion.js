(function () {
  "use strict";
  if (window.__hmMotionLoaded) return;
  window.__hmMotionLoaded = true;

  var KEY = "hilbertmath:motion:v1";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  var preference = "on";
  try { preference = localStorage.getItem(KEY) === "off" ? "off" : "on"; } catch (_) {}
  var dispose = function () {};
  var enabled = false;

  function applyMotion() {
    enabled = preference !== "off" && !reduced.matches;
    document.documentElement.setAttribute("data-hm-motion", enabled ? "on" : "off");
    document.querySelectorAll("[data-motion-toggle]").forEach(function (button) {
      button.disabled = reduced.matches;
      button.setAttribute("aria-pressed", String(enabled));
      button.textContent = reduced.matches ? "动效已减弱" : "动效 · " + (enabled ? "开" : "关");
      button.title = reduced.matches ? "遵循系统的减少动态效果设置" : "切换装饰动效，内容与操作不受影响";
    });
    document.dispatchEvent(new CustomEvent("hm:motion-change", { detail: { enabled: enabled } }));
  }

  function setup() {
    dispose();
    var cleanup = [];
    var animations = new Set();
    var pending = new Set();
    var revealFrame = 0;
    var hoverFrame = 0;
    var hovering = null;
    var point = null;
    var observer = null;
    var mutations = [];
    var seen = new WeakSet();

    function on(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      cleanup.push(function () { target.removeEventListener(type, handler, options); });
    }

    function clearHover() {
      if (hovering) hovering.removeAttribute("data-motion-hover");
      hovering = null;
      point = null;
      if (hoverFrame) cancelAnimationFrame(hoverFrame);
      hoverFrame = 0;
    }

    function reveal(element, delay) {
      if (!enabled || element.hidden || typeof element.animate !== "function") return;
      var rect = element.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;
      var animation = element.animate([
        { opacity: 0.65, transform: "translateY(7px)" },
        { opacity: 1, transform: "translateY(0)" }
      ], { duration: 280, delay: delay, easing: "cubic-bezier(.2,.7,.3,1)" });
      animations.add(animation);
      animation.onfinish = animation.oncancel = function () { animations.delete(animation); };
    }

    function queueReveal(element) {
      pending.add(element);
      if (revealFrame) return;
      revealFrame = requestAnimationFrame(function () {
        revealFrame = 0;
        Array.from(pending).slice(0, 8).forEach(function (entry, index) { reveal(entry, index * 22); });
        pending.clear();
      });
    }

    if (typeof IntersectionObserver === "function") {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || entry.target.hidden || seen.has(entry.target)) return;
          seen.add(entry.target);
          queueReveal(entry.target);
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.08 });
    }

    document.querySelectorAll("[data-library]").forEach(function (library) {
      library.querySelectorAll("[data-entry]").forEach(function (entry) {
        if (observer) observer.observe(entry);
      });
      var mutation = new MutationObserver(function (records) {
        records.forEach(function (record) {
          if (record.target.matches("[data-entry]") && !record.target.hidden) queueReveal(record.target);
        });
      });
      mutation.observe(library, { subtree: true, attributes: true, attributeFilter: ["hidden"] });
      mutations.push(mutation);

      on(library, "pointermove", function (event) {
        if (!enabled || !fine.matches || event.pointerType === "touch") return;
        var entry = event.target instanceof Element && event.target.closest("[data-entry]");
        if (!entry || !library.contains(entry)) { clearHover(); return; }
        if (entry !== hovering) {
          clearHover();
          hovering = entry;
          hovering.setAttribute("data-motion-hover", "");
        }
        point = { x: event.clientX, y: event.clientY };
        if (hoverFrame) return;
        hoverFrame = requestAnimationFrame(function () {
          hoverFrame = 0;
          if (!hovering || !point) return;
          var rect = hovering.getBoundingClientRect();
          hovering.style.setProperty("--hm-pointer-x", Math.max(0, Math.min(rect.width, point.x - rect.left)) + "px");
          hovering.style.setProperty("--hm-pointer-y", Math.max(0, Math.min(rect.height, point.y - rect.top)) + "px");
        });
      }, { passive: true });
      on(library, "pointerleave", clearHover);
      on(library, "focusout", function (event) { if (!library.contains(event.relatedTarget)) clearHover(); });
    });

    var libraryControls = document.querySelector("[data-library-controls]");
    var toolbar = document.querySelector("[data-reading-toolbar]");
    var target = libraryControls && (libraryControls.querySelector(".hm-library-scopes") || libraryControls);
    target = target || toolbar;
    if (target) {
      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "hm-motion-toggle";
      toggle.setAttribute("data-motion-toggle", "");
      toggle.setAttribute("aria-label", "装饰动效");
      if (target === libraryControls) {
        var row = document.createElement("div");
        row.className = "hm-motion-row";
        row.appendChild(toggle);
        target.insertBefore(row, target.firstChild);
        cleanup.push(function () { row.remove(); });
      } else {
        target.appendChild(toggle);
        cleanup.push(function () { toggle.remove(); });
      }
      on(toggle, "click", function () {
        preference = preference === "off" ? "on" : "off";
        try { localStorage.setItem(KEY, preference); } catch (_) {}
        applyMotion();
      });
    }
    on(document, "hm:motion-change", function () {
      if (!enabled) {
        animations.forEach(function (animation) { animation.cancel(); });
        animations.clear();
        pending.clear();
        clearHover();
      }
    });
    on(document, "visibilitychange", function () { if (document.hidden) clearHover(); });
    applyMotion();
    dispose = function () {
      cleanup.forEach(function (fn) { fn(); });
      animations.forEach(function (animation) { animation.cancel(); });
      mutations.forEach(function (mutation) { mutation.disconnect(); });
      if (observer) observer.disconnect();
      if (revealFrame) cancelAnimationFrame(revealFrame);
      clearHover();
    };
  }

  applyMotion();
  reduced.addEventListener("change", applyMotion);
  window.addEventListener("storage", function (event) {
    if (event.key === KEY || event.key === null) {
      try { preference = localStorage.getItem(KEY) === "off" ? "off" : "on"; } catch (_) { preference = "on"; }
      applyMotion();
    }
  });
  if (typeof document$ !== "undefined" && document$ && typeof document$.subscribe === "function") document$.subscribe(setup);
  else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup, { once: true });
  else setup();
})();
