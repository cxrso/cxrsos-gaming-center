"use strict";
const loginPanel=document.getElementById("login-panel");
const browserPanel=document.getElementById("browser-panel");
const loginForm=document.getElementById("login-form");
const loginError=document.getElementById("login-error");
const browseForm=document.getElementById("browse-form");
const address=document.getElementById("address");
const browseError=document.getElementById("browse-error");
const view=document.getElementById("view");
const backButton=document.getElementById("back");
const forwardButton=document.getElementById("forward");
const reloadButton=document.getElementById("reload");
const homeButton=document.getElementById("home");
const tabTitle=document.getElementById("tab-title");
const {ScramjetController}=$scramjetLoadController();
const scramjet=new ScramjetController({files:{wasm:"/scram/scramjet.wasm.wasm",all:"/scram/scramjet.all.js",sync:"/scram/scramjet.sync.js"}});
scramjet.init();
const connection=new BareMux.BareMuxConnection("/baremux/worker.js");
let activeFrame=null;
let historyStack=[];
let historyIndex=-1;
let currentUrl="";
let loading=false;

function setNavState(){
  backButton.disabled=historyIndex<=0;
  forwardButton.disabled=historyIndex<0||historyIndex>=historyStack.length-1;
  reloadButton.disabled=!currentUrl;
}
function showHome(){
  currentUrl="";
  tabTitle.textContent="New tab";
  address.value="";
  activeFrame=null;
  view.innerHTML='<div class="start-page"><div class="start-mark">C</div><p class="start-eyebrow">CXRSO BROWSER</p><h1>Where to?</h1><p>Search the web or enter a website address above.</p><form id="start-form" class="start-search"><input id="start-address" placeholder="Search Google or enter a URL" autocomplete="off" aria-label="Search the web"><button type="submit">Search</button></form><div class="quick-links"><a href="https://www.google.com/" data-url="https://www.google.com/">Google</a><a href="https://www.youtube.com/" data-url="https://www.youtube.com/">YouTube</a><a href="https://www.wikipedia.org/" data-url="https://www.wikipedia.org/">Wikipedia</a></div></div>';
  document.getElementById("start-form").addEventListener("submit",e=>{e.preventDefault();navigate(document.getElementById("start-address").value,true)});
  view.querySelectorAll("[data-url]").forEach(link=>link.addEventListener("click",e=>{e.preventDefault();navigate(link.dataset.url,true)}));
  setNavState();
}
async function prepareTransport(){
  await registerSW();
  const wispUrl=(location.protocol==="https:"?"wss":"ws")+"://"+location.host+"/wisp/";
  if((await connection.getTransport())!=="/libcurl/index.mjs")await connection.setTransport("/libcurl/index.mjs",[{websocket:wispUrl}]);
}
async function navigate(input,addHistory){
  const target=search(input,"https://www.google.com/search?q=%s");
  if(!target||loading)return;
  browseError.textContent="";
  loading=true;
  try{
    await prepareTransport();
    if(!activeFrame){
      view.replaceChildren();
      activeFrame=scramjet.createFrame();
      activeFrame.frame.className="proxy-frame";
      activeFrame.frame.title="CXRSO Browser tab";
      view.appendChild(activeFrame.frame);
    }
    activeFrame.go(target);
    currentUrl=target;
    address.value=target;
    try{tabTitle.textContent=new URL(target).hostname.replace(/^www\./,"")}catch{tabTitle.textContent="Web page"}
    if(addHistory){
      historyStack=historyStack.slice(0,historyIndex+1);
      historyStack.push(target);
      historyIndex=historyStack.length-1;
    }
    setNavState();
  }catch(error){browseError.textContent=error.message||"Could not open that address."}
  finally{loading=false}
}
async function openBrowser(){
  const response=await fetch("/health",{credentials:"same-origin"});
  if(!response.ok)return;
  const session=await fetch("/session",{cache:"no-store",credentials:"same-origin"});
  if(!session.ok)return;
  loginPanel.classList.add("hidden");
  browserPanel.classList.remove("hidden");
  showHome();
}
loginForm.addEventListener("submit",async event=>{
  event.preventDefault();loginError.textContent="";
  const button=loginForm.querySelector("button");button.disabled=true;button.textContent="Checking…";
  try{
    const response=await fetch("/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:document.getElementById("password").value})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to sign in.");
    await prepareTransport();loginPanel.classList.add("hidden");browserPanel.classList.remove("hidden");showHome();
  }catch(error){loginError.textContent=error.message||"Sign-in failed."}
  finally{button.disabled=false;button.textContent="Unlock browser"}
});
browseForm.addEventListener("submit",event=>{event.preventDefault();navigate(address.value,true)});
document.getElementById("start-form").addEventListener("submit",event=>{event.preventDefault();navigate(document.getElementById("start-address").value,true)});
backButton.addEventListener("click",()=>{if(historyIndex>0){historyIndex--;navigate(historyStack[historyIndex],false)}});
forwardButton.addEventListener("click",()=>{if(historyIndex<historyStack.length-1){historyIndex++;navigate(historyStack[historyIndex],false)}});
reloadButton.addEventListener("click",()=>{if(currentUrl&&activeFrame)activeFrame.go(currentUrl)});
homeButton.addEventListener("click",showHome);
document.getElementById("new-tab").addEventListener("click",()=>{historyStack=[];historyIndex=-1;showHome();address.focus()});
document.getElementById("menu").addEventListener("click",()=>{browseError.textContent="CXRSO Browser · Scramjet engine · Some websites may restrict proxy access."});
document.addEventListener("keydown",event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="l"){event.preventDefault();address.focus();address.select()}});
openBrowser().catch(()=>{});
