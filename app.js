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
  var groups = ".section-head,.card,.receipt,.member,.player,.case-portrait,.follow-media,.follow-btn";
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

  /* ---- Counters (hero) ---- */
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

  /* ---- Catalog growth chart ------------------------------------------
     Modelled on the muso.ai "Graph - Streams" screen: stacked areas from
     zero, a bright line on each layer's top edge, alternating year bands
     and a gridded y-axis in round steps. Because it is an area chart the
     y-axis must start at zero, and with three years of history the
     movement now reads clearly at that scale.

     Two sources are joined on the date axis:
       data/baseline.json - monthly points read off the muso screenshot,
                            with the per-layer breakdown (approximate)
       data/stats.json    - the weekly sheet log, lifetime total only
     Weekly points after the baseline extend the top line alone; the
     breakdown is not invented for weeks muso has not been read for.
     Exact values live in the hover tooltip rather than in on-page text.
     Hand-rolled SVG because the site ships no charting library. -------- */
  var chartHost = document.querySelector('[data-chart="growth"]');
  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  /* Layer key (muso's colour) -> platform. Glyphs are Simple Icons paths,
     drawn as small badges like the ones on muso's Streams card. */
  var PLATFORMS = {
    green: {
      name: "Spotify",
      icon: '<path fill="#1db954" d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>'
    },
    red: {
      name: "YouTube",
      icon: '<path fill="#fff" d="M9.545 15.568V8.432L15.818 12z"/>' +
        '<path fill="#ff0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>'
    },
    orange: {
      name: "SoundCloud",
      icon: '<circle cx="12" cy="12" r="12" fill="#ff5500"/>' +
        '<path fill="#fff" transform="translate(4.2 4.2) scale(.65)" d="M23.999 14.165c-.052 1.796-1.612 3.169-3.4 3.169h-8.18a.68.68 0 0 1-.675-.683V7.862a.747.747 0 0 1 .452-.724s.75-.513 2.333-.513a5.364 5.364 0 0 1 2.763.755 5.433 5.433 0 0 1 2.57 3.54c.282-.08.574-.121.868-.12.884 0 1.73.358 2.347.992s.948 1.49.922 2.373ZM10.721 8.421c.247 2.98.427 5.697 0 8.672a.264.264 0 0 1-.53 0c-.395-2.946-.22-5.718 0-8.672a.264.264 0 0 1 .53 0ZM9.072 9.448c.285 2.659.37 4.986-.006 7.655a.277.277 0 0 1-.55 0c-.331-2.63-.256-5.02 0-7.655a.277.277 0 0 1 .556 0Zm-1.663-.257c.27 2.726.39 5.171 0 7.904a.266.266 0 0 1-.532 0c-.38-2.69-.257-5.21 0-7.904a.266.266 0 0 1 .532 0Zm-1.647.77a26.108 26.108 0 0 1-.008 7.147.272.272 0 0 1-.542 0 27.955 27.955 0 0 1 0-7.147.275.275 0 0 1 .55 0Zm-1.67 1.769c.421 1.865.228 3.5-.029 5.388a.257.257 0 0 1-.514 0c-.21-1.858-.398-3.549 0-5.389a.272.272 0 0 1 .543 0Zm-1.655-.273c.388 1.897.26 3.508-.01 5.412-.026.28-.514.283-.54 0-.244-1.878-.347-3.54-.01-5.412a.283.283 0 0 1 .56 0Zm-1.668.911c.4 1.268.257 2.292-.026 3.572a.257.257 0 0 1-.514 0c-.241-1.262-.354-2.312-.023-3.572a.283.283 0 0 1 .563 0Z"/>'
    }
  };

  function platformIcon(key) {
    var p = PLATFORMS[key];
    return p ? '<svg class="pf-icon" viewBox="0 0 24 24" aria-hidden="true">' + p.icon + '</svg>' : '';
  }

  /* per-platform values for one point, top layer first (Spotify, YouTube,
     SoundCloud) to match the order they stack on screen. The top layer is
     whatever the lower layers leave of the total. */
  function breakdown(d, layers) {
    if (!d.parts) return null;
    var lower = 0, rows = [];
    for (var i = 0; i < layers.length; i++) {
      var v = i === layers.length - 1 ? d.lifetime - lower : d.parts[i];
      lower += v;
      rows.unshift({ key: layers[i], value: v });
    }
    return rows;
  }

  function fmtShort(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
    if (n >= 1e3) return Math.round(n / 1e3) + "K";
    return String(Math.round(n));
  }

  function longDate(iso) {
    var p = String(iso).split("-");
    if (p.length < 3) return iso;
    return MON[parseInt(p[1], 10) - 1] + " " + parseInt(p[2], 10) + ", " + p[0];
  }

  function ts(iso) {
    var p = String(iso).split("-");
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }

  function svgEl(name, attrs) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    return e;
  }

  /* baseline first, then any weekly row dated after it. A weekly row on
     the same date as a baseline point wins on the total and keeps the
     baseline's breakdown. */
  function mergeSeries(base, stats) {
    var pts = ((base && base.points) || []).map(function (d) {
      return { date: d.date, t: ts(d.date), lifetime: d.lifetime, parts: d.parts || null };
    });
    var lastT = pts.length ? pts[pts.length - 1].t : -Infinity;
    ((stats && stats.history) || []).forEach(function (d) {
      var t = ts(d.date);
      if (t > lastT) pts.push({ date: d.date, t: t, lifetime: d.lifetime, parts: null });
      else pts.forEach(function (p) { if (p.t === t) p.lifetime = d.lifetime; });
    });
    pts.sort(function (a, b) { return a.t - b.t; });
    return pts;
  }

  /* round step from 1 / 1.5 / 2 / 2.5 / 5 x 10^k, about five intervals */
  function niceStep(max) {
    var raw = max / 5, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var steps = [1, 1.5, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * mag >= raw) return steps[i] * mag;
    return 10 * mag;
  }

  function drawGrowth(host, pts, layers) {
    if (pts.length < 2) {
      var seed = pts[0] || { lifetime: 0, date: "" };
      host.innerHTML =
        '<div class="chart-empty">' +
        '<span class="ce-num">' + fmt(seed.lifetime) + '</span>' +
        '<span class="ce-label">lifetime streams' + (seed.date ? ' · ' + longDate(seed.date) : '') + '</span>' +
        '</div>';
      return;
    }

    /* The viewBox is built to the host's real pixel width so one unit is
       one CSS pixel; scaling a fixed box down to a phone shrank the labels
       to unreadable sizes. */
    var W = Math.max(280, Math.round(host.clientWidth || 760));
    var narrow = W < 460;
    var H = narrow ? 300 : 380;
    var padL = narrow ? 40 : 52, padR = 6, padT = 10, padB = 28;
    var plotW = W - padL - padR, plotH = H - padT - padB;

    var maxV = pts[pts.length - 1].lifetime;
    pts.forEach(function (d) { if (d.lifetime > maxV) maxV = d.lifetime; });
    var step = niceStep(maxV), yTop = Math.ceil(maxV / step) * step;
    if (yTop - maxV < step * 0.25) yTop += step; // headroom like muso's
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t;

    var x = function (t) { return padL + ((t - t0) / (t1 - t0)) * plotW; };
    var y = function (v) { return padT + plotH - (v / yTop) * plotH; };
    var base = padT + plotH;

    var svg = svgEl("svg", {
      viewBox: "0 0 " + W + " " + H,
      class: "growth-svg",
      role: "img",
      "aria-label": "Lifetime streams over time, from " + fmt(pts[0].lifetime) +
        " in " + longDate(pts[0].date) + " to " + fmt(pts[pts.length - 1].lifetime) +
        " on " + longDate(pts[pts.length - 1].date)
    });

    /* --- alternating year bands + year labels --- */
    var y0 = new Date(t0).getUTCFullYear(), y1 = new Date(t1).getUTCFullYear();
    for (var yr = y0; yr <= y1; yr++) {
      var a = Math.max(t0, Date.UTC(yr, 0, 1)), b = Math.min(t1, Date.UTC(yr + 1, 0, 1));
      if (yr % 2 === 0)
        svg.appendChild(svgEl("rect", { x: x(a), y: padT, width: x(b) - x(a), height: plotH, class: "g-band" }));
      var lx = x(a);
      /* the partial first year is labelled at the left edge, the rest at Jan 1;
         skip any label that would collide with the one before it */
      if (yr > y0 && lx - x(Math.max(t0, Date.UTC(yr - 1, 0, 1))) < 40) continue;
      if (yr === y0 || lx < padL + plotW - 20) {
        var yl = svgEl("text", { x: lx, y: H - 8, class: "g-xlabel", "text-anchor": yr === y0 ? "start" : "middle" });
        yl.textContent = yr;
        svg.appendChild(yl);
      }
    }

    /* --- gridlines + y labels --- */
    for (var v = 0; v <= yTop + 1; v += step) {
      var gy = y(v);
      if (v > 0) svg.appendChild(svgEl("line", { x1: padL, y1: gy, x2: padL + plotW, y2: gy, class: "g-grid" }));
      var lbl = svgEl("text", { x: padL - 8, y: gy + 4, class: "g-ylabel" });
      lbl.textContent = fmtShort(v);
      svg.appendChild(lbl);
    }

    /* --- stacked layers, bottom to top ---
       tops[i] is the running total through layer i. The top layer spans
       every point (its top edge IS the lifetime total); lower layers only
       span points that carry a breakdown. */
    var nL = layers.length;
    function top(d, i) {
      if (i === nL - 1) return d.lifetime;
      var s = 0;
      for (var k = 0; k <= i; k++) s += d.parts[k];
      return s;
    }
    function floorOf(d, i) { return i === 0 || !d.parts ? 0 : top(d, i - 1); }

    for (var i = 0; i < nL; i++) {
      var span = i === nL - 1 ? pts : pts.filter(function (d) { return d.parts; });
      if (span.length < 2) continue;
      var upper = span.map(function (d) { return x(d.t).toFixed(1) + "," + y(top(d, i)).toFixed(1); });
      var lower = span.slice().reverse().map(function (d) { return x(d.t).toFixed(1) + "," + y(floorOf(d, i)).toFixed(1); });
      svg.appendChild(svgEl("polygon", { points: upper.concat(lower).join(" "), class: "g-area g-" + layers[i] }));
      svg.appendChild(svgEl("polyline", { points: upper.join(" "), class: "g-line g-" + layers[i] }));
    }
    svg.appendChild(svgEl("line", { x1: padL, y1: base, x2: padL + plotW, y2: base, class: "g-axis" }));

    /* --- hover layer: crosshair + tooltip --- */
    var cross = svgEl("line", { x1: 0, y1: padT, x2: 0, y2: base, class: "g-cross" });
    var dot = svgEl("circle", { r: 4.5, class: "g-dot-hover" });
    svg.appendChild(cross); svg.appendChild(dot);

    var tip = document.createElement("div");
    tip.className = "g-tip";
    host.innerHTML = "";
    host.appendChild(svg);
    host.appendChild(tip);

    function hide() { host.classList.remove("hovering"); }
    function show(i) {
      var d = pts[i], px = x(d.t);
      host.classList.add("hovering");
      cross.setAttribute("x1", px); cross.setAttribute("x2", px);
      dot.setAttribute("cx", px); dot.setAttribute("cy", y(d.lifetime));
      var rows = breakdown(d, layers);
      tip.innerHTML = '<strong>' + fmt(d.lifetime) + '</strong><span>' + longDate(d.date) + '</span>' +
        (rows ? '<ul class="g-tip-rows">' + rows.map(function (r) {
          return '<li>' + platformIcon(r.key) + '<em>' + PLATFORMS[r.key].name + '</em><b>' + fmtShort(r.value) + '</b></li>';
        }).join("") + '</ul>' : '');
      var box = host.getBoundingClientRect();
      var sx = (px / W) * box.width;
      var half = tip.offsetWidth / 2 + 4;
      tip.style.left = Math.max(half, Math.min(box.width - half, sx)) + "px";
      tip.style.top = ((y(d.lifetime) / H) * box.height) + "px";
    }
    function nearest(ev) {
      var box = svg.getBoundingClientRect();
      var rel = ((ev.clientX - box.left) / box.width) * W;
      var best = 0, bd = Infinity;
      for (var k = 0; k < pts.length; k++) {
        var dd = Math.abs(x(pts[k].t) - rel);
        if (dd < bd) { bd = dd; best = k; }
      }
      show(best);
    }
    svg.addEventListener("mousemove", nearest);
    svg.addEventListener("mouseleave", hide);
    svg.addEventListener("touchstart", function (ev) {
      if (ev.touches && ev.touches.length) nearest(ev.touches[0]);
    }, { passive: true });
    svg.addEventListener("touchmove", function (ev) {
      if (ev.touches && ev.touches.length) nearest(ev.touches[0]);
    }, { passive: true });
    svg.addEventListener("touchend", hide);

    /* --- table view: the series is never readable only as a picture --- */
    /* --- legend: platform icons with the latest known split --- */
    var legend = host.parentNode.querySelector(".chart-legend");
    var lastSplit = null;
    for (var q = pts.length - 1; q >= 0 && !lastSplit; q--) lastSplit = breakdown(pts[q], layers);
    if (legend && lastSplit) {
      legend.innerHTML = lastSplit.map(function (r) {
        return '<li>' + platformIcon(r.key) + '<span>' + PLATFORMS[r.key].name + '</span><b>' + fmtShort(r.value) + '</b></li>';
      }).join("");
    }
  }

  if (chartHost) {
    var getJson = function (url) {
      return fetch(url, { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      });
    };
    Promise.all([
      getJson("data/baseline.json").catch(function () { return null; }),
      getJson("data/stats.json")
    ])
      .then(function (res) {
        var pts = mergeSeries(res[0], res[1]);
        var layers = (res[0] && res[0].layers) || ["green"];
        drawGrowth(chartHost, pts, layers);
        /* Geometry is measured, so a width change needs a redraw. Height-only
           changes (mobile browser chrome hiding) are ignored. */
        var lastW = chartHost.clientWidth, t;
        window.addEventListener("resize", function () {
          if (chartHost.clientWidth === lastW) return;
          lastW = chartHost.clientWidth;
          clearTimeout(t);
          t = setTimeout(function () { drawGrowth(chartHost, pts, layers); }, 150);
        });
      })
      .catch(function () {
        chartHost.innerHTML = '<div class="chart-empty"><span class="ce-note">Growth data unavailable right now.</span></div>';
      });
  }

  /* ---- Sticky CTA (phones) ----
     Appears once the hero is off screen, hides again over the contact
     section (which has its own button). Dismissal lasts for the visit. */
  var fab = document.getElementById("ctaFab");
  if (fab && "IntersectionObserver" in window) {
    var hero = document.querySelector(".hero"), contact = document.getElementById("contact");
    var heroOut = false, contactIn = false, dismissed = false;
    try { dismissed = sessionStorage.getItem("ctaFabClosed") === "1"; } catch (e) {}
    var sync = function () { fab.classList.toggle("show", heroOut && !contactIn && !dismissed); };
    new IntersectionObserver(function (es) { heroOut = !es[0].isIntersecting; sync(); }).observe(hero);
    if (contact) new IntersectionObserver(function (es) { contactIn = es[0].isIntersecting; sync(); }).observe(contact);
    fab.querySelector(".cta-fab-close").addEventListener("click", function () {
      dismissed = true; sync();
      try { sessionStorage.setItem("ctaFabClosed", "1"); } catch (e) {}
    });
  }

  /* ---- Lightbox: tap a receipt or photo to see it full size ---- */
  var lb = document.getElementById("lightbox");
  if (lb) {
    var lbImg = lb.querySelector("img"), lastFocus = null;
    var closeLb = function () {
      lb.hidden = true; document.body.style.overflow = "";
      if (lastFocus) lastFocus.focus();
    };
    document.querySelectorAll(".receipt img, .case-portrait img, .m-media img").forEach(function (img) {
      img.tabIndex = 0;
      img.setAttribute("role", "button");
      var open = function () {
        lastFocus = img;
        lbImg.src = img.currentSrc || img.src;
        lbImg.alt = img.alt;
        lb.hidden = false; document.body.style.overflow = "hidden";
        lb.querySelector(".lb-close").focus();
      };
      img.addEventListener("click", open);
      img.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    });
    lb.addEventListener("click", closeLb);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !lb.hidden) closeLb(); });
  }

  /* ---- Track rows: tap to open a Spotify player under the row ----
     One open at a time. The iframe is created on first open and dropped on
     close, so the page never loads four players and closing stops playback. */
  var rows = document.querySelectorAll(".t-row[data-track]");
  function closeRow(btn) {
    var box = btn.nextElementSibling;
    btn.setAttribute("aria-expanded", "false");
    box.classList.remove("open");
    setTimeout(function () { if (!box.classList.contains("open")) box.innerHTML = ""; }, 400);
  }
  rows.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var opening = btn.getAttribute("aria-expanded") !== "true";
      rows.forEach(function (b) { if (b.getAttribute("aria-expanded") === "true") closeRow(b); });
      if (!opening) return;
      var box = btn.nextElementSibling;
      box.innerHTML = '<div><iframe title="Play on Spotify" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" ' +
        'src="https://open.spotify.com/embed/track/' + btn.getAttribute("data-track") + '?utm_source=generator&theme=0"></iframe></div>';
      btn.setAttribute("aria-expanded", "true");
      requestAnimationFrame(function () { box.classList.add("open"); });
    });
  });

})();
