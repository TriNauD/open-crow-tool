import{j as e,r as i,c as M}from"./client-Cmjl_fXq.js";function z({x:s,y:p,onClick:a}){const r=Math.max(70,Math.min(s,window.innerWidth-70)),c=Math.max(8,p-6);return e.jsx("button",{className:"wtf-btn",style:{left:r,top:c},onMouseDown:d=>d.stopPropagation(),onClick:d=>{d.stopPropagation(),a()},children:"这他妈是啥？"})}function R(s){const[p,a]=i.useState({text:"",isLoading:!1,error:null,isDone:!1}),r=i.useRef(null),c=i.useCallback(async(u,n)=>{var t;(t=r.current)==null||t.abort();const l=new AbortController;r.current=l,a({text:"",isLoading:!0,error:null,isDone:!1});try{const o=await fetch(`${s}/api/explain`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:u,context:n}),signal:l.signal});if(!o.ok||!o.body){const m=await o.text().catch(()=>"请求失败");a(h=>({...h,isLoading:!1,error:m}));return}const x=o.body.getReader(),f=new TextDecoder;for(;;){const{done:m,value:h}=await x.read();if(m)break;const v=f.decode(h,{stream:!0});a(w=>({...w,text:w.text+v}))}a(m=>({...m,isLoading:!1,isDone:!0}))}catch(o){if(o.name==="AbortError")return;a(x=>({...x,isLoading:!1,error:"网炸了或者 AI 挂了，稍后再试"}))}},[s]),d=i.useCallback(()=>{var u;(u=r.current)==null||u.abort(),a({text:"",isLoading:!1,error:null,isDone:!1})},[]);return{...p,explain:c,reset:d}}function U({text:s,anchorX:p,anchorY:a,config:r,onClose:c}){const[d,u]=i.useState(null),[n,l]=i.useState(!1),t=i.useRef(null),{text:o,isLoading:x,error:f,isDone:m,explain:h}=R(r.apiBaseUrl),v=360,w=320,g=12,N=window.innerWidth,C=window.innerHeight;let k=p-v/2;k=Math.max(g,Math.min(k,N-v-g));let b=a-w-10;b<g&&(b=a+24),b=Math.max(g,Math.min(b,C-w-g)),i.useEffect(()=>{h(s)},[s]),i.useEffect(()=>{function y(j){const B=j.composedPath();t.current&&!B.includes(t.current)&&c()}const S=setTimeout(()=>{document.addEventListener("mousedown",y)},150);return()=>{clearTimeout(S),document.removeEventListener("mousedown",y)}},[c]);async function L(){var y;if(!r.adminSecret){l(!0);return}try{const S=await fetch(`${r.apiBaseUrl}/api/notes`,{method:"POST",headers:{"Content-Type":"application/json","x-admin-secret":r.adminSecret},body:JSON.stringify({inputText:s,explanation:o})});if(S.ok){const j=await S.json();u(((y=j.data)==null?void 0:y.id)??"saved")}else l(!0)}catch{l(!0)}}return e.jsxs("div",{ref:t,className:"wtf-card",style:{left:k,top:b},children:[e.jsxs("div",{className:"wtf-card-header",children:[e.jsxs("div",{style:{minWidth:0},children:[e.jsx("div",{className:"wtf-card-label",children:"这他妈是啥？"}),e.jsx("div",{className:"wtf-card-query",children:s.length>80?s.slice(0,80)+"…":s})]}),e.jsx("button",{className:"wtf-close",onClick:c,title:"关闭 (Esc)",children:"×"})]}),e.jsxs("div",{className:"wtf-card-body",children:[x&&!o&&e.jsxs("div",{className:"wtf-loading",children:[e.jsx("span",{className:"wtf-dot"}),e.jsx("span",{className:"wtf-dot"}),e.jsx("span",{className:"wtf-dot"}),e.jsx("span",{style:{marginLeft:8},children:"正在思考中..."})]}),f&&e.jsx("div",{className:"wtf-error",children:f}),o&&e.jsxs("span",{children:[o,x&&e.jsx("span",{className:"wtf-cursor"})]})]}),(m||n)&&o&&e.jsxs("div",{className:"wtf-card-footer",children:[d?e.jsx("button",{className:"wtf-save-btn saved",disabled:!0,children:"✓ 已存入笔记本"}):n?e.jsx("span",{className:"wtf-error",style:{fontSize:12},children:"保存失败，请检查插件设置"}):e.jsx("button",{className:"wtf-save-btn",onClick:L,children:"存入笔记本"}),e.jsx("span",{className:"wtf-sep",children:"·"}),e.jsx("span",{className:"wtf-hint",children:"Esc 关闭"})]})]})}function T(){const[s,p]=i.useState({apiBaseUrl:"",adminSecret:""}),[a,r]=i.useState(null),[c,d]=i.useState(null);i.useEffect(()=>{chrome.storage.sync.get(["apiBaseUrl","adminSecret"]).then(n=>{p({apiBaseUrl:n.apiBaseUrl||"",adminSecret:n.adminSecret||""})}),chrome.storage.onChanged.addListener(n=>{(n.apiBaseUrl||n.adminSecret)&&p(l=>{var t,o;return{apiBaseUrl:((t=n.apiBaseUrl)==null?void 0:t.newValue)??l.apiBaseUrl,adminSecret:((o=n.adminSecret)==null?void 0:o.newValue)??l.adminSecret}})})},[]),i.useEffect(()=>{function n(){setTimeout(()=>{const t=window.getSelection();if(!t||t.isCollapsed||!t.rangeCount){r(null);return}const o=t.toString().trim();if(o.length<2){r(null);return}const f=t.getRangeAt(0).getBoundingClientRect();r({text:o,x:f.left+f.width/2,y:f.top})},10)}function l(t){t.key==="Escape"&&(d(null),r(null))}return document.addEventListener("mouseup",n),document.addEventListener("keydown",l),()=>{document.removeEventListener("mouseup",n),document.removeEventListener("keydown",l)}},[]),i.useEffect(()=>{function n(l){if(l.type!=="WTF_EXPLAIN")return;const t=window.getSelection();if(!t||t.isCollapsed)return;const o=t.toString().trim();if(!o)return;const f=t.getRangeAt(0).getBoundingClientRect();r(null),d({text:o,x:f.left+f.width/2,y:f.top}),t.removeAllRanges()}return chrome.runtime.onMessage.addListener(n),()=>chrome.runtime.onMessage.removeListener(n)},[]);function u(){var n;a&&(d(a),r(null),(n=window.getSelection())==null||n.removeAllRanges())}return s.apiBaseUrl?e.jsxs(e.Fragment,{children:[a&&!c&&e.jsx(z,{x:a.x,y:a.y,onClick:u}),c&&e.jsx(U,{text:c.text,anchorX:c.x,anchorY:c.y,config:s,onClose:()=>d(null)})]}):null}const D=`
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .wtf-btn {
    position: fixed;
    z-index: 2147483647;
    background: #f97316;
    color: #fff;
    border: none;
    border-radius: 20px;
    padding: 5px 14px;
    font-size: 13px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 2px 12px rgba(0,0,0,0.5);
    transform: translateX(-50%) translateY(calc(-100% - 6px));
    transition: background 0.15s;
    pointer-events: auto;
  }
  .wtf-btn:hover { background: #fb923c; }

  .wtf-card {
    position: fixed;
    z-index: 2147483647;
    width: 360px;
    max-width: calc(100vw - 24px);
    max-height: 480px;
    background: #18181b;
    border: 1px solid #3f3f46;
    border-radius: 16px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.7);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #f4f4f5;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: auto;
  }

  .wtf-card-header {
    padding: 12px 14px 10px;
    border-bottom: 1px solid #27272a;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    flex-shrink: 0;
  }

  .wtf-card-label {
    font-size: 11px;
    font-weight: 700;
    color: #fb923c;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 3px;
  }

  .wtf-card-query {
    font-size: 13px;
    color: #d4d4d8;
    line-height: 1.4;
    word-break: break-word;
  }

  .wtf-close {
    flex-shrink: 0;
    background: none;
    border: none;
    color: #71717a;
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
    padding: 0 2px;
    margin-top: -2px;
    transition: color 0.15s;
  }
  .wtf-close:hover { color: #f4f4f5; }

  .wtf-card-body {
    padding: 12px 14px;
    overflow-y: auto;
    flex: 1;
    font-size: 14px;
    line-height: 1.65;
    color: #f4f4f5;
    word-break: break-word;
  }

  .wtf-loading {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #71717a;
    font-size: 13px;
  }

  @keyframes wtf-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.25; }
  }

  .wtf-dot {
    width: 6px;
    height: 6px;
    background: #fb923c;
    border-radius: 50%;
    animation: wtf-pulse 1.2s ease infinite;
  }
  .wtf-dot:nth-child(2) { animation-delay: 0.2s; }
  .wtf-dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes wtf-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .wtf-cursor {
    display: inline-block;
    width: 2px;
    height: 14px;
    background: #fb923c;
    margin-left: 2px;
    vertical-align: middle;
    animation: wtf-blink 0.9s ease infinite;
  }

  .wtf-error { color: #f87171; font-size: 13px; }

  .wtf-card-footer {
    padding: 9px 14px;
    border-top: 1px solid #27272a;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .wtf-save-btn {
    background: none;
    border: none;
    font-size: 12px;
    color: #71717a;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
    font-family: inherit;
    transition: color 0.15s;
  }
  .wtf-save-btn:hover:not(:disabled) { color: #d4d4d8; }
  .wtf-save-btn.saved { color: #4ade80; text-decoration: none; cursor: default; }

  .wtf-sep { color: #3f3f46; font-size: 12px; }

  .wtf-hint { font-size: 12px; color: #52525b; }
`;function E(){if(document.getElementById("wtf-ext-host"))return;const s=document.createElement("div");s.id="wtf-ext-host",s.style.cssText="all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647; pointer-events: none;",document.documentElement.appendChild(s);const p=s.attachShadow({mode:"open"}),a=document.createElement("style");a.textContent=D,p.appendChild(a);const r=document.createElement("div");p.appendChild(r),M(r).render(e.jsx(T,{}))}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",E):E();
