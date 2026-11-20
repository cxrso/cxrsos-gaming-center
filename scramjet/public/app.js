"use strict";
const loginPanel = document.getElementById("login-panel");
const browserPanel = document.getElementById("browser-panel");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const browseForm = document.getElementById("browse-form");
const address = document.getElementById("address");
const browseError = document.getElementById("browse-error");
const view = document.getElementById("view");

const { ScramjetController } = $scramjetLoadController();
const scramjet = new ScramjetController({
  files: {
    wasm: "/scram/scramjet.wasm.wasm",
    all: "/scram/scramjet.all.js",
    sync: "/scram/scramjet.sync.js"
  }
});
scramjet.init();
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

async function openBrowser() {
  const response = await fetch("/health", { credentials: "same-origin" });
  if (!response.ok) return;
  const check = await fetch("/login", { method: "OPTIONS" }).catch(() => null);
  // A protected static request is the definitive session check.
  const protectedCheck = await fetch("/app.js", { cache: "no-store", credentials: "same-origin" });
  if (protectedCheck.status === 401) return;
  loginPanel.classList.add("hidden");
  browserPanel.classList.remove("hidden");
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  loginError.textContent = "";
  const button = loginForm.querySelector("button");
  button.disabled = true;
  button.textContent = "Checking…";
  try {
    const response = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: document.getElementById("password").value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to sign in.");
    await registerSW();
    loginPanel.classList.add("hidden");
    browserPanel.classList.remove("hidden");
  } catch (error) {
    loginError.textContent = error.message || "Sign-in failed.";
  } finally {
    button.disabled = false;
    button.textContent = "Unlock browser";
  }
});

browseForm.addEventListener("submit", async event => {
  event.preventDefault();
  browseError.textContent = "";
  const target = search(address.value, "https://www.google.com/search?q=%s");
  try {
    await registerSW();
    const wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
    if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
      await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
    }
    view.replaceChildren();
    const frame = scramjet.createFrame();
    frame.frame.className = "proxy-frame";
    frame.frame.title = "CXRSO Browser tab";
    view.appendChild(frame.frame);
    frame.go(target);
  } catch (error) {
    browseError.textContent = error.message || "Could not open that address.";
  }
});

// If a valid session cookie already exists, skip the login screen.
openBrowser().catch(() => {});
