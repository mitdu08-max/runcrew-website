/* RunCrew — comportements progressifs (le site reste lisible sans JS). */
(function () {
  "use strict";
  var doc = document;
  doc.documentElement.classList.add("js");

  /* ---- Header: état scrollé + menu mobile ---- */
  var header = doc.querySelector(".site-header");
  var toggle = doc.querySelector(".nav-toggle");
  function onScroll() {
    if (header) header.classList.toggle("scrolled", window.scrollY > 24);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (toggle && header) {
    toggle.addEventListener("click", function () {
      var open = header.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    });
    header.querySelectorAll(".nav-links a").forEach(function (a) {
      a.addEventListener("click", function () {
        header.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("open")) {
        header.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* ---- Apparition au défilement ---- */
  var reveals = doc.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---- Module « quatre regards » : onglets accessibles ---- */
  var tablist = doc.querySelector("[role=tablist]");
  if (tablist) {
    var tabs = Array.prototype.slice.call(tablist.querySelectorAll("[role=tab]"));
    var panels = tabs.map(function (t) { return doc.getElementById(t.getAttribute("aria-controls")); });
    var timer = null;

    function select(index, focus) {
      tabs.forEach(function (t, i) {
        var on = i === index;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        if (panels[i]) {
          panels[i].classList.toggle("active", on);
          panels[i].hidden = false; /* les panneaux restent dans le DOM (fondu CSS) */
          panels[i].setAttribute("aria-hidden", on ? "false" : "true");
        }
      });
      if (focus) tabs[index].focus();
    }

    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(i); stopAuto(); });
      t.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") n = (i + 1) % tabs.length;
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
        if (e.key === "Home") n = 0;
        if (e.key === "End") n = tabs.length - 1;
        if (n !== null) { e.preventDefault(); select(n, true); stopAuto(); }
      });
    });

    /* Défilement automatique discret tant que l'utilisateur n'a pas interagi */
    var current = 0;
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function stopAuto() { if (timer) { clearInterval(timer); timer = null; } }
    if (!reduced) {
      timer = setInterval(function () {
        current = (current + 1) % tabs.length;
        select(current);
      }, 5000);
      tablist.addEventListener("pointerenter", stopAuto, { once: true });
    }
    select(0);
  }

  /* ---- Formulaires liste d'attente (Formspree, sans rechargement) ---- */
  doc.querySelectorAll("form[data-waitlist]").forEach(function (form) {
    var status = form.parentElement.querySelector(".form-status");
    var btn = form.querySelector("button[type=submit]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var original = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Envoi…";
      if (status) { status.textContent = ""; status.className = "form-status"; }

      fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      }).then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        form.reset();
        if (status) {
          status.textContent = "C'est noté. Tu recevras un seul email : celui du lancement.";
          status.classList.add("ok");
        }
        btn.textContent = "Inscrit";
      }).catch(function () {
        if (status) {
          status.textContent = "Impossible d'envoyer pour le moment. Réessaie dans un instant ou écris à runcrew.app@gmail.com.";
          status.classList.add("error");
        }
        btn.disabled = false;
        btn.textContent = original;
      });
    });
  });
})();
