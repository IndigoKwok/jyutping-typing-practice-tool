(() => {
  "use strict";

  if (!window.matchMedia || !window.matchMedia("(pointer: coarse)").matches) return;

  const ROWS = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["z", "x", "c", "v", "b", "n", "m", { label: "⌫", key: "Backspace", wide: true }],
    [{ label: "確認", key: "Enter", wide: true }]
  ];

  const keyboard = document.createElement("div");
  keyboard.id = "vkb";
  keyboard.setAttribute("aria-hidden", "true");

  for (const row of ROWS) {
    const rowEl = document.createElement("div");
    rowEl.className = "vkb-row";
    for (const item of row) {
      const spec = typeof item === "string" ? { label: item, key: item } : item;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vkb-key" + (spec.wide ? " vkb-key-wide" : "");
      btn.dataset.key = spec.key;
      btn.textContent = spec.label;
      btn.tabIndex = -1;
      rowEl.appendChild(btn);
    }
    keyboard.appendChild(rowEl);
  }

  let pressed = null;
  const release = () => {
    if (pressed) {
      pressed.classList.remove("pressed");
      pressed = null;
    }
  };

  keyboard.addEventListener("pointerdown", (event) => {
    const keyEl = event.target.closest(".vkb-key");
    if (!keyEl) return;
    event.preventDefault();
    release();
    pressed = keyEl;
    keyEl.classList.add("pressed");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: keyEl.dataset.key }));
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((type) => {
    keyboard.addEventListener(type, release);
  });
  keyboard.addEventListener("contextmenu", (event) => event.preventDefault());

  document.body.appendChild(keyboard);
})();