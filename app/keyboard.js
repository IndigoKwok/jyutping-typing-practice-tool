(() => {
  "use strict";

  if (!window.matchMedia || !window.matchMedia("(pointer: coarse)").matches) return;

  const QWERTY_ROWS = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["z", "x", "c", "v", "b", "n", "m", { label: "⌫", key: "Backspace", wide: true }],
    [{ label: "確認", key: "Enter", wide: true }]
  ];
  const INITIALS = ["b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "ng", "h", "gw", "kw", "w", "z", "c", "s", "j"];
  const NUCLEI = ["aa", "a", "e", "i", "o", "u", "oe", "eo", "yu", "m", "ng"];
  const CODAS = ["i", "u", "m", "n", "ng", "p", "t", "k"];

  const keyboard = document.createElement("div");
  keyboard.className = "vkb";
  keyboard.setAttribute("aria-hidden", "true");
  document.body.appendChild(keyboard);

  let pressed = null;
  const release = () => {
    if (pressed) {
      pressed.classList.remove("pressed");
      pressed = null;
    }
  };

  function makeKey(label, spec) {
    const btn = document.createElement("button");
    btn.type = "button";
    const opts = spec || {};
    btn.className = "vkb-key" + (opts.wide ? " vkb-key-wide" : "") + (opts.cls ? " " + opts.cls : "");
    if (opts.pick) btn.dataset.pick = opts.pick;
    else btn.dataset.key = opts.key || label;
    btn.textContent = label;
    btn.tabIndex = -1;
    return btn;
  }

  function buildQwerty() {
    for (const [rowIndex, row] of QWERTY_ROWS.entries()) {
      const rowEl = document.createElement("div");
      rowEl.className = "vkb-row vkb-row-" + (rowIndex + 1);
      for (const item of row) {
        const spec = typeof item === "string" ? { label: item, key: item } : item;
        rowEl.appendChild(makeKey(spec.label, spec));
      }
      keyboard.appendChild(rowEl);
    }
  }

  function buildSection(label) {
    const section = document.createElement("div");
    section.className = "vkb-section";
    const tag = document.createElement("span");
    tag.className = "vkb-section-label";
    tag.textContent = label;
    const wrap = document.createElement("div");
    wrap.className = "vkb-row-wrap";
    section.appendChild(tag);
    section.appendChild(wrap);
    keyboard.appendChild(section);
    return wrap;
  }

  function buildPicker() {
    const ini = buildSection("聲母");
    INITIALS.forEach((value) => ini.appendChild(makeKey(value, { pick: "initial", cls: "vkb-pick" })));
    const nuc = buildSection("韻腹");
    NUCLEI.forEach((value) => nuc.appendChild(makeKey(value, { pick: "nucleus", cls: "vkb-pick" })));
    const cod = buildSection("韻尾");
    CODAS.forEach((value) => cod.appendChild(makeKey(value, { pick: "coda", cls: "vkb-pick" })));
    const row = document.createElement("div");
    row.className = "vkb-row vkb-confirm-row";
    row.appendChild(makeKey("確認", { pick: "confirm", wide: true }));
    keyboard.appendChild(row);
  }

  function build() {
    const mode = document.body.dataset.kb === "picker" ? "picker" : "qwerty";
    keyboard.dataset.mode = mode;
    keyboard.innerHTML = "";
    if (mode === "picker") buildPicker();
    else buildQwerty();
    window.dispatchEvent(new CustomEvent("vkb-query"));
  }

  keyboard.addEventListener("pointerdown", (event) => {
    const keyEl = event.target.closest(".vkb-key");
    if (!keyEl || keyEl.classList.contains("disabled")) return;
    event.preventDefault();
    release();
    pressed = keyEl;
    keyEl.classList.add("pressed");
    if (keyEl.dataset.pick) {
      window.dispatchEvent(new CustomEvent("vkb-pick", {
        detail: { kind: keyEl.dataset.pick, value: keyEl.textContent }
      }));
    } else {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: keyEl.dataset.key }));
    }
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((type) => {
    keyboard.addEventListener(type, release);
  });
  keyboard.addEventListener("contextmenu", (event) => event.preventDefault());

  window.addEventListener("vkb-state", (event) => {
    const state = (event && event.detail) || {};
    keyboard.querySelectorAll("[data-pick]").forEach((keyEl) => {
      const kind = keyEl.dataset.pick;
      const value = keyEl.textContent;
      keyEl.classList.toggle("on", Boolean(state[kind] && state[kind] === value));
      if (kind === "coda") {
        keyEl.classList.toggle("disabled", state.nucleus === "m" || state.nucleus === "ng");
      }
    });
  });

  new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.attributeName === "data-kb")) build();
  }).observe(document.body, { attributes: true, attributeFilter: ["data-kb"] });

  build();
})();
