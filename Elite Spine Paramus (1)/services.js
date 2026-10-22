// ============================================================
//  Modal system — Conditions & Services page
//  Handles BOTH condition cards (#conditions .ccard) and
//  treatment/service cards (#services .scard).
// ============================================================
(function () {
  var BOOK = "https://www.zocdoc.com/practice/elite-spine-and-sports-care-60454";
  var SERVICES = "conditions-services.html#services";

  // Therapy → internal services section (fallback href for chips
  // that have no on-page modal). Nothing links to the old site.
  // Dedicated page for each condition / treatment (crawlable, linked from cards + modal)
  var PAGE = {"Neck Pain":"neck-pain-treatment-paramus-nj.html","Lower Back Pain":"lower-back-pain-treatment-paramus-nj.html","Sciatica":"sciatica-treatment-paramus-nj.html","Sports Injuries":"sports-injury-treatment-paramus-nj.html","Shoulder Pain":"shoulder-pain-treatment-paramus-nj.html","Herniated Disc":"herniated-disc-treatment-paramus-nj.html","Headaches & Migraines":"headache-migraine-treatment-paramus-nj.html","Knee Pain":"knee-pain-treatment-paramus-nj.html","Pre & Post-Op Rehab":"pre-post-op-rehab-paramus-nj.html","Pelvic Floor":"pelvic-floor-therapy-paramus-nj.html","Hand Therapy":"hand-therapy-paramus-nj.html","Vestibular Therapy":"vestibular-therapy-paramus-nj.html","Physical Therapy":"physical-therapy-paramus-nj.html","Chiropractic Care":"chiropractic-care-paramus-nj.html","Shockwave Therapy":"shockwave-therapy-paramus-nj.html","Active Release Technique":"active-release-technique-paramus-nj.html","Dry Needling":"dry-needling-paramus-nj.html","Deep Tissue Laser Therapy":"deep-tissue-laser-therapy-paramus-nj.html","Graston Technique":"graston-technique-paramus-nj.html","Massage Therapy":"massage-therapy-paramus-nj.html","Vein Screening & Procedures":"vein-screening-procedures-paramus-nj.html","Testosterone Replacement Therapy":"testosterone-replacement-therapy-paramus-nj.html","Peptide Therapy":"peptide-therapy-paramus-nj.html"};

  var THERAPY = {
    "Physical Therapy": SERVICES,
    "Chiropractic Care": SERVICES,
    "Shockwave Therapy": SERVICES,
    "Active Release Technique": SERVICES,
    "Dry Needling": SERVICES,
    "Deep Tissue Laser Therapy": SERVICES,
    "Graston Technique": SERVICES,
    "Massage Therapy": SERVICES,
    "Therapeutic Taping": SERVICES
  };

  // ---- CONDITION content ----
  var CONDITIONS = {
    "Neck Pain": {
      lead: "Tech-neck from long days at a desk, a bad night's sleep, or a pinched nerve — neck pain quietly limits how freely you turn, look, and rest. We assess the joints, muscles, and nerves involved, then restore pain-free motion at the source.",
      treat: ["Chiropractic Care", "Active Release Technique", "Dry Needling", "Physical Therapy"]
    },
    "Lower Back Pain": {
      lead: "The most common reason patients come to see us. From muscle strain and poor lifting mechanics to disc irritation, we identify what's actually driving your back pain and treat the cause — not just mask the symptom.",
      treat: ["Physical Therapy", "Chiropractic Care", "Shockwave Therapy", "Graston Technique"]
    },
    "Sciatica": {
      lead: "Sharp, radiating pain down the leg — often with numbness or tingling — usually traces back to nerve compression in the lower spine. We work to decompress the nerve, calm the irritation, and rebuild the stability that keeps it from returning.",
      treat: ["Chiropractic Care", "Physical Therapy", "Active Release Technique", "Deep Tissue Laser Therapy"]
    },
    "Sports Injuries": {
      lead: "From weekend warriors to competitive athletes, we treat sprains, strains, tendinopathies, and overuse injuries — and guide a safe, confident return to the field, the court, or the gym.",
      treat: ["Active Release Technique", "Shockwave Therapy", "Physical Therapy", "Therapeutic Taping"]
    },
    "Shoulder Pain": {
      lead: "Rotator cuff irritation, impingement, and stiffness make overhead movement painful and weak. We restore mobility and rebuild strength so you can reach, lift, and train without compensating.",
      treat: ["Physical Therapy", "Active Release Technique", "Dry Needling", "Shockwave Therapy"]
    },
    "Herniated Disc": {
      lead: "A bulging or herniated disc can press on nearby nerves, causing pain, weakness, and limited movement. Our conservative, non-surgical approach focuses on decompression, stabilization, and a gradual return to activity.",
      treat: ["Chiropractic Care", "Physical Therapy", "Deep Tissue Laser Therapy", "Active Release Technique"]
    },
    "Headaches & Migraines": {
      lead: "Many headaches actually start in the neck — driven by tension, posture, and joint restriction. We address the cervical spine and surrounding muscles to reduce how often headaches hit and how hard.",
      treat: ["Chiropractic Care", "Active Release Technique", "Dry Needling", "Massage Therapy"]
    },
    "Knee Pain": {
      lead: "Ligament and tendon injuries, post-op recovery, and overuse pain all limit how you walk, squat, and play. We rebuild strength, control, and confidence around the joint so it holds up under load.",
      treat: ["Physical Therapy", "Shockwave Therapy", "Graston Technique", "Therapeutic Taping"]
    },
    "Pre & Post-Op Rehab": {
      lead: "Going into surgery stronger leads to a smoother recovery — and structured rehab afterward rebuilds range, strength, and function. We support you on both sides of a procedure with a clear, progressive plan.",
      treat: ["Physical Therapy", "Active Release Technique", "Deep Tissue Laser Therapy", "Massage Therapy"]
    },
    "Pelvic Floor": {
      lead: "Pelvic pain, bladder leakage, and core weakness during pregnancy, after childbirth, or after surgery are common and treatable. In a private, one-on-one setting we assess the pelvic floor and the muscles around it, then build a plan to restore strength, control, and comfort.",
      treat: ["Physical Therapy", "Massage Therapy", "Dry Needling"]
    },
    "Hand Therapy": {
      lead: "Fractures, tendon injuries, carpal tunnel, arthritis, and post-surgical stiffness can make simple tasks like gripping, typing, or opening a jar painful. Our occupational therapy team restores motion, strength, and fine motor control in the hand, wrist, and elbow.",
      treat: ["Physical Therapy", "Graston Technique", "Deep Tissue Laser Therapy", "Therapeutic Taping"]
    },
    "Vestibular Therapy": {
      lead: "Dizziness, vertigo, and unsteadiness often come from the inner ear or from how the brain processes balance. We pinpoint the cause and use targeted repositioning and balance exercises to reduce symptoms and help you move with confidence again.",
      treat: ["Physical Therapy", "Chiropractic Care"]
    }
  };

  // ---- SERVICE / TREATMENT content ----
  var SERVICE = {
    "Physical Therapy": {
      href: THERAPY["Physical Therapy"],
      lead: "Our cornerstone service. Through one-on-one, progressive programming we restore movement, rebuild strength, and reduce pain — pairing hands-on treatment with the exercise science that makes results last.",
      helps: ["Lower Back Pain", "Sciatica", "Sports Injuries", "Post-Op Recovery"]
    },
    "Chiropractic Care": {
      href: THERAPY["Chiropractic Care"],
      lead: "Precise spinal adjustments relieve pressure on joints and nerves, improve alignment, and restore function. We combine adjustments with soft-tissue work to keep the results holding between visits.",
      helps: ["Neck Pain", "Lower Back Pain", "Headaches", "Herniated Disc"]
    },
    "Shockwave Therapy": {
      href: THERAPY["Shockwave Therapy"],
      lead: "Extracorporeal shockwave delivers acoustic pulses that break down scar tissue and stimulate the body's healing response — especially effective for stubborn, chronic injuries that haven't responded to rest.",
      helps: ["Tendinopathy", "Plantar Fasciitis", "Chronic Pain", "Calcifications"]
    },
    "Active Release Technique": {
      href: THERAPY["Active Release Technique"],
      lead: "A patented, hands-on soft-tissue method that locates and releases adhesions in muscles, tendons, and nerves — restoring smooth, pain-free movement and full range of motion.",
      helps: ["Sports Injuries", "Muscle Tightness", "Nerve Entrapment", "Repetitive Strain"]
    },
    "Dry Needling": {
      href: THERAPY["Dry Needling"],
      lead: "Thin filament needles target trigger points deep in the muscle to release tension, improve blood flow, and relieve pain — often producing fast, noticeable changes in mobility.",
      helps: ["Muscle Tension", "Trigger Points", "Neck & Back Pain", "Sports Injuries"]
    },
    "Deep Tissue Laser Therapy": {
      href: THERAPY["Deep Tissue Laser Therapy"],
      lead: "Therapeutic laser penetrates deep into tissue to reduce inflammation and accelerate cellular repair — a comfortable, drug-free way to speed recovery and calm pain.",
      helps: ["Inflammation", "Joint Pain", "Sprains & Strains", "Arthritis"]
    },
    "Graston Technique": {
      href: THERAPY["Graston Technique"],
      lead: "Instrument-assisted soft-tissue mobilization uses specialized tools to detect and break down scar tissue and fascial restrictions, restoring movement and reducing pain.",
      helps: ["Scar Tissue", "Tendinitis", "Mobility Restrictions", "Chronic Tightness"]
    },
    "Massage Therapy": {
      href: THERAPY["Massage Therapy"],
      lead: "Targeted therapeutic massage eases muscular tension, improves circulation, and supports faster recovery — a powerful complement to your hands-on care and rehab plan.",
      helps: ["Muscle Tension", "Stress", "Circulation", "Recovery"]
    },
    "Vein Screening & Procedures": {
      lead: "Comprehensive vein screening followed by minimally-invasive, in-office procedures to treat varicose and spider veins. We restore healthy circulation, relieve leg heaviness and swelling, and improve both comfort and appearance.",
      helps: ["Varicose Veins", "Spider Veins", "Leg Swelling", "Poor Circulation"]
    },
    "Testosterone Replacement Therapy": {
      lead: "Physician-guided hormone optimization for men and women with low testosterone. Through carefully monitored, personalized protocols we help restore energy, lean muscle, mental focus, and drive.",
      helps: ["Low Energy", "Muscle Loss", "Low Libido", "Mental Focus"]
    },
    "Peptide Therapy": {
      lead: "Targeted peptide protocols that support weight loss, recovery, and tissue repair — tailored to your goals and monitored by our team. We provide access to the full range of peptides, including Semaglutide, Tirzepatide, Tesamorelin, GLOW, and BPC-157.",
      helps: ["Weight Loss", "Recovery", "Tissue Repair", "Anti-Aging"]
    }
  };

  // Alias: chip label → canonical modal key
  var ALIAS = {
    "Headaches": "Headaches & Migraines",
    "Post-Op Recovery": "Pre & Post-Op Rehab",
    "Neck & Back Pain": "Neck Pain"
  };

  // Registry of card icons by name (built from the DOM), so chips can
  // open the matching modal with the right icon.
  var REG = {};

  function resolveKey(label) {
    var k = ALIAS[label] || label;
    if (CONDITIONS[k] || SERVICE[k]) return k;
    return null;
  }

  // Build modal shell once
  var overlay = document.createElement("div");
  overlay.className = "cmodal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML =
    '<div class="cmodal">' +
      '<div class="cmodal__top"></div>' +
      '<button class="cmodal__close" type="button" aria-label="Close">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</button>' +
      '<div class="cmodal__icon" data-icon></div>' +
      '<div class="cmodal__eyebrow" data-eyebrow></div>' +
      '<h2 class="cmodal__title" data-title></h2>' +
      '<p class="cmodal__lead" data-lead></p>' +
      '<p class="cmodal__subhead" data-subhead></p>' +
      '<div class="cmodal__chips" data-chips></div>' +
      '<div class="cmodal__ctas">' +
        '<a class="btn btn--outline cmodal__more" data-more>Learn more</a>' +
        '<a class="btn btn--primary" data-book target="_blank" rel="noopener">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>' +
          'Book Appointment' +
        '</a>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  var elIcon = overlay.querySelector("[data-icon]");
  var elEyebrow = overlay.querySelector("[data-eyebrow]");
  var elTitle = overlay.querySelector("[data-title]");
  var elLead = overlay.querySelector("[data-lead]");
  var elSubhead = overlay.querySelector("[data-subhead]");
  var elChips = overlay.querySelector("[data-chips]");
  var elBook = overlay.querySelector("[data-book]");
  var elMore = overlay.querySelector("[data-more]");
  var panel = overlay.querySelector(".cmodal");
  var lastFocused = null;

  function renderChips(chips) {
    elChips.innerHTML = "";
    chips.forEach(function (c) {
      var node;
      var linkKey = resolveKey(c.label);
      if (linkKey) {
        // Cross-link to the matching condition/service modal on this page
        node = document.createElement("button");
        node.type = "button";
        node.className = "cmodal__chip cmodal__chip--link";
        node.addEventListener("click", function () { openByName(linkKey); });
      } else if (c.href) {
        node = document.createElement("a");
        node.href = c.href;
        node.target = "_blank";
        node.rel = "noopener";
        node.className = "cmodal__chip";
      } else {
        node = document.createElement("span");
        node.className = "cmodal__chip";
      }
      node.textContent = c.label;
      elChips.appendChild(node);
    });
  }

  function openModal(cfg) {
    elIcon.innerHTML = cfg.icon || "";
    elEyebrow.textContent = cfg.eyebrow;
    elTitle.textContent = cfg.title;
    elLead.textContent = cfg.lead;
    elSubhead.textContent = cfg.subhead;
    renderChips(cfg.chips);
    elBook.href = BOOK;
    if (cfg.page) { elMore.href = cfg.page; elMore.textContent = "Learn more about " + cfg.title; elMore.hidden = false; } else { elMore.hidden = true; }
    lastFocused = document.activeElement;
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
    panel.scrollTop = 0;
    overlay.querySelector(".cmodal__close").focus();
  }

  function closeModal() {
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function iconOf(card, sel) {
    var el = card.querySelector(sel);
    return el ? el.outerHTML : "";
  }

  // Open the modal for any known condition or service by name
  function openByName(name) {
    var key = resolveKey(name);
    if (!key) return;
    var icon = REG[key] || "";
    if (SERVICE[key]) {
      var s = SERVICE[key];
      openModal({
        icon: icon,
        eyebrow: "Treatments & Services",
        title: key,
        lead: s.lead,
        subhead: "Commonly Helps With",
        chips: s.helps.map(function (h) { return { label: h }; }),
        moreHref: s.href || SERVICES,
        page: PAGE[key]
      });
    } else if (CONDITIONS[key]) {
      var c = CONDITIONS[key];
      openModal({
        icon: icon,
        eyebrow: "Conditions We Treat",
        title: key,
        lead: c.lead,
        subhead: "How We Treat It",
        chips: c.treat.map(function (t) { return { label: t, href: THERAPY[t] || SERVICES }; }),
        moreHref: SERVICES,
        page: PAGE[key]
      });
    }
  }

  // Build icon registry from the cards on the page
  document.querySelectorAll("#conditions .ccard").forEach(function (card) {
    var h3 = card.querySelector("h3");
    if (h3) REG[h3.textContent.trim()] = iconOf(card, ".ccard__icon svg");
  });
  document.querySelectorAll("#services .scard").forEach(function (card) {
    var h3 = card.querySelector("h3");
    if (h3) REG[h3.textContent.trim()] = iconOf(card, ".scard__icon svg");
  });

  // Wire CONDITION cards
  document.querySelectorAll("#conditions .ccard").forEach(function (card) {
    var h3 = card.querySelector("h3");
    if (!h3) return;
    var name = h3.textContent.trim();
    if (!CONDITIONS[name]) return;
    card.addEventListener("click", function (e) { e.preventDefault(); openByName(name); });
  });

  // Wire SERVICE / TREATMENT cards
  document.querySelectorAll("#services .scard").forEach(function (card) {
    var h3 = card.querySelector("h3");
    if (!h3) return;
    var name = h3.textContent.trim();
    if (!SERVICE[name]) return; // "View All Services" → keeps its normal link
    card.addEventListener("click", function (e) { e.preventDefault(); openByName(name); });
  });

  overlay.querySelector(".cmodal__close").addEventListener("click", closeModal);
  overlay.addEventListener("mousedown", function (e) {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) closeModal();
  });
})();
