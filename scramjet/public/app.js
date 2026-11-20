"use strict";
const loginPanel=document.getElementById("login-panel");
const browserPanel=document.getElementById("browser-panel");
const loginForm=document.getElementById("login-form");
const loginError=document.getElementById("login-error");
const browseForm=document.getElementById("browse-form");
const address=document.getElementById("address");
const browseError=document.getElementById("browse-error");
const view=document.getElementById("view");
const tabsList=document.getElementById("tabs-list");
const backButton=document.getElementById("back");
const forwardButton=document.getElementById("forward");
const reloadButton=document.getElementById("reload");
const homeButton=document.getElementById("home");
const loadingIndicator=document.getElementById("loading-indicator");
const newTabButton=document.getElementById("new-tab");
const {ScramjetController}=$scramjetLoadController();
const scramjet=new ScramjetController({files:{wasm:"/scram/scramjet.wasm.wasm",all:"/scram/scramjet.all.js",sync:"/scram/scramjet.sync.js"}});
scramjet.init();
const connection=new BareMux.BareMuxConnection("/baremux/worker.js");
const MAX_TABS=8;
let tabs=[];
let activeTabId=null;
let nextTabId=1;
let transportReady=null;

function activeTab(){return tabs.find(tab=>tab.id===activeTabId)||null}
function setStatus(message){loadingIndicator.textContent=message||""}
function setNavState(){
  const tab=activeTab();
  backButton.disabled=!tab||tab.historyIndex<=0;
  forwardButton.disabled=!tab||tab.historyIndex<0||tab.historyIndex>=tab.history.length-1;
  reloadButton.disabled=!tab||!tab.url;
}
function renderTabs(){
  tabsList.replaceChildren();
  tabs.forEach(tab=>{
    const button=document.createElement("button");
    button.type="button";button.className="browser-tab"+(tab.id===activeTabId?" active":"");
    button.setAttribute("role","tab");button.setAttribute("aria-selected",String(tab.id===activeTabId));
    button.title=tab.title;
    const icon=document.createElement("span");icon.textContent="🌐";
    const title=document.createElement("span");title.className="browser-tab-title";title.textContent=tab.title;
    const close=document.createElement("span");close.className="browser-tab-close";close.textContent="×";close.setAttribute("role","button");close.setAttribute("aria-label","Close tab");
    button.append(icon,title,close);
    button.addEventListener("click",event=>{
      if(event.target===close){event.stopPropagation();closeTab(tab.id);return}
      activateTab(tab.id);
    });
    tabsList.appendChild(button);
  });
  newTabButton.disabled=tabs.length>=MAX_TABS;
  newTabButton.title=tabs.length>=MAX_TABS?"Maximum of 8 tabs":"New tab";
}
function updateActiveView(){
  const tab=activeTab();if(!tab)return;
  tabs.forEach(item=>{if(item.frame)item.frame.hidden=item.id!==activeTabId});
  let start=view.querySelector(".start-page");
  if(tab.frame){
    if(start)start.remove();
    if(tab.frame.parentElement!==view)view.appendChild(tab.frame.frame||tab.frame);
    tab.frame.hidden=false;
  }else{
    if(!start){renderStartPage();start=view.querySelector(".start-page")}
    if(start)start.hidden=false;
  }
  address.value=tab.url||"";
  setNavState();renderTabs();setStatus("");
}
function renderStartPage(){
  const prior=view.querySelector(".start-page");if(prior)prior.remove();
  const page=document.createElement("div");page.className="start-page";
  page.innerHTML='<div class="start-mark">C</div><p class="start-eyebrow">CXRSO BROWSER</p><h1>Where to?</h1><p>Search the web or enter a website address above.</p><form id="start-form" class="start-search"><input id="start-address" placeholder="Search Google or enter a URL" autocomplete="off" aria-label="Search the web"><button type="submit">Search</button></form><div class="quick-links"><a href="https://www.google.com/" data-url="https://www.google.com/">Google</a><a href="https://www.youtube.com/" data-url="https://www.youtube.com/">YouTube</a><a href="https://www.wikipedia.org/" data-url="https://www.wikipedia.org/">Wikipedia</a></div>';
  view.appendChild(page);
  page.querySelector("#start-form").addEventListener("submit",event=>{event.preventDefault();navigate(page.querySelector("#start-address").value,true)});
  page.querySelectorAll("[data-url]").forEach(link=>link.addEventListener("click",event=>{event.preventDefault();navigate(link.dataset.url,true)}));
}
function createTab(){
  if(tabs.length>=MAX_TABS){setStatus("You can have up to 8 tabs open.");return null}
  const tab={id:nextTabId++,title:"New tab",url:"",history:[],historyIndex:-1,frame:null};
  tabs.push(tab);activeTabId=tab.id;updateActiveView();return tab;
}
function activateTab(id){if(!tabs.some(tab=>tab.id===id))return;activeTabId=id;updateActiveView()}
function closeTab(id){
  const index=tabs.findIndex(tab=>tab.id===id);if(index<0)return;
  const [removed]=tabs.splice(index,1);if(removed.frame)removed.frame.remove();
  if(!tabs.length){createTab();return}
  if(activeTabId===id)activeTabId=tabs[Math.max(0,index-1)].id;
  updateActiveView();
}
async function prepareTransport(){
  if(!transportReady)transportReady=(async()=>{
    await registerSW();
    const wispUrl=(location.protocol==="https:"?"wss":"ws")+"://"+location.host+"/wisp/";
    if((await connection.getTransport())!=="/libcurl/index.mjs")await connection.setTransport("/libcurl/index.mjs",[{websocket:wispUrl}]);
  })();
  try{await transportReady}catch(error){transportReady=null;throw error}
}
async function navigate(input,addHistory=true){
  const tab=activeTab();if(!tab)return;
  const target=search(input,"https://www.google.com/search?q=%s");
  if(!target)return;
  let parsed;try{parsed=new URL(target);if(!["http:","https:"].includes(parsed.protocol))throw new Error()}catch{browseError.textContent="Enter a valid HTTP or HTTPS address.";return}
  browseError.textContent="";setStatus("Connecting…");
  try{
    await prepareTransport();
    if(tab.id!==activeTabId){activateTab(tab.id)}
    if(!tab.frame){
      tab.frame=scramjet.createFrame();tab.frame.frame.className="proxy-frame";tab.frame.frame.title="CXRSO Browser tab";tab.frame.frame.hidden=true;
      tab.frame.frame.addEventListener("load",()=>{if(activeTabId===tab.id)setStatus("Page loaded")});
      view.appendChild(tab.frame.frame);
    }
    if(addHistory){tab.history=tab.history.slice(0,tab.historyIndex+1);tab.history.push(target);tab.historyIndex=tab.history.length-1}
    tab.url=target;tab.title=parsed.hostname.replace(/^www\./,"")||"Web page";
    updateActiveView();setStatus("Loading "+tab.title+"…");
    tab.frame.go(target);address.value=target;
  }catch(error){browseError.textContent=error.message||"Could not open that address.";setStatus("Connection failed")}
}
function goHistory(direction){
  const tab=activeTab();if(!tab)return;
  const next=tab.historyIndex+direction;if(next<0||next>=tab.history.length)return;
  tab.historyIndex=next;const target=tab.history[next];tab.url=target;
  try{tab.title=new URL(target).hostname.replace(/^www\./,"")}catch{}
  updateActiveView();setStatus("Loading "+tab.title+"…");
  try{tab.frame.go(target)}catch(error){browseError.textContent=error.message||"Could not navigate."}
}
async function openBrowser(){
  const response=await fetch("/health",{cache:"no-store"});
  if(!response.ok)throw new Error("The browser service is unavailable.");
  const session=await fetch("/session",{cache:"no-store",credentials:"same-origin"});
  if(!session.ok)return;
  loginPanel.classList.add("hidden");browserPanel.classList.remove("hidden");
  if(!tabs.length)createTab();else updateActiveView();
}
loginForm.addEventListener("submit",async event=>{
  event.preventDefault();loginError.textContent="";
  const button=loginForm.querySelector("button");button.disabled=true;button.textContent="Checking…";
  try{
    const response=await fetch("/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:document.getElementById("password").value})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to sign in.");
    await prepareTransport();loginPanel.classList.add("hidden");browserPanel.classList.remove("hidden");createTab();
  }catch(error){loginError.textContent=error.message||"Sign-in failed."}
  finally{button.disabled=false;button.textContent="Unlock browser"}
});
browseForm.addEventListener("submit",event=>{event.preventDefault();navigate(address.value,true)});
backButton.addEventListener("click",()=>goHistory(-1));
forwardButton.addEventListener("click",()=>goHistory(1));
reloadButton.addEventListener("click",()=>{const tab=activeTab();if(tab?.url&&tab.frame){setStatus("Reloading…");tab.frame.go(tab.url)}});
homeButton.addEventListener("click",()=>{
  const tab=activeTab();if(!tab)return;
  if(tab.frame){tab.frame.remove();tab.frame=null}
  tab.url="";tab.title="New tab";tab.history=[];tab.historyIndex=-1;updateActiveView();
});
newTabButton.addEventListener("click",()=>{const tab=createTab();if(tab)address.focus()});
document.getElementById("menu").addEventListener("click",()=>{browseError.textContent="CXRSO Browser · Scramjet engine · Up to 8 tabs · Some websites may restrict proxy access."});
document.addEventListener("keydown",event=>{
  const key=event.key.toLowerCase(),mod=event.ctrlKey||event.metaKey;
  if(mod&&key==="l"){event.preventDefault();address.focus();address.select()}
  else if(mod&&key==="t"){event.preventDefault();createTab();address.focus()}
  else if(mod&&key==="w"){event.preventDefault();if(activeTab())closeTab(activeTabId)}
  else if(mod&&key==="r"){event.preventDefault();reloadButton.click()}
  else if(event.altKey&&key==="arrowleft"){event.preventDefault();goHistory(-1)}
  else if(event.altKey&&key==="arrowright"){event.preventDefault();goHistory(1)}
  else if(key==="escape"&&document.activeElement===address){address.blur()}
});
openBrowser().catch(error=>{setStatus(error.message||"Browser service unavailable.")});
