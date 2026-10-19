(function () {
  "use strict";

  if (window.__hmReadingBootstrapped) return;
  window.__hmReadingBootstrapped = true;

  var SAVED_KEY = "hilbertmath:read-later:v1";
  var PREFERENCES_KEY = "hilbertmath:reading-preferences:v1";
  var cleanupPage = function () {};

  function readJSON(key, fallback) {
    try {
      var value = window.localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function savedIDs() {
    var value = readJSON(SAVED_KEY, []);
    if (!Array.isArray(value)) return new Set();
    return new Set(value.filter(function (id) {
      return typeof id === "string" && id.length > 0 && id.length <= 250;
    }).slice(0, 2000));
  }

  function preferences() {
    var value = readJSON(PREFERENCES_KEY, {});
    if (!value || typeof value !== "object") value = {};
    return {
      size: ["small", "default", "large"].indexOf(value.size) >= 0 ? value.size : "default",
      width: value.width === "wide" ? "wide" : "normal"
    };
  }

  function normalized(value) {
    return String(value || "").toLocaleLowerCase().replace(/\s+/g, " ").trim();
  }

  function setupPage() {
    cleanupPage();

    var disposed = false;
    var removers = [];
    var saved = savedIDs();
    var settings = preferences();
    var libraries = [];
    var frame = 0;
    var body = document.querySelector("[data-reading-body]");
    var progress = document.querySelector("[data-reading-progress]");
    var lastProgress = -1;
    var resizeObserver = null;

    function listen(target, event, handler, options) {
      target.addEventListener(event, handler, options);
      removers.push(function () { target.removeEventListener(event, handler, options); });
    }

    function announceSave(button, message) {
      var region = button.closest("[data-library], [data-reading-toolbar]");
      var status = region && region.querySelector("[data-library-status], [data-reading-status]");
      if (!status) {
        status = document.querySelector("[data-reading-status], [data-library-status]");
      }
      if (!status) {
        status = document.createElement("p");
        status.className = "hm-reader-status";
        status.setAttribute("data-reading-status", "");
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");
        (region || button.parentElement).appendChild(status);
      }
      status.textContent = message;
    }

    function updateSaveButtons() {
      document.querySelectorAll("[data-save-id]").forEach(function (button) {
        var active = saved.has(button.getAttribute("data-save-id"));
        button.hidden = false;
        button.setAttribute("aria-pressed", String(active));
        button.textContent = active ? "已加入稍后读" : "稍后读";
        button.title = active ? "从稍后读移除" : "加入稍后读，仅保存在本浏览器";
      });
    }

    function applyPreferences() {
      document.documentElement.setAttribute("data-reading-size", settings.size);
      document.documentElement.setAttribute("data-reading-width", settings.width);
      document.querySelectorAll("[data-reading-size]").forEach(function (button) {
        if (button === document.documentElement) return;
        button.setAttribute("aria-pressed", String(button.getAttribute("data-reading-size") === settings.size));
      });
      document.querySelectorAll("[data-reading-width]").forEach(function (button) {
        if (button === document.documentElement) return;
        button.setAttribute("aria-pressed", String(button.getAttribute("data-reading-width") === settings.width));
      });
      scheduleProgress();
    }

    function persistPreferences() {
      try {
        window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(settings));
      } catch (error) {
        // Reading controls remain usable for this page when storage is blocked.
      }
    }

    function updateProgress() {
      frame = 0;
      if (disposed || !body || !progress) return;
      var rectangle = body.getBoundingClientRect();
      var end = rectangle.bottom;
      var comments = body.querySelector(".hm-comments");
      if (comments) end = Math.min(end, comments.getBoundingClientRect().top);
      var height = Math.max(0, end - rectangle.top);
      var viewport = window.innerHeight || document.documentElement.clientHeight;
      var scrollable = height - viewport;
      var ratio = scrollable > 0 ? -rectangle.top / scrollable : (end <= viewport ? 1 : 0);
      var value = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
      if (value === lastProgress) return;
      lastProgress = value;
      if (progress.tagName === "PROGRESS") {
        progress.max = 100;
        progress.value = value;
      } else {
        progress.setAttribute("role", "progressbar");
        progress.setAttribute("aria-valuemin", "0");
        progress.setAttribute("aria-valuemax", "100");
        progress.style.setProperty("--reading-progress", value + "%");
      }
      progress.setAttribute("aria-valuenow", String(value));
      progress.setAttribute("aria-valuetext", "页面进度 " + value + "%");
    }

    function scheduleProgress() {
      if (!disposed && body && progress && !frame) {
        frame = window.requestAnimationFrame(updateProgress);
      }
    }

    function setupLibrary(library) {
      var controls = library.querySelector("[data-library-controls]");
      var query = library.querySelector("[data-library-query]");
      var year = library.querySelector("[data-library-year]");
      var topic = library.querySelector("[data-library-topic]");
      var count = library.querySelector("[data-library-count]");
      var empty = library.querySelector("[data-library-empty]");
      var savedToggle = library.querySelector("[data-library-saved]");
      var defaultScope = library.getAttribute("data-library-default-scope") || "all";
      var scope = defaultScope;
      var onlySaved = false;
      var entries = Array.from(library.querySelectorAll("[data-entry]")).map(function (entry) {
        var topics = [];
        try {
          topics = JSON.parse(entry.getAttribute("data-topics") || "[]");
        } catch (error) {
          topics = [];
        }
        return {
          element: entry,
          id: entry.getAttribute("data-id"),
          scope: entry.getAttribute("data-scope"),
          year: entry.getAttribute("data-year") || "",
          topics: Array.isArray(topics) ? topics : [],
          search: normalized(entry.getAttribute("data-search") || entry.textContent)
        };
      });

      function applyFilters() {
        var words = normalized(query && query.value).split(" ").filter(Boolean);
        var selectedYear = year ? year.value : "";
        var selectedTopic = topic ? topic.value : "";
        var shown = 0;
        entries.forEach(function (entry) {
          var matches = (scope === "all" || entry.scope === scope) &&
            (!selectedYear || selectedYear === "all" || entry.year === selectedYear) &&
            (!selectedTopic || selectedTopic === "all" || entry.topics.indexOf(selectedTopic) >= 0) &&
            (!onlySaved || saved.has(entry.id)) &&
            words.every(function (word) { return entry.search.indexOf(word) >= 0; });
          entry.element.hidden = !matches;
          if (matches) shown += 1;
        });
        if (count) count.textContent = "显示 " + shown + " / " + entries.length + " 项内容";
        if (empty) empty.hidden = shown > 0;
        library.querySelectorAll("[data-library-scope]").forEach(function (button) {
          button.setAttribute("aria-pressed", String(button.getAttribute("data-library-scope") === scope));
        });
        if (savedToggle) {
          savedToggle.setAttribute("aria-pressed", String(onlySaved));
          savedToggle.textContent = onlySaved ? "稍后读 · 已筛选" : "只看稍后读";
        }
      }

      function syncQueryURL() {
        if (!query) return;
        try {
          var url = new URL(window.location.href);
          if (query.value.trim()) url.searchParams.set("filter", query.value.trim());
          else url.searchParams.delete("filter");
          window.history.replaceState(window.history.state, "", url.href);
        } catch (error) {
          // Filtering still works on file previews and restricted history contexts.
        }
      }

      if (query) {
        try {
          query.value = new URL(window.location.href).searchParams.get("filter") || "";
        } catch (error) {
          query.value = "";
        }
        listen(query, "input", function () {
          applyFilters();
          syncQueryURL();
        });
      }
      if (year) listen(year, "change", applyFilters);
      if (topic) listen(topic, "change", applyFilters);
      listen(library, "click", function (event) {
        if (!(event.target instanceof Element)) return;
        var scopeButton = event.target.closest("[data-library-scope]");
        var savedButton = event.target.closest("[data-library-saved]");
        var resetButton = event.target.closest("[data-library-reset]");
        if (scopeButton) {
          var requestedScope = scopeButton.getAttribute("data-library-scope");
          if (["all", "math", "writing"].indexOf(requestedScope) < 0) return;
          scope = requestedScope;
          applyFilters();
        } else if (savedButton) {
          onlySaved = !onlySaved;
          applyFilters();
        } else if (resetButton) {
          if (query) query.value = "";
          if (year) year.selectedIndex = 0;
          if (topic) topic.selectedIndex = 0;
          scope = defaultScope;
          onlySaved = false;
          applyFilters();
          syncQueryURL();
          if (query) query.focus({ preventScroll: true });
        }
      });

      if (controls) controls.hidden = false;
      applyFilters();
      return { applyFilters: applyFilters };
    }

    document.querySelectorAll("[data-library]").forEach(function (library) {
      libraries.push(setupLibrary(library));
    });
    document.querySelectorAll("[data-reading-toolbar]").forEach(function (toolbar) {
      toolbar.hidden = false;
    });

    listen(document, "click", function (event) {
      if (!(event.target instanceof Element)) return;
      var saveButton = event.target.closest("[data-save-id]");
      if (saveButton) {
        var id = saveButton.getAttribute("data-save-id");
        if (!id) return;
        // Refresh before a write so another tab's recent saves are not overwritten.
        var next = savedIDs();
        var removing = next.has(id);
        if (removing) next.delete(id);
        else next.add(id);
        try {
          window.localStorage.setItem(SAVED_KEY, JSON.stringify(Array.from(next)));
        } catch (error) {
          announceSave(saveButton, "浏览器未允许本地存储，未能更改稍后读。可使用浏览器书签保存此文。");
          return;
        }
        saved = next;
        updateSaveButtons();
        announceSave(saveButton, removing ? "已从稍后读移除。" : "已加入稍后读，仅保存在本浏览器。");
        libraries.forEach(function (library) { library.applyFilters(); });
        if (saveButton.closest("[data-entry][hidden]")) {
          var currentLibrary = saveButton.closest("[data-library]");
          var fallback = currentLibrary && currentLibrary.querySelector("[data-library-saved]");
          if (fallback) fallback.focus({ preventScroll: true });
        }
        return;
      }
      var toolbar = event.target.closest("[data-reading-toolbar]");
      if (!toolbar) return;
      var sizeButton = event.target.closest("button[data-reading-size]");
      var widthButton = event.target.closest("button[data-reading-width]");
      if (sizeButton) {
        var size = sizeButton.getAttribute("data-reading-size");
        if (["small", "default", "large"].indexOf(size) < 0) return;
        settings.size = size;
      } else if (widthButton) {
        var width = widthButton.getAttribute("data-reading-width");
        if (["normal", "wide"].indexOf(width) < 0) return;
        settings.width = width;
      } else {
        return;
      }
      applyPreferences();
      persistPreferences();
    });

    listen(window, "storage", function (event) {
      if (event.key === SAVED_KEY || event.key === null) {
        saved = savedIDs();
        updateSaveButtons();
        libraries.forEach(function (library) { library.applyFilters(); });
      }
      if (event.key === PREFERENCES_KEY || event.key === null) {
        settings = preferences();
        applyPreferences();
      }
    });

    if (body && progress) {
      progress.hidden = false;
      if (!progress.getAttribute("aria-label")) progress.setAttribute("aria-label", "文章阅读进度");
      listen(window, "scroll", scheduleProgress, { passive: true });
      listen(window, "resize", scheduleProgress);
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(scheduleProgress);
        resizeObserver.observe(body);
      }
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { if (!disposed) scheduleProgress(); });
      }
    }

    updateSaveButtons();
    applyPreferences();

    cleanupPage = function () {
      disposed = true;
      removers.forEach(function (remove) { remove(); });
      if (frame) window.cancelAnimationFrame(frame);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }

  if (typeof document$ !== "undefined" && document$ && typeof document$.subscribe === "function") {
    document$.subscribe(setupPage);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupPage, { once: true });
  } else {
    setupPage();
  }
})();
