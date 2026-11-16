(function () {
  "use strict";

  if (window.__hmReadingDelightBootstrapped) return;
  window.__hmReadingDelightBootstrapped = true;

  var cleanupPage = function () {};

  function setupPage() {
    cleanupPage();

    var root = document.documentElement;
    var body = document.querySelector("[data-reading-body]");
    var toolbar = document.querySelector("[data-reading-toolbar]");
    if (!body || !toolbar) return;

    var disposed = false;
    var focused = false;
    var removers = [];
    var imageButtons = [];
    var dialog = null;
    var zoomImage = null;
    var caption = null;
    var opener = null;
    var status = toolbar.querySelector("[data-reading-status]");
    var focusStatus = "";

    function listen(target, event, handler, options) {
      target.addEventListener(event, handler, options);
      removers.push(function () { target.removeEventListener(event, handler, options); });
    }

    var focusButton = document.createElement("button");
    focusButton.type = "button";
    focusButton.className = "hm-focus-toggle";
    focusButton.setAttribute("data-reading-focus-toggle", "");
    focusButton.setAttribute("aria-pressed", "false");
    focusButton.textContent = "专注阅读";
    focusButton.title = "收起侧栏，专注当前文章；按 Esc 退出";
    toolbar.insertBefore(focusButton, toolbar.querySelector("[data-reading-status]"));

    var exitButton = document.createElement("button");
    exitButton.type = "button";
    exitButton.className = "hm-focus-exit";
    exitButton.setAttribute("data-reading-focus-exit", "");
    exitButton.setAttribute("aria-label", "退出专注阅读，也可按 Esc 键");
    exitButton.textContent = "退出专注 · Esc";
    exitButton.hidden = true;
    document.body.appendChild(exitButton);

    function setFocus(active, announce) {
      if (disposed || focused === active) return;
      var current = document.activeElement;
      // Move focus before hiding a sidebar or the floating exit control.
      if ((!active && current === exitButton) ||
          (active && current instanceof Element && current.closest(".md-sidebar"))) {
        focusButton.focus({ preventScroll: true });
      }
      focused = active;
      if (active) root.setAttribute("data-reading-focus", "true");
      else root.removeAttribute("data-reading-focus");
      exitButton.hidden = !active;
      focusButton.setAttribute("aria-pressed", String(active));
      if (announce && status) {
        focusStatus = active ? "已进入专注阅读。按 Esc 或点击退出按钮返回。" : "已退出专注阅读。";
        status.textContent = focusStatus;
      }
    }

    listen(focusButton, "click", function () { setFocus(!focused, true); });
    listen(exitButton, "click", function () { setFocus(false, true); });
    listen(document, "keydown", function (event) {
      if (event.key !== "Escape" || event.defaultPrevented || !focused) return;
      // Let the browser close the top-layer image first, without leaving focus mode.
      if (dialog && dialog.open) return;
      if (document.querySelector("dialog[open]")) return;
      // Material's search and mobile navigation own Escape while open.
      if (document.querySelector("#__search:checked, #__drawer:checked")) return;
      event.preventDefault();
      setFocus(false, true);
    });

    function createDialog() {
      dialog = document.createElement("dialog");
      dialog.className = "hm-image-dialog";
      dialog.setAttribute("aria-label", "文章图片预览");
      dialog.setAttribute("data-reading-image-dialog", "");

      var close = document.createElement("button");
      close.type = "button";
      close.className = "hm-image-dialog__close";
      close.textContent = "关闭 · Esc";
      close.setAttribute("aria-label", "关闭图片预览");
      close.setAttribute("autofocus", "");
      dialog.appendChild(close);

      var figure = document.createElement("figure");
      zoomImage = document.createElement("img");
      zoomImage.className = "hm-image-dialog__image";
      caption = document.createElement("figcaption");
      caption.className = "hm-image-dialog__caption";
      figure.appendChild(zoomImage);
      figure.appendChild(caption);
      dialog.appendChild(figure);
      document.body.appendChild(dialog);

      listen(close, "click", function () { dialog.close(); });
      listen(dialog, "click", function (event) {
        if (event.target !== dialog) return;
        var bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
      });
      listen(dialog, "close", function () {
        root.removeAttribute("data-reading-image-open");
        var previous = opener;
        opener = null;
        if (!disposed && previous && previous.isConnected) {
          previous.focus({ preventScroll: true });
        }
      });
    }

    var supportsDialog = typeof HTMLDialogElement !== "undefined" &&
      typeof HTMLDialogElement.prototype.showModal === "function";

    if (supportsDialog) {
      body.querySelectorAll("img").forEach(function (image) {
        if (image.closest("a, button, .hm-comments, .giscus, .md-icon, .twemoji, .emojione, .arithmatex")) return;
        if (image.getAttribute("role") === "presentation" || image.getAttribute("aria-hidden") === "true") return;
        if ((image.width && image.width < 80) || (image.height && image.height < 40)) return;
        if (!image.getAttribute("src") && !image.currentSrc) return;

        var figure = image.closest("figure");
        var figureCaption = figure && figure.querySelector("figcaption");
        var description = ((figureCaption && figureCaption.textContent) || image.alt || "文章图片").trim();
        var button = document.createElement("button");
        button.type = "button";
        button.className = "hm-image-zoom";
        button.setAttribute("aria-label", "放大查看：" + description);
        button.setAttribute("aria-haspopup", "dialog");
        button.title = "放大查看";
        image.parentNode.insertBefore(button, image);
        button.appendChild(image);
        imageButtons.push({ button: button, image: image });

        listen(button, "click", function () {
          if (!dialog) createDialog();
          opener = button;
          zoomImage.src = image.currentSrc || image.src;
          zoomImage.alt = image.alt || description;
          caption.textContent = description;
          try {
            dialog.showModal();
            root.setAttribute("data-reading-image-open", "true");
          } catch (error) {
            opener = null;
            // If this environment rejects modals, fall back to the original image.
            if (button.parentNode) {
              button.parentNode.insertBefore(image, button);
              button.remove();
            }
          }
        });
      });
    }

    cleanupPage = function () {
      disposed = true;
      removers.forEach(function (remove) { remove(); });
      root.removeAttribute("data-reading-focus");
      root.removeAttribute("data-reading-image-open");
      if (status && focusStatus && status.textContent === focusStatus) status.textContent = "";
      if (dialog) {
        if (dialog.open) dialog.close();
        dialog.remove();
      }
      imageButtons.forEach(function (entry) {
        if (entry.button.parentNode) {
          entry.button.parentNode.insertBefore(entry.image, entry.button);
          entry.button.remove();
        }
      });
      focusButton.remove();
      exitButton.remove();
      cleanupPage = function () {};
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
