/* Rhymo landing — motion and small demos.
   Everything here is extra: without JS, or with "reduce motion" on,
   every word and every demo is already on the page in its final state. */
(function () {
  "use strict";
  var root = document.documentElement;
  var rtl = root.dir === "rtl";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ---------------------------------------------------------------- nav */
  var nav = $("#nav");
  var onScrollNav = function () { if (nav) nav.classList.toggle("scrolled", scrollY > 24); };
  onScrollNav();
  addEventListener("scroll", onScrollNav, { passive: true });

  var menuBtn = $("#menu-btn");
  var setMenu = function (open) {
    root.classList.toggle("menu-open", open);
    if (!menuBtn) return;
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuBtn.setAttribute("aria-label", open ? menuBtn.dataset.close : menuBtn.dataset.open);
  };
  if (menuBtn) {
    menuBtn.addEventListener("click", function () { setMenu(!root.classList.contains("menu-open")); });
    $$("#sheet a").forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
    document.addEventListener("click", function (e) { if (!e.target.closest("#sheet, #menu-btn")) setMenu(false); });
  }

  /* The olive thumb under the nav link of the section on screen (home),
     and the table of contents on the long pages. */
  var links = $$("#links a[href*='#']");
  var thumb = $("#links .thumb");
  var tocLinks = $$(".toc a");
  var spyTargets = function (list) {
    return list.map(function (a) {
      var h = a.getAttribute("href"); var i = h.indexOf("#");
      return i < 0 ? null : document.getElementById(h.slice(i + 1));
    });
  };
  var navTargets = spyTargets(links), tocTargets = spyTargets(tocLinks);
  var lastNav = null;
  var spy = function () {
    var y = innerHeight * 0.38;
    if (links.length && thumb) {
      var cur = null;
      navTargets.forEach(function (s, i) { if (s && s.getBoundingClientRect().top <= y) cur = links[i]; });
      if (cur !== lastNav) {
        lastNav = cur;
        links.forEach(function (l) { l.classList.toggle("on", l === cur); });
        if (!cur) thumb.style.opacity = 0;
        else {
          thumb.style.opacity = 1;
          thumb.style.width = cur.offsetWidth + "px";
          var x = rtl ? -(cur.parentNode.offsetWidth - cur.offsetLeft - cur.offsetWidth) : cur.offsetLeft;
          thumb.style.transform = "translateX(" + x + "px)";
        }
      }
    }
    if (tocLinks.length) {
      var on = 0;
      tocTargets.forEach(function (s, i) { if (s && s.getBoundingClientRect().top <= y) on = i; });
      tocLinks.forEach(function (l, i) { l.classList.toggle("on", i === on); });
    }
  };
  addEventListener("scroll", spy, { passive: true });
  addEventListener("resize", function () { lastNav = null; spy(); });
  spy();

  /* --------------------------------------------------- rhyme finder demo */
  $$("[data-finder]").forEach(function (box) {
    var sets = JSON.parse(box.getAttribute("data-finder"));
    var out = $(".rchips", box), btns = $$(".seg button", box), syl = $(".sylrow", box);
    var show = function (mode) {
      btns.forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.mode === mode ? "true" : "false"); });
      if (syl) $$("span", syl).forEach(function (s) { s.classList.toggle("on", (s.dataset.modes || "").indexOf(mode) > -1); });
      out.innerHTML = "";
      sets[mode].forEach(function (w, i) {
        var c = document.createElement("span");
        c.className = "rchip" + (i === 0 ? " mark" : "");
        c.textContent = w;
        out.appendChild(c);
        if (!reduce && window.gsap) gsap.from(c, { opacity: 0, y: 12, scale: .85, duration: .45, delay: i * .045, ease: "back.out(2)" });
      });
    };
    btns.forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.mode); }); });
  });

  var fa = root.lang === "fa";
  var toFa = function (n) { return String(n).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[+d]; }); };
  var num = function (n) { return fa ? toFa(n) : String(n); };

  /* ------------------------------------------------------ scroll progress */
  var bar = $(".progress");
  var onProg = function () {
    if (!bar) return;
    var h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = "scaleX(" + (h > 0 ? clamp(scrollY / h, 0, 1) : 0) + ")";
  };
  addEventListener("scroll", onProg, { passive: true });
  onProg();

  var vibe = function () { return "poem"; };
  var vibeHooks = [];

  /* ------------------------------------------------------ try it demos (poetry and rap) */
  $$(".try[data-try]").forEach(function (tryBox) {
    var TRY = JSON.parse(tryBox.getAttribute("data-try"));
    var L = JSON.parse(tryBox.getAttribute("data-l"));
    var cur = 0, mode = "phon", saved = {}, bankN = 0;
    var words = $$(".tw", tryBox), segBtns = $$(".try-seg button", tryBox);
    var big = $(".tw-big", tryBox), sylEl = $(".tw-syl", tryBox), nEl = $(".tw-n", tryBox), avaEl = $(".tw-ava", tryBox);
    var note = $(".try-mode-note", tryBox), title = $(".to-title", tryBox), count = $(".to-count", tryBox);
    var chipsEl = $(".to-chips", tryBox), bank = $(".bank", tryBox), bankNum = $(".bank-n", tryBox), toast = $(".to-toast", tryBox);
    var toastT = null;
    var render = function (animate) {
      var d = TRY[cur];
      words.forEach(function (w, i) { w.classList.toggle("on", i === cur); w.setAttribute("aria-pressed", i === cur ? "true" : "false"); });
      segBtns.forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.mode === mode ? "true" : "false"); });
      big.textContent = d.w;
      sylEl.innerHTML = d.syl.map(function (x) { return '<span class="on">' + x + "</span>"; }).join("");
      nEl.textContent = toFa(d.syl.length);
      avaEl.textContent = d.ava;
      note.textContent = mode === "phon" ? L.phon_note : L.trad_note.replace("{end}", d.trad_end);
      title.textContent = L.rhymes_of + " «" + d.w + "»";
      var list = d[mode];
      count.textContent = L.count.replace("{n}", num(list.length));
      chipsEl.innerHTML = "";
      list.forEach(function (w, i) {
        var c = document.createElement("button");
        c.type = "button"; c.className = "rchip" + (saved[w] ? " saved" : ""); c.textContent = w;
        chipsEl.appendChild(c);
        if (animate && !reduce && window.gsap) gsap.from(c, { opacity: 0, y: 14, scale: .8, duration: .5, delay: i * .04, ease: "back.out(2)" });
      });
      if (animate && !reduce && window.gsap) gsap.from(big, { opacity: 0, y: 18, duration: .6, ease: "expo.out" });
    };
    words.forEach(function (w, i) { w.addEventListener("click", function () { if (cur !== i) { cur = i; render(true); } }); });
    segBtns.forEach(function (b) { b.addEventListener("click", function () { if (mode !== b.dataset.mode) { mode = b.dataset.mode; render(true); } }); });
    chipsEl.addEventListener("click", function (e) {
      var c = e.target.closest(".rchip");
      if (!c || c.classList.contains("saved")) return;
      var w = c.textContent;
      saved[w] = true; c.classList.add("saved");
      bankN++;
      var land = function () {
        bankNum.textContent = num(bankN);
        bank.classList.remove("bump"); void bank.offsetWidth; bank.classList.add("bump");
      };
      if (!reduce && window.gsap) {
        var r = c.getBoundingClientRect(), t = bank.getBoundingClientRect();
        var f = c.cloneNode(true); f.classList.add("flyer"); f.classList.remove("saved");
        f.style.left = r.left + "px"; f.style.top = r.top + "px"; f.style.width = r.width + "px";
        document.body.appendChild(f);
        gsap.to(f, { x: t.left + t.width / 2 - r.left - r.width / 2, y: t.top - r.top, scale: .35, opacity: .2, duration: .75, ease: "power3.in",
          onComplete: function () { f.remove(); land(); } });
      } else land();
      toast.textContent = L.added.replace("{w}", w);
      toast.classList.add("on");
      clearTimeout(toastT); toastT = setTimeout(function () { toast.classList.remove("on"); }, 1800);
    });
    render(false);
  });

  /* ------------------------------------------------------ nav turns dark over the rap part */
  var rapZone = $(".rap-zone"), shiftSec = $(".shift");
  var navDark = function () {
    if (!nav || !rapZone) return;
    var y = 64, dark = rapZone.getBoundingClientRect().top <= y;
    if (!dark && shiftSec) { var r = shiftSec.getBoundingClientRect(); dark = r.top <= y && r.bottom > y && shiftSec.classList.contains("is-dark"); }
    nav.classList.toggle("dark", dark);
  };
  addEventListener("scroll", navDark, { passive: true });
  navDark();

  if (reduce || !window.gsap) { root.classList.add("no-motion"); return; }
  root.classList.add("js");

  /* ------------------------------------------------------- smooth scroll */
  gsap.registerPlugin(ScrollTrigger);
  var lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    $$("a[href^='#'], a[href*='/#']").forEach(function (a) {
      a.addEventListener("click", function (e) {
        var h = a.getAttribute("href"), i = h.indexOf("#");
        var path = h.slice(0, i);
        if (path && path !== location.pathname) return;
        var id = h.slice(i + 1);
        var t = id === "top" || !id ? 0 : document.getElementById(id);
        if (t === null) return;
        e.preventDefault();
        lenis.scrollTo(t, { offset: t === 0 ? 0 : -88, duration: 1.5 });
        if (id && id !== "top") history.replaceState(null, "", "#" + id);
      });
    });
  }

  /* ------------------------------------------------------- count-in intro */
  var introDelay = 0;
  if (root.classList.contains("intro")) {
    var ov = $(".intro-ov");
    if (ov) {
      introDelay = 2.15;
      var beats = $$(".intro-beats i", ov);
      var itl = gsap.timeline();
      itl.from($$(".intro-logo path", ov), { scaleY: 0, transformOrigin: "50% 100%", duration: .7, ease: "expo.out", stagger: .1 })
        .fromTo(beats, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .3, stagger: .05 }, "-=.3");
      beats.forEach(function (b, i) {
        itl.add(function () { beats.forEach(function (x) { x.classList.remove("on"); }); b.classList.add("on"); }, 0.95 + i * 0.26);
      });
      itl.to(ov, { yPercent: -100, duration: .75, ease: "expo.inOut" }, 2.05)
        .add(function () { root.classList.remove("intro"); ov.style.display = "none"; ScrollTrigger.refresh(); });
    }
  }

  /* ------------------------------------------------------- hero title lines rise */
  var scan = $("#scan");
  if (scan) gsap.from($$(".ln", scan), { yPercent: 50, opacity: 0, duration: 1.2, ease: "expo.out", stagger: .14, delay: .2 + introDelay });

  /* ------------------------------------------------------- word reveals */
  // Wrap each word in a span. Only whole words: Persian letters must stay joined.
  var splitWords = function (el) {
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            var s = document.createElement("span"); s.className = "w"; s.textContent = p; frag.appendChild(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && !n.classList.contains("mchip") && !n.classList.contains("w")) walk(n);
      });
    };
    walk(el);
    $$(".mchip", el).forEach(function (c) { c.classList.add("w"); });
    return $$(".w", el);
  };
  $$("[data-split]").forEach(function (el) {
    var words = splitWords(el);
    var now = el.hasAttribute("data-now");
    var tw = { opacity: 1, y: 0, rotate: 0, filter: "blur(0px)", duration: 1.1, ease: "expo.out", stagger: .07 };
    if (now) gsap.to(words, Object.assign({ delay: .25 + introDelay }, tw));
    else gsap.to(words, Object.assign({ scrollTrigger: { trigger: el, start: "top 86%" } }, tw));
  });
  ScrollTrigger.batch("[data-rv]", {
    start: "top 90%",
    onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, duration: 1, ease: "expo.out", stagger: .09, overwrite: true }); }
  });

  /* ---------------------------------------------------------- the logo */
  // The three strokes of "rh" grow up from the baseline, one after another.
  $$("[data-logo-draw]").forEach(function (svg) {
    var paths = $$("path", svg);
    gsap.from(paths, { scaleY: 0, transformOrigin: "50% 100%", duration: 1, ease: "expo.out", stagger: .12, delay: .15 });
  });

  /* ------------------------------------------------------ the metronome */
  var metro = $("#metro");
  if (metro) {
    var pend = $(".pend", metro), lamp = $(".bpm .lamp", metro), pulse = $(".pulse", metro);
    var sylsFor = function () { return $$(".word-card .syls span", metro); };
    var pads = $$(".pads i", metro);
    var slots = $$(".orbit .rw", metro);
    var WORDS = { poem: JSON.parse(metro.getAttribute("data-rhymes")), rap: [] };
    var words = WORDS[vibe()];
    var bpm = vibe() === "rap" ? 90 : (+metro.getAttribute("data-bpm") || 88);
    var beatN = 0, k = 0;
    var scanSy = $$("#scan .sy").filter(function (x) { return x.getAttribute("data-m"); });
    slots.forEach(function (s) { gsap.set(s, { opacity: 0, scale: .4 }); });
    var beat = function () {
      beatN++;
      lamp.classList.add("on"); setTimeout(function () { lamp.classList.remove("on"); }, 140);
      var syls = sylsFor();
      syls.forEach(function (s, i) { s.classList.toggle("on", i === beatN % syls.length); });
      pads.forEach(function (p, i) { p.classList.toggle("on", i === (beatN - 1) % 4); });
      scanSy.forEach(function (s, i) { s.classList.toggle("on", i === (beatN - 1) % scanSy.length); });
      gsap.fromTo(pulse, { scale: .6, opacity: .9 }, { scale: 2.4, opacity: 0, duration: .7, ease: "power2.out" });
      var ring = rings[ringI++ % rings.length];
      if (ring) gsap.fromTo(ring, { scale: .7, opacity: .9 }, { scale: 1.9, opacity: 0, duration: 1.4, ease: "power2.out" });
      if (vibe() === "rap") drum(beatN); else click(beatN % 4 === 1);
      var slot = slots[(beatN - 1) % slots.length];
      slots.forEach(function (s) { s.classList.remove("hot"); });
      slot.textContent = words[k++ % words.length];
      slot.classList.add("hot");
      gsap.fromTo(slot, { opacity: 0, scale: .4, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: .55, ease: "back.out(2.2)" });
    };
    var half = 60 / bpm;
    var bpmN = $("#bpm-n"), rings = $$(".beat-ring", metro), ringI = 0;
    var actx = null, soundOn = false;
    var click = function (accent) {
      if (!soundOn || !actx) return;
      var t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
      o.type = "triangle"; o.frequency.value = accent ? 1560 : 1040;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(accent ? .5 : .32, t + .004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + .07);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + .09);
    };
    var noise = null;
    var noiseBuf = function () {
      if (noise) return noise;
      noise = actx.createBuffer(1, actx.sampleRate * .3, actx.sampleRate);
      var d = noise.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return noise;
    };
    var hit = function (kind) {
      var t = actx.currentTime, g = actx.createGain();
      g.connect(actx.destination);
      if (kind === "kick") {
        var o = actx.createOscillator(); o.type = "sine";
        o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + .18);
        g.gain.setValueAtTime(.9, t); g.gain.exponentialRampToValueAtTime(.001, t + .32);
        o.connect(g); o.start(t); o.stop(t + .34);
      } else {
        var n = actx.createBufferSource(); n.buffer = noiseBuf();
        var f = actx.createBiquadFilter();
        f.type = kind === "snare" ? "bandpass" : "highpass"; f.frequency.value = kind === "snare" ? 1800 : 7000;
        var len = kind === "snare" ? .18 : .05;
        g.gain.setValueAtTime(kind === "snare" ? .6 : .18, t); g.gain.exponentialRampToValueAtTime(.001, t + len);
        n.connect(f).connect(g); n.start(t); n.stop(t + len + .02);
      }
    };
    var drum = function (b) {
      if (!soundOn || !actx) return;
      var step = (b - 1) % 4;
      hit(step % 2 === 0 ? "kick" : "snare");
      hit("hat");
      setTimeout(function () { if (soundOn) hit("hat"); }, (30 / bpm) * 1000);
      if (step === 2) setTimeout(function () { if (soundOn) hit("kick"); }, (30 / bpm) * 1000);
    };
    var snd = $("#snd");
    if (snd) snd.addEventListener("click", function () {
      soundOn = !soundOn;
      snd.setAttribute("aria-pressed", soundOn ? "true" : "false");
      if (soundOn && !actx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) actx = new AC(); }
      if (actx && actx.state === "suspended") actx.resume();
    });
    $$("[data-bpm-step]", metro).forEach(function (b) {
      b.addEventListener("click", function () {
        bpm = clamp(bpm + (+b.getAttribute("data-bpm-step")), 48, 176);
        bpmN.textContent = num(bpm);
        swing.duration(60 / bpm); ghostSwing.duration(60 / bpm);
        gsap.to(weights, { y: weightY(bpm), duration: .6, ease: "back.out(1.7)" });
      });
    });
    var ghost = $(".pend-ghost", metro);
    var weights = $$(".m-weight, .pend-ghost .m-wt", metro);
    var weightY = function (b) { return 120 + (clamp(b, 40, 200) - 40) * 220 / 160 - 200; };
    gsap.set(weights, { y: weightY(bpm) });
    bpmN.textContent = num(bpm);
    gsap.set([pend, ghost], { rotation: -18, svgOrigin: "200 404" });
    vibeHooks.push(function (v) {
      words = WORDS[v]; k = 0;
      bpm = v === "rap" ? 90 : 88;
      bpmN.textContent = num(bpm);
      swing.duration(60 / bpm); ghostSwing.duration(60 / bpm);
      gsap.to(weights, { y: weightY(bpm), duration: .6, ease: "back.out(1.7)" });
      slots.forEach(function (s, i) { s.textContent = words[i % words.length]; });
    });
    var ghostSwing = gsap.to(ghost, { rotation: 18, duration: half, ease: "sine.inOut", repeat: -1, yoyo: true, paused: true });
    gsap.to($(".m-key-wing", metro), { scaleY: -1, transformOrigin: "50% 50%", duration: 2.6, ease: "sine.inOut", repeat: -1, yoyo: true });
    var swing = gsap.to(pend, {
      rotation: 18, duration: half, ease: "sine.inOut", repeat: -1, yoyo: true,
      onRepeat: beat, paused: true
    });
    gsap.from(metro, { opacity: 0, y: 40, scale: .96, duration: 1.2, ease: "expo.out", delay: .3 + introDelay, onComplete: function () { swing.play(); setTimeout(function () { ghostSwing.play(); }, 45); beat(); } });
    // Pause when off screen, to save the battery.
    ScrollTrigger.create({ trigger: ".hero", start: "top bottom", end: "bottom top",
      onToggle: function (st) { if (st.isActive) { swing.play(); ghostSwing.play(); } else { swing.pause(); ghostSwing.pause(); } } });
    // A little depth with the scroll.
    gsap.to($(".arch", metro), { yPercent: -6, ease: "none", scrollTrigger: { trigger: metro, start: "top top", end: "bottom top", scrub: true } });
    // The whole scene turns a little toward the pointer.
    if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
      var hero = $(".hero");
      hero.addEventListener("pointermove", function (e) {
        var x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
        gsap.to(metro, { rotateY: x * 14, rotateX: -y * 8, duration: 1, ease: "power3.out" });
      });
      hero.addEventListener("pointerleave", function () { gsap.to(metro, { rotateY: 0, rotateX: 0, duration: 1.2, ease: "expo.out" }); });
    }
  }

  /* --------------------------------------------------- syllables tile */
  $$("[data-split-word]").forEach(function (box) {
    var parts = $$(".parts span", box);
    var tl = gsap.timeline({ repeat: -1, repeatDelay: 1.6, paused: true });
    tl.from(parts, { y: 26, opacity: 0, rotate: rtl ? 8 : -8, duration: .6, ease: "back.out(2)", stagger: .22 })
      .to(parts, { y: -6, duration: .18, ease: "power1.out", stagger: { each: .34, yoyo: true, repeat: 1 } }, "+=.5");
    ScrollTrigger.create({ trigger: box, start: "top 85%", onEnter: function () { tl.play(); } });
  });

  /* ---------------------------------------------------------- the flow */
  var flow = $("#flow-pin");
  if (flow) {
    var steps = $$(".step", flow), screens = $$(".scr", flow), fill = $(".steps .fill", flow);
    var setStep = function (i) {
      steps.forEach(function (s, j) { s.classList.toggle("on", j <= i); });
      screens.forEach(function (s, j) { s.classList.toggle("on", j === i); });
      var a = steps[0], b = steps[i];
      if (fill && a && b) fill.style.height = (b.offsetTop - a.offsetTop) + "px";
    };
    setStep(0);
    var mm = gsap.matchMedia();
    mm.add("(min-width: 901px)", function () {
      ScrollTrigger.create({
        trigger: flow, start: "top top+=90", end: "+=" + (steps.length * 70) + "%", pin: true, anticipatePin: 1,
        onUpdate: function (st) { setStep(clamp(Math.floor(st.progress * steps.length), 0, steps.length - 1)); }
      });
    });
    mm.add("(max-width: 900px)", function () {
      steps.forEach(function (s, i) {
        ScrollTrigger.create({ trigger: s, start: "top 65%", end: "bottom 35%", onToggle: function (st) { if (st.isActive) setStep(i); } });
      });
    });
  }

  /* ------------------------------------------------- the notepad typing */
  // One note per vibe. Each is read from the page, then typed again.
  var bodies = $$(".ed-body");
  if (bodies.length) {
    var dock = $("#ed-dock"), dockTitle = $("#ed-dock small"), dockChips = $("#ed-dock .rchips");
    var seqs = {};
    bodies.forEach(function (ed) {
      var seq = [];
      Array.prototype.slice.call(ed.childNodes).forEach(function (n) {
        if (n.nodeType === 3) seq.push({ t: n.textContent });
        else if (n.classList.contains("pill")) seq.push({ pill: n.textContent, cls: n.className, dock: n.dataset.dock ? JSON.parse(n.dataset.dock) : null });
        else if (n.classList.contains("slash")) seq.push({ slash: n.textContent });
        else seq.push({ node: n.cloneNode(true) });
      });
      seqs.main = seq;
    });
    var run = 0, seen = false;
    var play = function () {
      var my = ++run;
      var ed = $(".ed-body"), seq = seqs.main;
      if (!ed || !seq) return;
      var later = function (f, ms) { setTimeout(function () { if (my === run) f(); }, ms); };
      ed.innerHTML = "";
      dock.classList.add("hide");
      var caret = document.createElement("span"); caret.className = "caret"; ed.appendChild(caret);
      var i = 0;
      var put = function (node) { ed.insertBefore(node, caret); };
      var typeText = function (txt, el, speed, done) {
        var j = 0;
        var step = function () {
          if (j >= txt.length) return done();
          el.textContent += txt[j++];
          later(step, speed + Math.random() * speed);
        };
        step();
      };
      var next = function () {
        if (i >= seq.length) return;
        var s = seq[i++];
        if (s.t != null) { var tn = document.createTextNode(""); put(tn); typeText(s.t, tn, 26, next); }
        else if (s.slash) { var sl = document.createElement("span"); sl.className = "slash"; sl.textContent = s.slash; put(sl); later(next, 260); }
        else if (s.node) { put(s.node.cloneNode(true)); next(); }
        else if (s.pill) {
          var mk = document.createElement("span"); mk.className = "mk"; mk.textContent = "|"; put(mk);
          var finish = function () {
            mk.textContent += "|";
            later(function () {
              var p = document.createElement("span"); p.className = s.cls; p.textContent = s.pill;
              ed.replaceChild(p, mk);
              gsap.fromTo(p, { scale: .7 }, { scale: 1, duration: .5, ease: "back.out(3)" });
              dock.classList.add("hide");
              later(next, 320);
            }, 240);
          };
          later(function () {
            if (s.dock) {
              dockTitle.textContent = s.dock.title;
              dockChips.innerHTML = "";
              s.dock.words.forEach(function (w) { var c = document.createElement("span"); c.className = "rchip"; c.textContent = w; dockChips.appendChild(c); });
              dock.classList.remove("hide");
              var pick = $$(".rchip", dockChips).filter(function (c) { return c.textContent === s.pill; })[0];
              later(function () {
                if (pick) pick.classList.add("mark");
                later(function () { mk.textContent = "|" + s.pill; finish(); }, 520);
              }, 900);
            } else typeText(s.pill, mk, 40, function () { mk.textContent = "|" + mk.textContent.slice(1); finish(); });
          }, 220);
        }
      };
      later(next, 400);
    };
    ScrollTrigger.create({ trigger: "#notepad .editor", start: "top 75%", once: true, onEnter: function () { seen = true; play(); } });
    var again = $("#ed-again");
    if (again) again.addEventListener("click", play);
    vibeHooks.push(function () { if (seen) play(); });
  }

  /* ------------------------------------------------- poetry turns into rap */
  if (shiftSec) {
    var sBg = $(".shift-bg", shiftSec), sIn = $(".shift-in", shiftSec);
    var swPoem = $(".sw-poem", shiftSec), swRap = $(".sw-rap", shiftSec), sBpm = $("#shift-bpm");
    var seqEl = $("#seq"), onCells = $$("i.on", seqEl);
    onCells.forEach(function (c) { c.classList.remove("on"); c.classList.add("pat"); });
    var paper = getComputedStyle(root).getPropertyValue("--paper").trim() || "#f4eee3";
    gsap.set(sBg, { backgroundColor: paper });
    gsap.set(sIn, { color: "#23241a" });
    gsap.set(swRap, { opacity: 0, y: 60, scale: 1.12 });
    var stl = gsap.timeline({ defaults: { ease: "none" } });
    stl.to(sBg, { backgroundColor: "#141511", duration: .5 }, .1)
       .to(sIn, { color: "#f1ebe4", duration: .5 }, .1)
       .to(swPoem, { opacity: 0, y: -40, duration: .25 }, .32)
       .to(swRap, { opacity: 1, y: 0, scale: 1, duration: .3, ease: "back.out(2)" }, .45)
       .to({}, { duration: .25 });
    ScrollTrigger.create({
      trigger: shiftSec, start: "top top", end: "+=160%", pin: ".shift-pin", scrub: .6, animation: stl, refreshPriority: 10,
      onUpdate: function (st) {
        var p = st.progress;
        sBpm.textContent = num(Math.round(60 + 30 * clamp(p / .8, 0, 1)));
        onCells.forEach(function (c) { c.classList.toggle("on", +c.getAttribute("data-c") / 16 < (p - .25) / .55); });
        shiftSec.classList.toggle("is-dark", p > .35);
        navDark();
      }
    });

    // The drum grid plays: a light runs across it, with sound after "play".
    var sctx = null, sNoise = null, playing = false, step = 0, timer = null;
    var sHit = function (kind) {
      if (!sctx) return;
      var t = sctx.currentTime, g = sctx.createGain(); g.connect(sctx.destination);
      if (kind === "k") {
        var o = sctx.createOscillator(); o.type = "sine";
        o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + .18);
        g.gain.setValueAtTime(.9, t); g.gain.exponentialRampToValueAtTime(.001, t + .32);
        o.connect(g); o.start(t); o.stop(t + .34);
      } else {
        if (!sNoise) { sNoise = sctx.createBuffer(1, sctx.sampleRate * .3, sctx.sampleRate); var d = sNoise.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
        var n = sctx.createBufferSource(); n.buffer = sNoise;
        var f = sctx.createBiquadFilter(); f.type = kind === "s" ? "bandpass" : "highpass"; f.frequency.value = kind === "s" ? 1800 : 7000;
        var len = kind === "s" ? .18 : .05;
        g.gain.setValueAtTime(kind === "s" ? .6 : .16, t); g.gain.exponentialRampToValueAtTime(.001, t + len);
        n.connect(f).connect(g); n.start(t); n.stop(t + len + .02);
      }
    };
    var tickSeq = function () {
      $$("i.ph", seqEl).forEach(function (c) { c.classList.remove("ph"); });
      $$('i[data-c="' + step + '"]', seqEl).forEach(function (c) {
        c.classList.add("ph");
        if (c.classList.contains("on")) {
          c.classList.add("hit"); setTimeout(function () { c.classList.remove("hit"); }, 110);
          if (playing) sHit(c.parentNode.getAttribute("data-row"));
        }
      });
      step = (step + 1) % 16;
    };
    var runSeq = function (on) {
      clearInterval(timer); timer = null;
      if (on) timer = setInterval(tickSeq, (60 / 90 / 4) * 1000);
      else $$("i.ph", seqEl).forEach(function (c) { c.classList.remove("ph"); });
    };
    ScrollTrigger.create({ trigger: shiftSec, start: "top 40%", end: "bottom top", onToggle: function (st) { runSeq(st.isActive); if (!st.isActive) setPlay(false); } });
    var playBtn = $("#beat-play");
    var setPlay = function (on) {
      playing = on;
      if (!playBtn) return;
      playBtn.setAttribute("aria-pressed", on ? "true" : "false");
      $(".lbl", playBtn).textContent = on ? playBtn.dataset.stop : playBtn.dataset.play;
    };
    if (playBtn) playBtn.addEventListener("click", function () {
      if (!sctx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) sctx = new AC(); }
      if (sctx && sctx.state === "suspended") sctx.resume();
      setPlay(!playing);
      if (!timer) runSeq(true);
    });
    document.addEventListener("visibilitychange", function () { if (document.hidden) setPlay(false); });
  }

  /* ------------------------------------------------- number counters */
  $$("[data-count]").forEach(function (el) {
    var end = +el.getAttribute("data-count"), o = { v: 0 };
    ScrollTrigger.create({ trigger: el, start: "top 88%", once: true, onEnter: function () {
      gsap.fromTo(o, { v: 0 }, { v: end, duration: 1.4, ease: "power3.out", onUpdate: function () { el.textContent = num(Math.round(o.v)); } });
    } });
  });

  /* ------------------------------------------------- the poem lights up */
  var bayt = $("#bayt");
  if (bayt) {
    ScrollTrigger.create({ trigger: bayt, start: "top 70%", onEnter: function () { bayt.classList.add("lit"); },
      onLeaveBack: function () { bayt.classList.remove("lit"); } });
    gsap.from($$(".misra", bayt), { opacity: 0, x: rtl ? 40 : -40, duration: 1.2, ease: "expo.out", stagger: .25,
      scrollTrigger: { trigger: bayt, start: "top 85%" } });
  }

  var barsEl = $("#bars");
  if (barsEl) ScrollTrigger.create({ trigger: barsEl, start: "top 70%", onEnter: function () { barsEl.classList.add("lit"); },
    onLeaveBack: function () { barsEl.classList.remove("lit"); } });
  vibeHooks.push(function () {
    [bayt, barsEl].forEach(function (el) { if (el) { el.classList.remove("lit"); setTimeout(function () { ScrollTrigger.refresh(); if (el.getBoundingClientRect().top < innerHeight * .7) el.classList.add("lit"); }, 80); } });
  });

  /* ------------------------------------------------- light on the notepad part */
  var np = $(".np-sec");
  if (np) np.addEventListener("pointermove", function (e) {
    var r = np.getBoundingClientRect();
    np.style.setProperty("--mx", (e.clientX - r.left) + "px");
    np.style.setProperty("--my", (e.clientY - r.top) + "px");
  });

  /* ------------------------------------------------- footer wordmark */
  $$(".wordmark").forEach(function (wm) {
    gsap.from(wm.children, { yPercent: 40, opacity: 0, duration: 1.2, ease: "expo.out", stagger: .12,
      scrollTrigger: { trigger: wm, start: "top 92%" } });
  });

  /* ------------------------------------------------- tiles follow the hand */
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    $$(".tile, .pcard").forEach(function (t) {
      t.addEventListener("pointermove", function (e) {
        var r = t.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        gsap.to(t, { rotateY: x * 4, rotateX: -y * 4, transformPerspective: 900, duration: .6, ease: "power2.out" });
      });
      t.addEventListener("pointerleave", function () { gsap.to(t, { rotateY: 0, rotateX: 0, duration: .8, ease: "expo.out" }); });
    });
    // Big buttons lean toward the pointer a little.
    $$(".hero .btn, .get .store, .tile .btn").forEach(function (bt) {
      bt.addEventListener("pointermove", function (e) {
        var r = bt.getBoundingClientRect();
        gsap.to(bt, { x: (e.clientX - r.left - r.width / 2) * .18, y: (e.clientY - r.top - r.height / 2) * .25, duration: .4, ease: "power3.out" });
      });
      bt.addEventListener("pointerleave", function () { gsap.to(bt, { x: 0, y: 0, duration: .7, ease: "elastic.out(1, .4)" }); });
    });
  }

  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  addEventListener("load", function () { ScrollTrigger.refresh(); });
  if (document.fonts) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
})();
