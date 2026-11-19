/**
 * CXRSO Browser fetch gateway.
 * Read-only HTTP(S) proxy with browser-side GET/HEAD request routing.
 * Deploy behind Cloudflare Access or another authentication layer.
 */
const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal"]);
function isPrivateHost(host) {
  const h=host.toLowerCase().replace(/^\[|\]$/g,"");
  if(BLOCKED_HOSTS.has(h)||h.endsWith(".localhost")||h.endsWith(".local")||h.endsWith(".internal")) return true;
  if(h==="::1"||h==="::"||h.startsWith("fc")||h.startsWith("fd")||h.startsWith("fe80:")) return true;
  const m=h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if(m){const a=+m[1],b=+m[2],c=+m[3],d=+m[4];if([a,b,c,d].some(n=>n>255))return true;return a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a>=224;}
  return false;
}
function safeTarget(raw,base){
  let u;try{u=new URL(raw,base);}catch{throw new Error("Invalid destination URL");}
  if(!["http:","https:"].includes(u.protocol))throw new Error("Only HTTP and HTTPS pages are supported");
  if(isPrivateHost(u.hostname))throw new Error("Private and local network addresses are blocked");
  u.username="";u.password="";return u;
}
function gatewayUrl(raw,base,origin){const t=safeTarget(raw,base);return origin+"/?url="+encodeURIComponent(t.href);}
function rewriteCss(css,base,origin){
  return css.replace(/url\(\s*(['"]?)(?!data:)([^)'"]+)\1\s*\)/gi,(all,q,v)=>{try{return "url("+JSON.stringify(gatewayUrl(v.trim(),base,origin))+")";}catch{return all;}})
    .replace(/@import\s+(['"])([^'"]+)\1/gi,(all,q,v)=>{try{return "@import "+q+gatewayUrl(v,base,origin)+q;}catch{return all;}});
}
class AttributeRewriter{
  constructor(attribute,base,origin){this.attribute=attribute;this.base=base;this.origin=origin;}
  element(el){const v=el.getAttribute(this.attribute);if(!v||v.startsWith("#")||/^(data:|javascript:|mailto:|tel:|blob:)/i.test(v))return;try{el.setAttribute(this.attribute,gatewayUrl(v,this.base,this.origin));}catch{}}
}
class SrcsetRewriter{
  constructor(base,origin){this.base=base;this.origin=origin;}
  element(el){const v=el.getAttribute("srcset");if(!v)return;const out=v.split(",").map(part=>{const bits=part.trim().split(/\s+/);if(!bits[0]||/^data:/i.test(bits[0]))return part;try{bits[0]=gatewayUrl(bits[0],this.base,this.origin);return bits.join(" ");}catch{return part;}}).join(", ");el.setAttribute("srcset",out);}
}
function requestRouterScript(targetUrl){
  const base=JSON.stringify(targetUrl);
  return "<script>(function(){"+
    "'use strict';var originalBase="+base+",gateway=location.origin;"+
    "function route(value){try{var raw=value&&typeof value==='object'&&'url' in value?value.url:value;var u=new URL(String(raw),originalBase);"+
    "if(u.protocol!=='http:'&&u.protocol!=='https:')return String(raw);if(u.origin===gateway)return String(raw);"+
    "return gateway+'/?url='+encodeURIComponent(u.href);}catch(_){return value;}}"+
    "var nativeFetch=window.fetch;if(nativeFetch){window.fetch=function(input,init){try{var source=input instanceof Request?input.url:input;"+
    "var method=(init&&init.method)||(input instanceof Request?input.method:'GET');if(!/^(GET|HEAD)$/i.test(method))return nativeFetch.apply(this,arguments);"+
    "var routed=route(source);if(input instanceof Request){var next=new Request(routed,input);return nativeFetch.call(this,next,init);}"+
    "return nativeFetch.call(this,routed,init);}catch(_){return nativeFetch.apply(this,arguments);}};}"+
    "var open=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url){var args=Array.prototype.slice.call(arguments);"+
    "if(/^(GET|HEAD)$/i.test(method))args[1]=route(url);return open.apply(this,args);};"+
    "})();</script>";
}
export default {
 async fetch(request){
  const incoming=new URL(request.url);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{"access-control-allow-origin":"*","access-control-allow-methods":"GET, HEAD, OPTIONS","access-control-allow-headers":"*","access-control-max-age":"86400"}});
  if(request.method!=="GET"&&request.method!=="HEAD")return new Response("Read-only gateway: GET and HEAD requests only.",{status:405});
  const raw=incoming.searchParams.get("url");
  if(!raw)return new Response("CXRSO Browser gateway is ready. Supply ?url=https://example.com",{headers:{"content-type":"text/plain; charset=utf-8"}});
  let target;try{target=safeTarget(raw);}catch(e){return new Response(e.message,{status:400});}
  let upstream;
  try{
    upstream=await fetch(target.href,{method:request.method,redirect:"manual",headers:{
      "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
      "Accept":request.headers.get("Accept")||"*/*",
      "Accept-Language":request.headers.get("Accept-Language")||"en-US,en;q=0.9"
    }});
  }catch(error){
    console.error("CXRSO upstream fetch failed",{url:target.href,error:String(error)});
    return new Response("The destination could not be reached by the gateway.",{status:502,headers:{"content-type":"text/plain; charset=utf-8"}});
  }
  if([301,302,303,307,308].includes(upstream.status)){
    const location=upstream.headers.get("Location");if(!location)return new Response("Redirect blocked.",{status:502});
    try{const next=safeTarget(location,target);return Response.redirect(incoming.origin+"/?url="+encodeURIComponent(next.href),302);}
    catch(e){return new Response("Redirect blocked: "+e.message,{status:400});}
  }
  const headers=new Headers(upstream.headers);
  for(const h of ["content-security-policy","content-security-policy-report-only","x-frame-options","frame-options","cross-origin-opener-policy","cross-origin-embedder-policy","cross-origin-resource-policy","set-cookie","strict-transport-security"])headers.delete(h);
  headers.set("access-control-allow-origin","*");headers.set("cache-control","no-store");headers.delete("content-length");
  const type=headers.get("content-type")||"";
  if(type.includes("text/html")){
    headers.set("content-type","text/html; charset=utf-8");
    const response=new Response(upstream.body,{status:upstream.status,headers});
    const router=requestRouterScript(target.href);
    return new HTMLRewriter()
      .on("head",{element(el){el.prepend(router,{html:true});}})
      .on("a",new AttributeRewriter("href",target.href,incoming.origin))
      .on("form",new AttributeRewriter("action",target.href,incoming.origin))
      .on("img",new AttributeRewriter("src",target.href,incoming.origin))
      .on("script",new AttributeRewriter("src",target.href,incoming.origin))
      .on("iframe",new AttributeRewriter("src",target.href,incoming.origin))
      .on("source",new AttributeRewriter("src",target.href,incoming.origin))
      .on("video",new AttributeRewriter("src",target.href,incoming.origin))
      .on("video",new AttributeRewriter("poster",target.href,incoming.origin))
      .on("audio",new AttributeRewriter("src",target.href,incoming.origin))
      .on("link",new AttributeRewriter("href",target.href,incoming.origin))
      .on("object",new AttributeRewriter("data",target.href,incoming.origin))
      .on("img",new SrcsetRewriter(target.href,incoming.origin))
      .on("source",new SrcsetRewriter(target.href,incoming.origin))
      .transform(response);
  }
  if(type.includes("text/css")){const css=await upstream.text();return new Response(rewriteCss(css,target.href,incoming.origin),{status:upstream.status,headers});}
  return new Response(upstream.body,{status:upstream.status,headers});
 }
};
