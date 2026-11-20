/* CXRSO sidebar rebuild — Stage 1: read-only category discovery + native filter bridge */
(function(){
  "use strict";
  const KEY="cxrso-sidebar-collapsed-v1";
  const THEME_KEY="cxrso-sidebar-theme-v1";
  const WALL_KEY="cxrso-sidebar-wallpaper-v1";
  function readSetting(key){try{return localStorage.getItem(key);}catch(_){return null;}}
  function writeSetting(key,value){try{localStorage.setItem(key,value);}catch(_){}}
  const ICONS={all:"⌂",featured:"✦",port:"🧩",tools:"🛠️",emulator:"🎮",nes:"🕹️",nds:"🎲",flash:"⚡",dos:"💾",fnf:"🎵",psx:"🎯",gba:"🎮",n64:"🟣"};
  function init(){
    if(document.getElementById("cxrso-sidebar")) return;
    // Remove an accidental standalone slash-n text node if one is present.
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    const stray=[];while(walker.nextNode()){if(walker.currentNode.nodeValue.trim()==="/n")stray.push(walker.currentNode);}
    stray.forEach(node=>node.parentNode&&node.parentNode.removeChild(node));
    const nativeFilter=document.getElementById("filterOptions");
    const nativeSearch=document.getElementById("searchBar");
    const sidebar=document.createElement("aside");
    sidebar.id="cxrso-sidebar";
    sidebar.setAttribute("aria-label","Game center navigation");
    sidebar.innerHTML='<div class="cxrso-side-head"><div class="cxrso-side-brand">CXRSO <span>LIBRARY</span></div><button class="cxrso-side-toggle" type="button" aria-label="Collapse sidebar" title="Collapse sidebar">‹</button></div><section class="cxrso-side-section"><div class="cxrso-side-label">Library</div><nav class="cxrso-side-nav" id="cxrso-side-primary"><button class="cxrso-side-link" type="button" data-action="all" aria-current="true"><span class="cxrso-side-icon">⌂</span><span class="cxrso-side-name">All games</span></button><button class="cxrso-side-link" type="button" data-action="featured"><span class="cxrso-side-icon">✦</span><span class="cxrso-side-name">Featured</span></button></nav></section><section class="cxrso-side-section" style="flex:1;min-height:0"><div class="cxrso-side-label">Categories</div><nav class="cxrso-side-nav" id="cxrso-side-categories" aria-label="Game categories"><div class="cxrso-side-empty">Loading categories…</div></nav></section><section class="cxrso-side-section"><div class="cxrso-side-label">Appearance</div><div class="cxrso-appearance"><label for="cxrso-side-theme">Accent theme</label><select id="cxrso-side-theme"><option value="maroon">CXRSO Maroon</option><option value="ocean">Ocean Blue</option><option value="violet">Electric Violet</option><option value="green">Neon Green</option><option value="orange">Solar Orange</option><option value="pink">Hot Pink</option></select><label for="cxrso-side-wallpaper">Background</label><select id="cxrso-side-wallpaper"><option value="ambient">Ambient Glow</option><option value="grid">Subtle Grid</option><option value="clean">Clean Dark</option></select></div></section><div class="cxrso-side-footer">Your game library · CXRSO</div>';
    document.body.appendChild(sidebar);
    const mobile=document.createElement("button");mobile.id="cxrso-side-mobile";mobile.type="button";mobile.textContent="☰";mobile.setAttribute("aria-label","Open game navigation");document.body.appendChild(mobile);
    const themeSelect=sidebar.querySelector("#cxrso-side-theme");
    const wallpaperSelect=sidebar.querySelector("#cxrso-side-wallpaper");
    const allowedThemes=["maroon","ocean","violet","green","orange","pink"];
    const allowedWallpapers=["ambient","grid","clean"];
    function applyTheme(value,save){const theme=allowedThemes.includes(value)?value:"maroon";document.body.dataset.cxrsoTheme=theme;themeSelect.value=theme;if(save)writeSetting(THEME_KEY,theme);}
    function applyWallpaper(value,save){const wallpaper=allowedWallpapers.includes(value)?value:"ambient";document.body.dataset.cxrsoWallpaper=wallpaper;wallpaperSelect.value=wallpaper;if(save)writeSetting(WALL_KEY,wallpaper);}
    applyTheme(readSetting(THEME_KEY),false);
    applyWallpaper(readSetting(WALL_KEY),false);
    themeSelect.addEventListener("change",()=>applyTheme(themeSelect.value,true));
    wallpaperSelect.addEventListener("change",()=>applyWallpaper(wallpaperSelect.value,true));
    const collapsed=readSetting(KEY)!=="false";
    document.body.classList.toggle("cxrso-sidebar-collapsed",collapsed);
    document.body.classList.toggle("cxrso-sidebar-expanded",!collapsed);
    function setCollapsed(value){document.body.classList.toggle("cxrso-sidebar-collapsed",value);document.body.classList.toggle("cxrso-sidebar-expanded",!value);writeSetting(KEY,String(value));const b=sidebar.querySelector(".cxrso-side-toggle");b.textContent=value?"›":"‹";b.setAttribute("aria-label",value?"Expand sidebar":"Collapse sidebar");}
    setCollapsed(collapsed);
    sidebar.querySelector(".cxrso-side-toggle").addEventListener("click",()=>setCollapsed(!document.body.classList.contains("cxrso-sidebar-collapsed")));
    mobile.setAttribute("aria-expanded","false");mobile.setAttribute("aria-controls","cxrso-sidebar");mobile.addEventListener("click",()=>{const opened=document.body.classList.toggle("cxrso-sidebar-mobile-open");mobile.setAttribute("aria-expanded",String(opened));});
    function closeMobile(){document.body.classList.remove("cxrso-sidebar-mobile-open");mobile.setAttribute("aria-expanded","false");}
    document.addEventListener("click",e=>{if(document.body.classList.contains("cxrso-sidebar-mobile-open")&&!sidebar.contains(e.target)&&!mobile.contains(e.target))closeMobile();});
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&document.body.classList.contains("cxrso-sidebar-mobile-open")){closeMobile();mobile.focus();}});
    function markActive(button){sidebar.querySelectorAll(".cxrso-side-link").forEach(b=>b.removeAttribute("aria-current"));if(button)button.setAttribute("aria-current","page");}
    function syncActiveFromNative(){if(!nativeFilter)return;const selected=nativeFilter.value;const button=selected==="none"?sidebar.querySelector('[data-action="all"]'):Array.from(categoryNav.querySelectorAll("[data-tag]")).find(b=>b.dataset.tag===selected);markActive(button);}
    if(nativeFilter)nativeFilter.addEventListener("change",syncActiveFromNative);
    sidebar.addEventListener("click",e=>{
      const button=e.target.closest(".cxrso-side-link");if(!button)return;markActive(button);
      if(button.dataset.action==="featured"){const featured=document.getElementById("featuredZonesWrapper");if(featured){featured.open=true;featured.scrollIntoView({behavior:"smooth",block:"start"});}closeMobile();return;}
      if(!nativeFilter||!nativeSearch)return;
      nativeSearch.value="";
      nativeSearch.dispatchEvent(new Event("input",{bubbles:true}));
      nativeFilter.value=button.dataset.tag||"none";
      nativeFilter.dispatchEvent(new Event("change",{bubbles:true}));
      const all=document.getElementById("allZonesWrapper");if(all){all.open=true;all.scrollIntoView({behavior:"smooth",block:"start"});}
      closeMobile();
    });
    const categoryNav=document.getElementById("cxrso-side-categories");
    function syncCategories(){
      if(!nativeFilter)return;
      const options=Array.from(nativeFilter.options).filter(o=>o.value&&o.value!=="none");
      if(!options.length){categoryNav.innerHTML='<div class="cxrso-side-empty">Categories will appear when the game list loads.</div>';return;}
      const current=new Set(Array.from(categoryNav.querySelectorAll("[data-tag]")).map(b=>b.dataset.tag));
      const next=new Set(options.map(o=>o.value));
      if(current.size===next.size&&Array.from(next).every(v=>current.has(v))){refreshCounts();return;}
      categoryNav.innerHTML="";
      options.forEach(option=>{
        const b=document.createElement("button");b.type="button";b.className="cxrso-side-link";b.dataset.tag=option.value;
        const icon=document.createElement("span");icon.className="cxrso-side-icon";icon.textContent=ICONS[option.value]||"◈";
        const name=document.createElement("span");name.className="cxrso-side-name";name.textContent=option.textContent||option.value;
        b.append(icon,name);categoryNav.appendChild(b);
      });
      refreshCounts();
    }
    function refreshCounts(){
      // The canonical category membership is zone.special in the original data.
      // Do not infer category totals from rendered cards.
    }
    if(nativeFilter){
      new MutationObserver(syncCategories).observe(nativeFilter,{childList:true,subtree:true,attributes:true});
      syncCategories();
      syncActiveFromNative();
      const gameContainer=document.getElementById("container");
      if(gameContainer)new MutationObserver(refreshCounts).observe(gameContainer,{childList:true,subtree:true,attributes:true,attributeFilter:["data-tags","data-tag"]});
      refreshCounts();
    }
    window.addEventListener("storage",e=>{if(e.key===KEY)setCollapsed(e.newValue!=="false");if(e.key===THEME_KEY)applyTheme(e.newValue,false);if(e.key===WALL_KEY)applyWallpaper(e.newValue,false);});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();