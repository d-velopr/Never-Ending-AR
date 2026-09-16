/* NEVER ENDING A&R — interactions: staggered reveal, count-up stats, track bars */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Hero staggered reveal on load ---- */
  window.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".reveal").forEach(function (el) {
      var d = parseInt(el.getAttribute("data-d") || "0", 10);
      setTimeout(function () { el.classList.add("in"); }, 120 + d * 130);
    });
  });

  /* ---- Number formatting ---- */
  function fmt(n) { return n.toLocaleString("en-US"); }

  function countUp(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    var prefix = el.getAttribute("data-prefix") || "";
    var suffix = el.getAttribute("data-suffix") || "";
    if (reduce || target === 0) { el.textContent = prefix + fmt(target) + suffix; return; }
    var dur = 1500, start = performance.now();
    function tick(now) {
      var p = Math.min((now - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + fmt(Math.round(target * eased)) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---- IntersectionObserver: reveal sections, fire counters + bars ---- */
  var groups = ".section-head,.card,.bigstat,.receipt,.member,.player,.case-story,.case-portrait,.gallery figure,.follow-media,.follow-btn";
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("in-view");
      io.unobserve(e.target);
    });
  }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(groups).forEach(function (el, i) {
    el.style.transitionDelay = (i % 4) * 70 + "ms";
    io.observe(el);
  });

  /* ---- Counters (hero + bigstats) ---- */
  var counterIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      countUp(e.target);
      counterIO.unobserve(e.target);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll("[data-count]").forEach(function (el) { counterIO.observe(el); });

  /* ---- Track bars fill when in view ---- */
  var list = document.getElementById("trackList");
  if (list) {
    var barIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        list.querySelectorAll("li").forEach(function (li) {
          var val = parseFloat(li.getAttribute("data-val"));
          var max = parseFloat(li.style.getPropertyValue("--max"));
          var bar = li.querySelector(".t-bar i");
          if (bar) bar.style.width = (val / max * 100) + "%";
        });
        barIO.disconnect();
      });
    }, { threshold: 0.3 });
    barIO.observe(list);
  }

  /* ---- Subtle nav background shift on scroll ---- */
  var nav = document.querySelector(".nav");
  if (nav) {
    window.addEventListener("scroll", function () {
      if (window.scrollY > 40) nav.style.background = "rgba(10,9,8,.82)";
      else nav.style.background = "rgba(10,9,8,.55)";
    }, { passive: true });
  }

  /* ---- Mobile menu (hamburger) ---- */
  var navToggle = document.getElementById("navToggle");
  var mobileMenu = document.getElementById("mobileMenu");
  if (navToggle && mobileMenu) {
    var setMenu = function (open) {
      navToggle.classList.toggle("open", open);
      mobileMenu.classList.toggle("open", open);
      document.body.classList.toggle("menu-open", open);
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      mobileMenu.setAttribute("aria-hidden", open ? "false" : "true");
    };
    navToggle.addEventListener("click", function () {
      setMenu(!mobileMenu.classList.contains("open"));
    });
    // close when a menu link/button is tapped
    mobileMenu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { setMenu(false); });
    });
    // close on Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mobileMenu.classList.contains("open")) setMenu(false);
    });
  }

  /* ---- YouTube facade: click thumbnail to load the player ---- */
  var ytFacade = document.getElementById("ytFacade");
  if (ytFacade) {
    ytFacade.addEventListener("click", function () {
      var id = ytFacade.getAttribute("data-id");
      var ifr = document.createElement("iframe");
      ifr.src = "https://www.youtube-nocookie.com/embed/" + id +
        "?autoplay=1&rel=0&playsinline=1";
      ifr.title = "YFEGUERO on YouTube";
      ifr.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      ifr.referrerPolicy = "strict-origin-when-cross-origin";
      ifr.setAttribute("frameborder", "0");
      ifr.allowFullscreen = true;
      var wrap = ytFacade.parentNode;       // .yt-embed
      wrap.replaceChild(ifr, ytFacade);
    });
  }

  /* ============================================================
     CONTACT FORM — runs only on contact.html
     Posts to a Google Apps Script web app that appends to a Sheet.
     ============================================================ */
  var form = document.getElementById("contactForm");
  if (form) initContactForm(form);

  function initContactForm(form) {
    // ---- Paste your Apps Script Web App /exec URL here after deploying Code.gs ----
    var FORM_ENDPOINT = "https://script.google.com/macros/s/AKfycbyofDFyE6zTBjJF3WUU-d20SkBL6wLTGWe2rfxYyC-Ps7LBp45yJlEv3zSyYt0Cn_Ln/exec";

    var MAX_BYTES = 25 * 1024 * 1024;          // 25 MB cap
    var ALLOWED_EXT = ["mp3", "wav", "m4a"];
    var LINK_ALLOW = [
      "soundcloud.com", "spotify.com", "music.apple.com", "apple.com",
      "youtube.com", "youtu.be", "drive.google.com", "dropbox.com",
      "wetransfer.com", "instagram.com", "tiktok.com", "x.com",
      "twitter.com", "audiomack.com", "bandcamp.com", "distrokid.com"
    ];

    var fileInput = document.getElementById("f-file");
    var dropzone = document.getElementById("dropzone");
    var dzText = document.getElementById("dz-text");
    var fileNote = document.getElementById("file-note");
    var linksInput = document.getElementById("f-links");
    var linksNote = document.getElementById("links-note");
    var statusEl = document.getElementById("formStatus");
    var submitBtn = document.getElementById("submitBtn");

    var selectedFile = null;

    function extOf(name) { return (name.split(".").pop() || "").toLowerCase(); }
    function prettySize(b) { return (b / 1048576).toFixed(1) + " MB"; }

    function setNote(el, msg, cls) {
      el.textContent = msg || "";
      el.className = "field-note" + (cls ? " " + cls : "");
    }

    // ---- File selection / validation ----
    function handleFile(file) {
      if (!file) { clearFile(); return; }
      var ext = extOf(file.name);
      var typeOk = file.type.indexOf("audio") === 0 || ALLOWED_EXT.indexOf(ext) !== -1;
      if (!typeOk) {
        clearFile();
        setNote(fileNote, "That's not an audio file — use mp3, wav, or m4a.", "bad");
        return;
      }
      if (file.size > MAX_BYTES) {
        clearFile();
        setNote(fileNote, "File is " + prettySize(file.size) + " — over the 25 MB cap. Paste a Drive/SoundCloud link in the Links field instead.", "warn");
        if (linksInput) linksInput.focus();
        return;
      }
      selectedFile = file;
      dropzone.classList.add("has-file");
      dzText.innerHTML = "✓ " + escapeHtml(file.name) + " <u>change</u>";
      setNote(fileNote, prettySize(file.size) + " · scanned by Google Drive before it's shared.", "");
    }

    function clearFile() {
      selectedFile = null;
      if (fileInput) fileInput.value = "";
      dropzone.classList.remove("has-file");
      dzText.innerHTML = "Drop a track or <u>browse</u>";
    }

    fileInput.addEventListener("change", function () { handleFile(fileInput.files[0]); });

    // drag & drop
    ["dragenter", "dragover"].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.add("drag"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.remove("drag"); });
    });
    dropzone.addEventListener("drop", function (e) {
      var f = e.dataTransfer && e.dataTransfer.files[0];
      if (f) { try { fileInput.files = e.dataTransfer.files; } catch (_) {} handleFile(f); }
    });

    // ---- Link allowlist check ----
    function badLinks(value) {
      var urls = (value || "").match(/https?:\/\/[^\s,]+/gi) || [];
      var bad = [];
      urls.forEach(function (u) {
        var host;
        try { host = new URL(u).hostname.toLowerCase().replace(/^www\./, ""); }
        catch (_) { bad.push(u); return; }
        var ok = LINK_ALLOW.some(function (d) { return host === d || host.endsWith("." + d); });
        if (!ok) bad.push(host);
      });
      return bad;
    }

    if (linksInput) {
      linksInput.addEventListener("blur", function () {
        var bad = badLinks(linksInput.value);
        if (bad.length) setNote(linksNote, "Unrecognized link host: " + bad.join(", ") + ". Use Spotify, SoundCloud, YouTube, Drive, Dropbox, WeTransfer, etc.", "warn");
        else setNote(linksNote, "", "");
      });
    }

    // ---- Helpers ----
    function escapeHtml(s) { return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

    function markInvalid(el, bad) { el.classList[bad ? "add" : "remove"]("invalid"); }

    function readBase64(file) {
      return new Promise(function (resolve, reject) {
        var r = new FileReader();
        r.onload = function () { resolve(String(r.result).split(",")[1] || ""); };
        r.onerror = reject;
        r.readAsDataURL(file);
      });
    }

    function setStatus(msg, cls) {
      statusEl.textContent = msg || "";
      statusEl.className = "form-status" + (cls ? " " + cls : "");
    }

    // ---- Submit ----
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setStatus("", "");

      // honeypot
      if (form.company && form.company.value) return;

      var name = form.name.value.trim();
      var artist = form.artist.value.trim();
      var email = form.email.value.trim();
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      markInvalid(form.name, !name);
      markInvalid(form.artist, !artist);
      markInvalid(form.email, !emailOk);
      if (!name || !artist || !emailOk) {
        setStatus("Fill in your name, artist name, and a valid email.", "err");
        return;
      }

      var bad = badLinks(linksInput ? linksInput.value : "");
      if (bad.length) {
        markInvalid(linksInput, true);
        setStatus("Remove or fix the unrecognized link before sending.", "err");
        return;
      }
      markInvalid(linksInput, false);

      if (FORM_ENDPOINT.indexOf("PASTE_YOUR") === 0) {
        setStatus("Form isn't connected yet — endpoint not configured.", "err");
        return;
      }

      submitBtn.setAttribute("disabled", "true");
      setStatus("Sending…", "");

      var payload = {
        name: name, artist: artist, email: email,
        links: linksInput ? linksInput.value.trim() : "",
        message: form.message.value.trim(),
        fileName: "", fileMime: "", fileData: ""
      };

      var prep = selectedFile
        ? readBase64(selectedFile).then(function (b64) {
            payload.fileName = selectedFile.name;
            payload.fileMime = selectedFile.type || "audio/mpeg";
            payload.fileData = b64;
          })
        : Promise.resolve();

      prep.then(function () {
        return fetch(FORM_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload)
        });
      }).then(function (res) {
        return res.json().catch(function () { return { ok: res.ok }; });
      }).then(function (data) {
        if (data && data.ok) {
          form.reset(); clearFile();
          setStatus("Got it — your music's in. I'll be in touch.", "ok");
          submitBtn.textContent = "Sent ✓";
        } else {
          throw new Error((data && data.error) || "rejected");
        }
      }).catch(function () {
        submitBtn.removeAttribute("disabled");
        setStatus("Something went wrong sending that. Try again, or email contact@neverending-ar.com.", "err");
      });
    });
  }
})();
