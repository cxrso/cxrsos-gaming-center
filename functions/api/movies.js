const ARCHIVE_SEARCH = "https://archive.org/advancedsearch.php";
const ARCHIVE_META = "https://archive.org/metadata/";
const ALLOWED_COLLECTIONS = new Set(["feature_films", "prelinger", "moviesandfilms"]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "self"
    }
  });
}

function clean(value, max = 240) {
  return String(value || "").replace(/[<>\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function isOpenLicense(value) {
  try {
    const url = new URL(String(value || ""));
    return url.hostname === "creativecommons.org" || url.hostname === "www.creativecommons.org";
  } catch {
    return false;
  }
}

async function getMetadata(identifier) {
  if (!/^[a-zA-Z0-9._-]{1,120}$/.test(identifier)) return null;
  const response = await fetch(ARCHIVE_META + encodeURIComponent(identifier), {
    headers: { "Accept": "application/json" }
  });
  if (!response.ok) return null;
  const data = await response.json();
  const meta = data.metadata || {};
  const license = meta.licenseurl || meta.license_url || "";
  const collection = Array.isArray(meta.collection) ? meta.collection : [meta.collection].filter(Boolean);
  if (!isOpenLicense(license) || !collection.some(item => ALLOWED_COLLECTIONS.has(item))) return null;
  return {
    identifier,
    title: clean(meta.title || identifier),
    year: clean(meta.year, 12),
    creator: clean(meta.creator || meta.director, 100),
    description: clean(Array.isArray(meta.description) ? meta.description.join(" ") : meta.description, 700),
    license,
    collection: collection.filter(item => ALLOWED_COLLECTIONS.has(item)),
    embed: "https://archive.org/embed/" + encodeURIComponent(identifier),
    details: "https://archive.org/details/" + encodeURIComponent(identifier),
    poster: "https://archive.org/services/img/" + encodeURIComponent(identifier)
  };
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const identifier = clean(url.searchParams.get("id"), 120);
  try {
    if (identifier) {
      const movie = await getMetadata(identifier);
      if (!movie) return json({ error: "This title does not have verifiable open-license metadata in an approved collection." }, 404);
      return json({ movie });
    }

    const term = clean(url.searchParams.get("q"), 100);
    const page = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
    const safeTerm = term.replace(/[+\-&|!(){}\[\]^"~*?:\\/]/g, " ").replace(/\s+/g, " ").trim();
    const clauses = [
      "mediatype:movies",
      "(collection:feature_films OR collection:prelinger OR collection:moviesandfilms)",
      "(licenseurl:https://creativecommons.org* OR licenseurl:http://creativecommons.org*)"
    ];
    if (safeTerm) clauses.push('title:(' + safeTerm.split(" ").map(word => '"' + word + '"').join(" AND ") + ')');
    const searchUrl = new URL(ARCHIVE_SEARCH);
    searchUrl.searchParams.set("q", clauses.join(" AND "));
    for (const field of ["identifier", "title", "year", "creator", "licenseurl"]) searchUrl.searchParams.append("fl[]", field);
    searchUrl.searchParams.set("rows", "24");
    searchUrl.searchParams.set("page", String(page));
    searchUrl.searchParams.set("output", "json");
    searchUrl.searchParams.set("sort[]", "downloads desc");

    const response = await fetch(searchUrl, { headers: { "Accept": "application/json" } });
    if (!response.ok) return json({ error: "The movie archive is temporarily unavailable. Try again shortly." }, 502);
    const data = await response.json();
    const docs = data.response?.docs || [];
    const verified = await Promise.all(docs.map(async doc => {
      if (!doc.identifier || !isOpenLicense(doc.licenseurl)) return null;
      return getMetadata(doc.identifier);
    }));
    const movies = verified.filter(Boolean);
    return json({
      movies,
      page,
      total: Number(data.response?.numFound || 0),
      source: "Internet Archive",
      notice: "Titles are filtered to Creative Commons-marked items in selected film collections. License metadata is supplied by uploaders and is not an independent legal determination."
    });
  } catch {
    return json({ error: "Could not load the movie archive right now. Please try again." }, 502);
  }
}
