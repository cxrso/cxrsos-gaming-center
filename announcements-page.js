(() => {
  "use strict";
  const list = document.getElementById("cxrso-announcements-list");
  if (!list) return;

  fetch("/updates.json", { cache: "no-store" })
    .then(response => {
      if (!response.ok) throw new Error("Could not load announcements");
      return response.json();
    })
    .then(updates => {
      list.replaceChildren();
      if (!Array.isArray(updates) || updates.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "No announcements yet. Check back soon!";
        list.appendChild(empty);
        return;
      }
      updates.forEach(update => {
        const article = document.createElement("article");
        article.className = "announcement";
        const meta = document.createElement("div");
        meta.className = "meta";
        const date = document.createElement("time");
        date.textContent = update.date || "";
        const type = document.createElement("span");
        type.textContent = update.bigAnnouncement ? "BIG ANNOUNCEMENT" : (update.type || "Update");
        meta.append(date, type);
        const title = document.createElement("h2");
        title.textContent = update.title || "Site update";
        const description = document.createElement("p");
        description.textContent = update.description || "";
        article.append(meta, title, description);
        list.appendChild(article);
      });
    })
    .catch(() => {
      list.textContent = "Announcements could not load right now. Please try again later.";
      list.className = "empty";
    });
})();