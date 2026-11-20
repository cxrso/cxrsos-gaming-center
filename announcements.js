(() => {
  "use strict";

  const style = document.createElement("style");
  style.textContent = `
    #cxrso-updates-trigger {
      position: fixed; right: 20px; bottom: 20px; z-index: 99990;
      display: inline-flex; align-items: center; gap: 9px;
      padding: 12px 17px; border: 1px solid #7d2944; border-radius: 999px;
      background: #170b10; color: #fff; font: 700 14px/1.2 system-ui, sans-serif;
      box-shadow: 0 8px 28px #0009; cursor: pointer;
      transition: transform .18s ease, background .18s ease;
    }
    #cxrso-updates-trigger:hover { transform: translateY(-2px); background: #35101f; }
    #cxrso-updates-trigger:focus-visible, #cxrso-updates-close:focus-visible {
      outline: 3px solid #ff789c; outline-offset: 3px;
    }
    #cxrso-updates-trigger .cxrso-updates-icon { font-size: 19px; }
    #cxrso-updates-backdrop {
      position: fixed; inset: 0; z-index: 99991; display: none;
      align-items: center; justify-content: center; padding: 18px;
      background: #000b; backdrop-filter: blur(5px);
    }
    #cxrso-updates-backdrop.is-open { display: flex; }
    #cxrso-updates-dialog {
      width: min(100%, 520px); max-height: min(78vh, 720px); overflow: auto;
      border: 1px solid #653047; border-radius: 20px; background: #160b11;
      color: #f8edf1; box-shadow: 0 24px 80px #000b;
      font-family: system-ui, sans-serif;
    }
    .cxrso-updates-head {
      position: sticky; top: 0; display: flex; align-items: center;
      justify-content: space-between; gap: 12px; padding: 19px 20px;
      border-bottom: 1px solid #482033; background: #1d0d15;
    }
    .cxrso-updates-head h2 { margin: 0; font-size: 20px; }
    .cxrso-updates-subtitle { margin: 4px 0 0; color: #c5a8b4; font-size: 12px; }
    #cxrso-updates-close {
      width: 36px; height: 36px; flex: 0 0 36px; border: 1px solid #623047;
      border-radius: 10px; background: #2a111d; color: white; font-size: 22px;
      cursor: pointer;
    }
    #cxrso-updates-list { display: grid; gap: 12px; padding: 18px; }
    .cxrso-update-item {
      padding: 15px; border: 1px solid #472235; border-radius: 13px;
      background: #21101a;
    }
    .cxrso-update-meta {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
      margin-bottom: 7px; color: #d9a7bb; font-size: 11px; font-weight: 700;
      letter-spacing: .06em; text-transform: uppercase;
    }
    .cxrso-update-tag {
      padding: 3px 8px; border: 1px solid #71314c; border-radius: 999px;
      color: #ffb4cb; letter-spacing: 0; text-transform: none;
    }
    .cxrso-update-item h3 { margin: 0 0 5px; font-size: 16px; }
    .cxrso-update-item p { margin: 0; color: #d0bdc5; font-size: 13px; line-height: 1.55; }
    .cxrso-updates-empty { padding: 20px; color: #c5a8b4; text-align: center; }
    #cxrso-big-announcement {
      display:none; width:100%; min-height:46px; padding:11px 16px;
      border:0; border-bottom:1px solid #d6d6d6; border-radius:0;
      background:#fff; color:#111; font:900 14px/1.3 system-ui,sans-serif;
      letter-spacing:.07em; text-align:center; cursor:pointer;
    }
    #cxrso-big-announcement.is-visible { display:block; }
    #cxrso-big-announcement:hover { background:#ededed; }
    #cxrso-big-announcement:focus-visible { outline:3px solid #a00035; outline-offset:-3px; }
    @media (max-width: 520px) {
      #cxrso-updates-trigger { right: 13px; bottom: 13px; padding: 11px 14px; }
      #cxrso-updates-backdrop { padding: 10px; }
    }
  `;
  document.head.appendChild(style);

  const trigger = document.createElement("button");
  trigger.id = "cxrso-updates-trigger";
  trigger.type = "button";
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-controls", "cxrso-updates-dialog");
  trigger.innerHTML = '<span class="cxrso-updates-icon" aria-hidden="true">📢</span><span>Latest fixes</span>';

  const backdrop = document.createElement("div");
  backdrop.id = "cxrso-updates-backdrop";
  backdrop.innerHTML = `
    <section id="cxrso-updates-dialog" role="dialog" aria-modal="true"
      aria-labelledby="cxrso-updates-title" tabindex="-1">
      <header class="cxrso-updates-head">
        <div><h2 id="cxrso-updates-title">📢 Latest fixes &amp; updates</h2>
          <p class="cxrso-updates-subtitle">What's new at CXRSO Gaming Center</p></div>
        <button id="cxrso-updates-close" type="button" aria-label="Close updates">×</button>
      </header>
      <div id="cxrso-updates-list" aria-live="polite"><div class="cxrso-updates-empty">Loading updates…</div></div>
    </section>`;

  document.body.append(trigger, backdrop);

  const dialog = backdrop.querySelector("#cxrso-updates-dialog");
  const list = backdrop.querySelector("#cxrso-updates-list");
  const closeButton = backdrop.querySelector("#cxrso-updates-close");

  function close() {
    backdrop.classList.remove("is-open");
    trigger.focus();
  }
  function open() {
    backdrop.classList.add("is-open");
    closeButton.focus();
  }
  trigger.addEventListener("click", open);
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop) close();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && backdrop.classList.contains("is-open")) close();
  });

  fetch("/updates.json", { cache: "no-store" })
    .then(response => {
      if (!response.ok) throw new Error("Could not load updates");
      return response.json();
    })
    .then(updates => {
      const big = Array.isArray(updates) ? updates.find(update => update && update.bigAnnouncement === true) : null;
      if (big && !document.getElementById("cxrso-big-announcement")) {
        const banner = document.createElement("button");
        banner.id = "cxrso-big-announcement";
        banner.type = "button";
        banner.className = "is-visible";
        banner.textContent = "📢BIG ANNOUNCEMENT📢";
        banner.setAttribute("aria-label", "Open the latest big announcement");
        banner.addEventListener("click", () => { window.location.href = "/announcements.html"; });
        document.body.insertBefore(banner, document.body.firstChild);
      }
      list.replaceChildren();
      if (!Array.isArray(updates) || updates.length === 0) {
        list.innerHTML = '<div class="cxrso-updates-empty">No updates posted yet. Check back soon!</div>';
        return;
      }
      updates.forEach(update => {
        const article = document.createElement("article");
        article.className = "cxrso-update-item";
        const meta = document.createElement("div");
        meta.className = "cxrso-update-meta";
        const date = document.createElement("time");
        date.textContent = update.date || "";
        const tag = document.createElement("span");
        tag.className = "cxrso-update-tag";
        tag.textContent = update.type || "Update";
        meta.append(date, tag);
        const title = document.createElement("h3");
        title.textContent = update.title || "Site update";
        const description = document.createElement("p");
        description.textContent = update.description || "";
        article.append(meta, title, description);
        list.appendChild(article);
      });
    })
    .catch(() => {
      list.innerHTML = '<div class="cxrso-updates-empty">Updates could not load right now. Please try again later.</div>';
    });
})();
