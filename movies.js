(() => {
  const grid = document.getElementById("movie-grid");
  const status = document.getElementById("status");
  const form = document.getElementById("search-form");
  const input = document.getElementById("search");
  const searchButton = document.getElementById("search-btn");
  const more = document.getElementById("more");
  const player = document.getElementById("player");
  const frame = document.getElementById("movie-frame");
  const title = document.getElementById("playing-title");
  const meta = document.getElementById("movie-meta");
  let page = 1;
  let query = "";
  let busy = false;

  function safeText(value) { return String(value || "").replace(/[<>]/g, ""); }
  function makeCard(movie) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "movie";
    button.setAttribute("aria-label", "Play " + safeText(movie.title));
    const image = document.createElement("img");
    image.className = "poster";
    image.loading = "lazy";
    image.alt = "";
    image.src = movie.poster;
    image.onerror = () => {
      const fallback = document.createElement("div");
      fallback.className = "poster-fallback";
      fallback.textContent = "🎞️";
      image.replaceWith(fallback);
    };
    const info = document.createElement("span");
    info.className = "movie-info";
    const name = document.createElement("span");
    name.className = "movie-title";
    name.textContent = safeText(movie.title);
    const year = document.createElement("span");
    year.className = "movie-year";
    year.textContent = [safeText(movie.year), safeText(movie.creator)].filter(Boolean).join(" · ") || "Open-license film";
    info.append(name, year);
    button.append(image, info);
    button.addEventListener("click", () => playMovie(movie.identifier));
    return button;
  }

  async function load(reset = false) {
    if (busy) return;
    busy = true;
    searchButton.disabled = true;
    more.disabled = true;
    status.textContent = "Finding and checking open-license films…";
    if (reset) { page = 1; grid.replaceChildren(); }
    try {
      const params = new URLSearchParams({ q: query, page: String(page) });
      const response = await fetch("/api/movies?" + params.toString(), { headers: { Accept: "application/json" } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load movies.");
      const fragment = document.createDocumentFragment();
      data.movies.forEach(movie => fragment.append(makeCard(movie)));
      grid.append(fragment);
      status.textContent = grid.children.length
        ? "Showing " + grid.children.length + " feature-film matches · Internet Archive"
        : "No matching films found. Try another title.";
      more.hidden = data.movies.length === 0 || page * 24 >= data.total;
      if (data.notice) status.title = data.notice;
    } catch (error) {
      status.textContent = error.message || "Movie library unavailable. Try again.";
      more.hidden = true;
    } finally {
      busy = false;
      searchButton.disabled = false;
      more.disabled = false;
    }
  }

  async function playMovie(identifier) {
    status.textContent = "Checking the film's license details…";
    try {
      const response = await fetch("/api/movies?id=" + encodeURIComponent(identifier), { headers: { Accept: "application/json" } });
      const data = await response.json();
      if (!response.ok || !data.movie) throw new Error(data.error || "This movie cannot be played.");
      const movie = data.movie;
      title.textContent = movie.title;
      meta.textContent = (movie.year || "Year unknown") + (movie.creator ? " · " + movie.creator : "") + " · License: " + movie.license;
      const link = document.createElement("a");
      link.className = "archive-link";
      link.href = movie.details;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "View source and full rights metadata";
      meta.append(" · ", link);
      frame.src = movie.embed;
      player.hidden = false;
      player.scrollIntoView({ behavior: "smooth", block: "start" });
      status.textContent = "Ready to watch: " + movie.title;
    } catch (error) {
      status.textContent = error.message || "Unable to verify this title.";
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    query = input.value.trim();
    load(true);
  });
  more.addEventListener("click", () => { page += 1; load(false); });
  document.getElementById("close-player").addEventListener("click", () => {
    frame.src = "about:blank";
    player.hidden = true;
  });
  load(true);
})();
