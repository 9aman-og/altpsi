(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var transition = document.querySelector(".page-transition");
  var header = document.querySelector("[data-header]");
  var dynamic = document.querySelector("[data-words]");
  var review = document.querySelector("[data-review-plan]");
  var tilt = document.querySelector("[data-tilt]");

  if (transition && !reduceMotion) {
    transition.classList.add("entering");
    transition.addEventListener("animationend", function () {
      transition.classList.remove("entering");
    }, { once: true });
  }

  document.querySelectorAll("a[href]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      var href = link.getAttribute("href") || "";
      if (reduceMotion || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || link.target === "_blank" || href.startsWith("#") || href.startsWith("mailto:")) return;
      var url = new URL(link.href, location.href);
      if (url.origin !== location.origin || !transition) return;
      event.preventDefault();
      transition.classList.add("leaving");
      window.setTimeout(function () { location.href = url.href; }, 430);
    });
  });

  window.addEventListener("scroll", function () {
    if (header) header.classList.toggle("scrolled", window.scrollY > 18);
  }, { passive: true });

  var reveals = Array.from(document.querySelectorAll(".reveal"));
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach(function (node) { node.classList.add("is-visible"); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: "0px 0px -5%" });
    reveals.forEach(function (node, index) {
      node.style.transitionDelay = Math.min(index % 4, 3) * 70 + "ms";
      observer.observe(node);
    });
  }

  if (dynamic && !reduceMotion) {
    var words = (dynamic.dataset.words || "").split(",").map(function (word) { return word.trim(); }).filter(Boolean);
    var wordIndex = 0;
    if (words.length > 1) window.setInterval(function () {
      dynamic.classList.add("changing");
      window.setTimeout(function () {
        wordIndex = (wordIndex + 1) % words.length;
        dynamic.textContent = words[wordIndex];
        dynamic.classList.remove("changing");
      }, 180);
    }, 2600);
  }

  if (review) review.addEventListener("click", function () {
    var details = document.getElementById("plan-details");
    var expanded = review.getAttribute("aria-expanded") === "true";
    review.setAttribute("aria-expanded", String(!expanded));
    details.hidden = expanded;
    review.textContent = expanded ? "Review plan" : "Close review";
  });

  if (tilt && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    tilt.addEventListener("pointermove", function (event) {
      var rect = tilt.getBoundingClientRect();
      var x = (event.clientX - rect.left) / rect.width - .5;
      var y = (event.clientY - rect.top) / rect.height - .5;
      tilt.style.transform = "perspective(1200px) rotateX(" + (-y * 2.2) + "deg) rotateY(" + (x * 2.2) + "deg)";
    });
    tilt.addEventListener("pointerleave", function () { tilt.style.transform = ""; });
  }

  document.querySelectorAll("[data-year]").forEach(function (node) {
    node.textContent = String(new Date().getFullYear());
  });
})();
