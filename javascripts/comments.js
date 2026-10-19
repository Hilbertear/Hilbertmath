(function () {
  "use strict";

  if (window.__hmCommentsBootstrapped) return;
  window.__hmCommentsBootstrapped = true;

  var GISCUS_ORIGIN = "https://giscus.app";
  var GISCUS_SCRIPT = GISCUS_ORIGIN + "/client.js";
  var pageCleanup = function () {};

  function currentTheme() {
    var stored = typeof __md_get === "function" ? __md_get("__palette") : null;
    var scheme = stored && stored.color ? stored.color.scheme : null;
    if (!scheme) {
      scheme = document.body.getAttribute("data-md-color-scheme");
    }
    return scheme === "slate" ? "transparent_dark" : "light";
  }

  function setState(root, state, message) {
    root.dataset.state = state;
    root.setAttribute("aria-busy", state === "loading" ? "true" : "false");
    var text = root.querySelector("[data-giscus-status-text]");
    if (text && message) text.textContent = message;
  }

  function updateTheme() {
    var frame = document.querySelector(".hm-comments .giscus-frame");
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage(
      { giscus: { setConfig: { theme: currentTheme() } } },
      GISCUS_ORIGIN
    );
  }

  function setupComments(root) {
    if (!root || root.dataset.initialized === "true") return function () {};
    root.dataset.initialized = "true";

    var mount = root.querySelector("[data-giscus-mount]");
    var loadButton = root.querySelector("[data-giscus-load]");
    var retryButton = root.querySelector("[data-giscus-retry]");
    var fallback = root.querySelector("[data-giscus-fallback]");
    var observer = null;
    var frameObserver = null;
    var timeoutId = null;
    var started = false;
    var manageFocus = false;

    function clearWatchers() {
      if (frameObserver) frameObserver.disconnect();
      frameObserver = null;
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = null;
    }

    function showReady() {
      clearWatchers();
      if (fallback) fallback.hidden = true;
      setState(root, "ready");
      if (manageFocus) {
        mount.tabIndex = -1;
        mount.focus({ preventScroll: true });
        manageFocus = false;
      }
      window.setTimeout(updateTheme, 0);
    }

    function showError(message) {
      clearWatchers();
      setState(root, "error");
      if (fallback) fallback.hidden = false;
      var fallbackText = root.querySelector("[data-giscus-error-text]");
      if (fallbackText) {
        fallbackText.textContent = message || "评论暂时无法加载。";
      }
      if (loadButton) loadButton.disabled = false;
      if (manageFocus && fallback) {
        fallback.focus({ preventScroll: true });
        manageFocus = false;
      }
    }

    function watchForFrame() {
      function inspect() {
        var frame = root.querySelector(".giscus-frame");
        if (!frame) return false;
        if (frameObserver) frameObserver.disconnect();
        frameObserver = null;
        window.setTimeout(updateTheme, 0);
        return true;
      }

      if (inspect()) return;
      frameObserver = new MutationObserver(inspect);
      frameObserver.observe(mount, { childList: true, subtree: true });
    }

    function loadComments(requestFocus) {
      if (started) return;
      started = true;
      manageFocus = Boolean(requestFocus);
      if (observer) observer.disconnect();
      if (fallback) fallback.hidden = true;
      if (loadButton) loadButton.disabled = true;
      setState(root, "loading", "正在连接 GitHub Discussions……");
      if (manageFocus) {
        var statusCopy = root.querySelector("[data-giscus-status-copy]");
        if (statusCopy) statusCopy.focus({ preventScroll: true });
      }

      var script = document.createElement("script");
      script.src = GISCUS_SCRIPT;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.setAttribute("data-repo", root.dataset.repo);
      script.setAttribute("data-repo-id", root.dataset.repoId);
      script.setAttribute("data-category", root.dataset.category);
      script.setAttribute("data-category-id", root.dataset.categoryId);
      script.setAttribute("data-mapping", root.dataset.mapping);
      script.setAttribute("data-term", root.dataset.term);
      script.setAttribute("data-strict", "1");
      script.setAttribute("data-reactions-enabled", "1");
      script.setAttribute("data-emit-metadata", "1");
      script.setAttribute("data-input-position", "top");
      script.setAttribute("data-theme", currentTheme());
      script.setAttribute("data-lang", "zh-CN");
      script.setAttribute("data-loading", "lazy");
      script.addEventListener("load", watchForFrame, { once: true });
      script.addEventListener(
        "error",
        function () {
          showError("评论服务连接失败，你可以重试或前往 GitHub 留言。");
        },
        { once: true }
      );
      mount.appendChild(script);

      timeoutId = window.setTimeout(function () {
        if (root.dataset.state !== "ready") {
          showError("评论加载超时，你可以重试或前往 GitHub 留言。");
        }
      }, 15000);
    }

    function retryComments(requestFocus) {
      clearWatchers();
      mount.replaceChildren();
      started = false;
      loadComments(requestFocus);
    }

    function handleLoadClick() {
      loadComments(true);
    }

    function handleRetryClick() {
      retryComments(true);
    }

    function handleReadyEvent() {
      showReady();
    }

    function handleErrorEvent(event) {
      showError(event.detail && event.detail.message);
    }

    if (loadButton) loadButton.addEventListener("click", handleLoadClick);
    if (retryButton) retryButton.addEventListener("click", handleRetryClick);
    root.addEventListener("hm:giscus-ready", handleReadyEvent);
    root.addEventListener("hm:giscus-error", handleErrorEvent);

    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        function (entries) {
          if (entries.some(function (entry) { return entry.isIntersecting; })) {
            loadComments(false);
          }
        },
        { rootMargin: "500px 0px" }
      );
      observer.observe(root);
    } else {
      loadComments(false);
    }

    return function () {
      if (observer) observer.disconnect();
      clearWatchers();
      if (loadButton) loadButton.removeEventListener("click", handleLoadClick);
      if (retryButton) retryButton.removeEventListener("click", handleRetryClick);
      root.removeEventListener("hm:giscus-ready", handleReadyEvent);
      root.removeEventListener("hm:giscus-error", handleErrorEvent);
    };
  }

  function initializePageComments() {
    pageCleanup();
    pageCleanup = setupComments(document.querySelector("[data-giscus-root]"));
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== GISCUS_ORIGIN || !event.data || !event.data.giscus) {
      return;
    }

    var root = document.querySelector("[data-giscus-root]");
    var frame = root && root.querySelector(".giscus-frame");
    if (!root || !frame || event.source !== frame.contentWindow) return;

    var payload = event.data.giscus;
    if (payload.discussion && payload.discussion.url) {
      var direct = root.querySelector("[data-giscus-direct]");
      if (direct) direct.href = payload.discussion.url;
    }

    if (payload.error) {
      var missingDiscussion =
        String(payload.error).indexOf("Discussion not found") !== -1;
      if (missingDiscussion && root.dataset.mapping === "specific") {
        root.dispatchEvent(new Event("hm:giscus-ready"));
      } else {
        root.dispatchEvent(
          new CustomEvent("hm:giscus-error", {
            detail: { message: "评论服务返回异常，你可以重试或前往 GitHub 留言。" },
          })
        );
      }
    } else if (root.dataset.state !== "error") {
      root.dispatchEvent(new Event("hm:giscus-ready"));
    }
  });

  document.addEventListener("change", function (event) {
    if (
      event.target instanceof Element &&
      event.target.closest("[data-md-component=palette]")
    ) {
      window.setTimeout(updateTheme, 0);
    }
  });

  if (typeof document$ !== "undefined") {
    document$.subscribe(initializePageComments);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializePageComments, { once: true });
  } else {
    initializePageComments();
  }
})();
