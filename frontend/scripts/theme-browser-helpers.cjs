module.exports = function contrastAudit(){
 const parse=s=>{const v=(s.match(/[\d.]+/g)||[]).map(Number);return s.startsWith('color(srgb ')?v.map((x,i)=>i<3?x*255:x):v;};const over=(f,b)=>{const a=f[3]??1;return[0,1,2].map(i=>f[i]*a+b[i]*(1-a)).concat(1)};
 const lum=c=>{const v=c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*v[0]+.7152*v[1]+.0722*v[2]};
 const bg=e=>{let layers=[];for(let n=e;n;n=n.parentElement){const s=getComputedStyle(n);if(s.backgroundImage!=='none')return null;layers.push(parse(s.backgroundColor));}return layers.reverse().reduce((b,f)=>over(f,b),[255,255,255,1]);};let failures=[],checked=0;
 for(const e of document.body.querySelectorAll('*')){if(e.closest('.esham-chatbot,svg,.excalidraw,video,canvas,[disabled],[aria-disabled=true]'))continue;const s=getComputedStyle(e),r=e.getBoundingClientRect();if(!r.width||!r.height||s.visibility!=='visible'||Number(s.opacity)<.99||e.closest('[inert]'))continue;
 const text=[...e.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent.trim()).join(' ').trim();if(!text)continue;const b=bg(e);if(!b)continue;const f=over(parse(s.color),b);const l1=lum(f),l2=lum(b),ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05),large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&parseInt(s.fontWeight)>=700),required=large?3:4.5;checked++;
 if(ratio+.01<required)failures.push({tag:e.tagName,cls:e.className,text:text.slice(0,65),ratio:+ratio.toFixed(2),required,fg:s.color,bg:b.slice(0,3).map(Math.round),parent:e.parentElement.className});
 }return{checked,failures};
};
