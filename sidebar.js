/* CXRSO sidebar rebuild — Stage 1: read-only category discovery + native filter bridge */
(function(){
  "use strict";
  const KEY="cxrso-sidebar-collapsed-v1";
  const ICONS={all:"⌂",featured:"✦",port:"🧩",tools:"🛠️",emulator:"🎮",nes:"🕹️",nds:"🎲",flash:"⚡",dos:"💾",fnf:"🎵",psx:"🎯",gba:"🎮",n64:"🟣"};
  function init(){
    if(document.getElementById("cxrso-sidebar")) return;
    const nativeFilter=document.getElementById("filterOptions");
    const nativeSearch=document.getElementById("searchBar");
    const sidebar=document.createElement("aside");
    sidebar.id="cxrso-sidebar";
    sidebar.setAttribute("aria-label","Game center navigation");
    sidebar.innerHTML='<div class="cxrso-side-head"><div class="cxrso-side-brand">CXRSO <span>LIBRARY</span></div><button class="cxrso-side-toggle" type="button" aria-label="Collapse sidebar" title="Collapse sidebar">‹</button></div><section class="cxrso-side-section"><div class="cxrso-side-label">Library</div><nav class="cxrso-side-nav" id="cxrso-side-primary"><button class="cxrso-side-link" type="button" data-action="all" aria-current="true"><span class="cxrso-side-icon">⌂</span><span class="cxrso-side-name">All games</span></button><button class="cxrso-side-link" type="button" data-action="featured"><span class="cxrso-side-icon">✦</span><span class="cxrso-side-name">Featured</span></button></nav></section><section class="cxrso-side-section" style="flex:1;min-height:0"><div class="cxrso-side-label">Categories</div><nav class="cxrso-side-nav" id="cxrso-side-categories" aria-label="Game categories"><div class="cxrso-side-empty">Loading categories…</div></nav></section><div class="cxrso-side-footer">Your game library · CXRSO</div>';
    document.body.appendChild(sidebar);
    const mobile=document.createElement("button");mobile.id="cxrso-side-mobile";mobile.type="button";mobile.textContent="☰";mobile.setAttribute("aria-label","Open game navigation");document.body.appendChild(mobile);
    const collapsed=localStorage.getItem(KEY)!=="false";
    document.body.classList.toggle("cxrso-sidebar-collapsed",collapsed);
    document.body.classList.toggle("cxrso-sidebar-expanded",!collapsed);
    function setCollapsed(value){document.body.classList.toggle("cxrso-sidebar-collapsed",value);document.body.classList.toggle("cxrso-sidebar-expanded",!value);localStorage.setItem(KEY,String(value));const b=sidebar.querySelector(".cxrso-side-toggle");b.textContent=value?"›":"‹";b.setAttribute("aria-label",value?"Expand sidebar":"Collapse sidebar");}
    setCollapsed(collapsed);
    sidebar.querySelector(".cxrso-side-toggle").addEventListener("click",()=>setCollapsed(!document.body.classList.contains("cxrso-sidebar-collapsed")));
    mobile.addEventListener("click",()=>document.body.classList.toggle("cxrso-sidebar-mobile-open"));
    document.addEventListener("click",e=>{if(document.body.classList.contains("cxrso-sidebar-mobile-open")&&!sidebar.contains(e.target)&&!mobile.contains(e.target))document.body.classList.remove("cxrso-sidebar-mobile-open");});
    function markActive(button){sidebar.querySelectorAll(".cxrso-side-link").forEach(b=>b.removeAttribute("aria-current"));button.setAttribute("aria-current","true");}
    sidebar.addEventListener("click",e=>{
      const button=e.target.closest(".cxrso-side-link");if(!button)return;markActive(button);
      if(button.dataset.action==="featured"){const featured=document.getElementById("featuredZonesWrapper");if(featured){featured.open=true;featured.scrollIntoView({behavior:"smooth",block:"start"});}document.body.classList.remove("cxrso-sidebar-mobile-open");return;}
      if(!nativeFilter||!nativeSearch)return;
      nativeSearch.value="";nativeFilter.value="none";nativeFilter.dispatchEvent(new Event("change",{bubbles:true}));
      if(button.dataset.tag){nativeFilter.value=button.dataset.tag;nativeFilter.dispatchEvent(new Event("change",{bubbles:true}));}
      const all=document.getElementById("allZonesWrapper");if(all){all.open=true;all.scrollIntoView({behavior:"smooth",block:"start"});}
      document.body.classList.remove("cxrso-sidebar-mobile-open");
    });
    const categoryNav=document.getElementById("cxrso-side-categories");
    function syncCategories(){
      if(!nativeFilter)return;
      const options=Array.from(nativeFilter.options).filter(o=>o.value&&o.value!=="none");
      if(!options.length){categoryNav.innerHTML='<div class="cxrso-side-empty">Categories will appear when the game list loads.</div>';return;}
      const current=new Set(Array.from(categoryNav.querySelectorAll("[data-tag]")).map(b=>b.dataset.tag));
      const next=new Set(options.map(o=>o.value));
      if(current.size===next.size&&Array.from(next).every(v=>current.has(v)))return;
      categoryNav.innerHTML="";
      options.forEach(option=>{
        const b=document.createElement("button");b.type="button";b.className="cxrso-side-link";b.dataset.tag=option.value;
        const icon=document.createElement("span");icon.className="cxrso-side-icon";icon.textContent=ICONS[option.value]||"◈";
        const name=document.createElement("span");name.className="cxrso-side-name";name.textContent=option.textContent||option.value;
        b.append(icon,name);categoryNav.appendChild(b);
      });
    }
    if(nativeFilter){new MutationObserver(syncCategories).observe(nativeFilter,{childList:true});syncCategories();}
    window.addEventListener("storage",e=>{if(e.key===KEY)setCollapsed(e.newValue!=="false");});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();