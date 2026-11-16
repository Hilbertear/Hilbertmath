(function () {
  "use strict";

  window.MathJax = {
    tex: {
      inlineMath: [["\\(", "\\)"]],
      displayMath: [["\\[", "\\]"]],
      processEscapes: true,
      processEnvironments: true,
    },
    options: {
      ignoreHtmlClass: ".*",
      processHtmlClass: "arithmatex",
    },
  };

  var source = "https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js";
  var loading = false;
  var loadAttempts = 0;

  function typesetPage() {
    if (!document.querySelector(".arithmatex")) return;

    if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
      window.MathJax.typesetPromise().catch(function (error) {
        console.warn("MathJax could not typeset this page.", error);
      });
      return;
    }

    if (loading || document.querySelector("script[data-hm-mathjax]")) return;
    loading = true;

    var script = document.createElement("script");
    script.src = source;
    script.async = true;
    script.dataset.hmMathjax = "true";
    loadAttempts += 1;
    script.addEventListener("load", function () {
      loading = false;
      loadAttempts = 0;
    });
    script.addEventListener("error", function () {
      loading = false;
      script.remove();
      if (loadAttempts < 2) {
        window.setTimeout(typesetPage, 1200);
      } else {
        console.warn("MathJax could not be loaded; formulas remain in source form.");
      }
    });
    document.head.appendChild(script);
  }

  if (typeof document$ !== "undefined") {
    document$.subscribe(typesetPage);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", typesetPage, { once: true });
  } else {
    typesetPage();
  }
})();
