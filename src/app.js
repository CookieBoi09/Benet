import {uid, quizPlan, inside, markdownNodes, depth, branchIds, smoothPath, shiftPath, dragBounds} from './model.js';
const $=s=>document.querySelector(s), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='benet.pages.v1';
const demo=()=>{const root=uid(), a=uid(), b=uid();return {id:uid(),name:'A little room for ideas',readonly:false,nodes:[{id:root,text:'Something worth exploring',x:100,y:250,parent:null,properties:['Ideas']},{id:a,text:'What if we tried…',x:410,y:140,parent:root,properties:['Ideas']},{id:b,text:'Make space for curiosity',x:410,y:360,parent:root,properties:[]},{id:uid(),text:'Follow the unexpected',x:710,y:140,parent:a,properties:['Ideas']}],properties:['Ideas'],view:{x:80,y:60,z:1}}};
let pages;try {pages=JSON.parse(localStorage.getItem(KEY));}catch{} if(!Array.isArray(pages)||!pages.length)pages=[demo()];
let folders=[];try{folders=JSON.parse(localStorage.getItem('benet.folders.v1'))||[];}catch{}
if(!Array.isArray(folders))folders=[];
let folderId=null,libraryOpen=false,libraryExpanded=false,propertiesHidden=true;
let page=pages[0], mode='draw', active=null, selected=new Set(), polygon=[], drag=null, quiz=null, pointer={x:0,y:0}, saveTimer;
let traceOwner=null, trace=[];
let editingEditor=null;
const nodeLayouts=new Map();
function resetTrace(){traceOwner=null;trace=[];}
function tracePath(points){return smoothPath(points);}
function recordTrace(p){
 if(!active||quiz||page.readonly||mode!=='draw'){resetTrace();return;}
 const n=page.nodes.find(n=>n.id===active);if(!n)return;
 if(traceOwner!==active){traceOwner=active;trace=[];}
 if(p.x>=n.x&&p.x<=n.x+width(n)&&p.y>=n.y&&p.y<=n.y+height(n)){trace=[];return;}
 if(!trace.length)trace.push({x:n.x+width(n)/2,y:n.y+height(n)/2});
 const last=trace.at(-1);if(Math.hypot(p.x-last.x,p.y-last.y)>=2/page.view.z)trace.push({...p});
}
const app=$('#app');
const icons={leaf:'<path d="M19 4C8 3 3 7 5 14c2 7 11 5 14-10Z"/><path d="M5 21c1-7 5-10 10-13"/>',folder:'<path d="M3 7V5h6l2 3h10v12H3Z"/>',map:'<rect x="3" y="8" width="6" height="6" rx="2"/><rect x="15" y="3" width="6" height="6" rx="2"/><rect x="15" y="15" width="6" height="6" rx="2"/><path d="M9 11h3V6h3M12 11v7h3"/>',down:'<path d="m6 9 6 6 6-6"/>',plus:'<path d="M12 5v14M5 12h14"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',move:'<path d="M12 2v20M2 12h20m-13-7 3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3m14-6 3 3-3 3"/>',lasso:'<path d="M6 18C-3 8 6 2 15 4c11 3 8 13-1 14-6 1-10-2-8-4s6 4 0 8"/>',arrow:'<path d="M5 19 19 5M6 5h13v13"/>',play:'<path d="m8 4 12 8-12 8Z"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>'};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.map}</svg>`;
app.innerHTML=`
<header class="app-header"><a class="brand" href="#" aria-label="Benet home"><span class="brand-mark">${icon('leaf')}</span>benet<span class="brand-caption">a place for growing ideas</span></a><div class="app-actions"><span class="local-note"><i class="green-dot"></i>Local & private</span><button id="export">${icon('upload')}<span>Export</span></button><button id="import">${icon('download')}<span>Import</span></button><button id="app-info" class="app-badge">Desktop app ↗</button></div></header>
<section class="library-shell" aria-label="Map library"><div class="file-strip"><button id="library-toggle" aria-expanded="false" aria-controls="library-dropdown">${icon('folder')}<span id="library-label">My library</span>${icon('down')}</button><div class="strip-divider"></div><nav id="quick-files" aria-label="Folders and maps"></nav><button id="new" class="new-page" title="New mind map">${icon('plus')}<span>New map</span></button></div>
<div id="library-dropdown" class="library-dropdown hidden"><div class="library-heading"><div><span class="eyebrow">YOUR LITTLE FOREST</span><h2>Your ideas, a place to grow.</h2></div><button id="expand-library" title="Expand library" aria-label="Expand library">${icon('expand')}</button></div><div class="library-controls"><nav id="breadcrumbs" aria-label="Folder path"></nav><div class="library-buttons"><button id="rename-folder">Rename folder</button><button id="delete-folder" title="Remove folder">${icon('trash')}</button><button id="new-folder">${icon('plus')}New folder</button><button id="new-in-library">${icon('plus')}New map</button></div></div><label class="search-field">${icon('search')}<input id="library-search" placeholder="Find something you planted…" aria-label="Search maps and folders"></label><div id="pages" class="file-grid"></div><div class="library-footer"><span id="count"></span><span>Stored on this device · Export to keep a backup</span></div></div></section>
<main><div class="map-header"><div class="map-heading"><span class="eyebrow">MIND MAP <span id="map-folder"></span></span><input id="title" aria-label="Page title"><span id="readonly"></span></div><div class="header-actions"><span id="save-status">All changes saved</span><button id="move-page" class="icon-button" title="Move map to folder" aria-label="Move map to folder">${icon('folder')}</button><button id="delete" class="icon-button" title="Delete page" aria-label="Delete page">${icon('trash')}</button><div id="properties-dropdown" class="properties-dropdown"><button id="toggle-properties" class="properties-trigger" aria-expanded="false" aria-controls="properties">◈ <span>Properties</span>${icon('down')}</button></div><button id="open-quiz" class="primary">${icon('play')}<span>Practice this map</span></button></div></div>
<div class="workspace"><div id="canvas" tabindex="0" aria-label="Mind map canvas"><div id="world"><svg id="edges"></svg><div id="nodes"></div></div><svg id="overlay"></svg></div><div class="canvas-top"><span class="pill"><span class="green-dot"></span><span id="mode-label">Let your ideas connect</span></span><span id="node-count"></span></div><section id="properties" class="panel hidden" aria-labelledby="toggle-properties"><p>A little order for your growing ideas.</p><select id="property-filter" aria-label="Highlight a property"><option value="">All properties</option></select><div id="property-chips"></div><div class="separator"></div><div id="selection-count">Lasso nodes to organize them</div><div class="property-input"><input id="property-name" placeholder="New or existing property" aria-label="Property name"><button id="assign" title="Apply property" aria-label="Apply property">＋</button></div><button id="clear-properties" class="text-button">Remove selected properties</button><button id="remove-nodes" class="text-button">${icon('trash')}Delete selected nodes</button></section><div id="quiz-panel" class="panel hidden"></div>
<div class="bottom-center"><div id="toolbar"><button data-mode="draw" class="chosen" title="Draw nodes">${icon('arrow')}<span>Connect</span></button><button data-mode="pan" title="Pan canvas">${icon('move')}<span>Move</span></button><button data-mode="lasso" title="Lasso selection">${icon('lasso')}<span>Lasso</span></button><i></i><button id="fit" title="Fit map" aria-label="Fit map">${icon('expand')}</button><button id="pause-drawing" title="Pause drawing" aria-label="Pause drawing">Ⅱ</button></div><div id="help">Drag selected boxes to move · Enter for a new line · Right-click to finish</div></div><div class="zoom"><button id="zoom-out" aria-label="Zoom out">−</button><span id="zoom-value">100%</span><button id="zoom-in" aria-label="Zoom in">＋</button></div><div id="toast" role="status"></div></div></main><footer class="app-footer"><span><i class="green-dot"></i>Room to think. Space to connect.</span><span>BENET / YOUR PERSONAL KNOWLEDGE GARDEN</span></footer>
<input type="file" id="file" accept=".json,.md,.markdown,.txt" hidden><dialog id="quiz-dialog"><form method="dialog"><span class="eyebrow">A MOMENT TO REMEMBER</span><h2>Turn connections into knowledge.</h2><p>Recall each branch, reveal the answer, then grade yourself. We’ll work from the roots to the leaves.</p><label>Practice scope<select id="quiz-scope"></select></label><div class="dialog-actions"><button value="cancel">Not now</button><button id="start-quiz" type="button" class="primary">Start practice →</button></div></form></dialog>
<dialog id="folder-dialog"><form id="folder-form"><span class="eyebrow">MAKE ROOM FOR IDEAS</span><h2 id="folder-dialog-title">New folder</h2><label>Folder name<input id="folder-name" required maxlength="80" autocomplete="off"></label><div class="dialog-actions"><button type="button" id="cancel-folder">Cancel</button><button class="primary">Save folder</button></div></form></dialog>
<dialog id="move-dialog"><form method="dialog"><h2>Find a home for this map.</h2><label>Destination folder<select id="move-destination"></select></label><div class="dialog-actions"><button value="cancel">Cancel</button><button id="confirm-move" type="button" class="primary">Move map</button></div></form></dialog>
<dialog id="app-dialog"><form method="dialog"><span class="eyebrow">BENET, ON YOUR DESKTOP</span><h2>A home for your thinking.</h2><p id="app-description">The macOS app includes native import and export, offline editing, and the same mind mapping and practice tools.</p><p>To transfer maps between the website and desktop app, export your library, then import that JSON file in the app.</p><a class="release-link" href="https://github.com/CookieBoi09/Benet/releases" target="_blank" rel="noopener">View desktop downloads ↗</a><div class="dialog-actions"><button class="primary">Got it</button></div></form></dialog>`;

function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(saveTimer);saveTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200);}
function save(){try{localStorage.setItem(KEY,JSON.stringify(pages));localStorage.setItem('benet.folders.v1',JSON.stringify(folders));$('#save-status').textContent='All changes saved';}catch{$('#save-status').textContent='Not saved — export a backup';toast('Browser storage is full or unavailable. Export your library to keep it.');}}
function reset(){active=null;resetTrace();selected.clear();quiz=null;mode='draw';render();}
function render(){
 renderLibrary();
 $('#title').value=page.name;$('#readonly').textContent=page.readonly?'Imported · quiz only':'';$('#node-count').textContent=`${page.nodes.length} nodes · ${page.nodes.filter(n=>n.parent).length} connections`;
 const old=$('#property-filter').value;$('#property-filter').innerHTML='<option value="">All properties</option>'+page.properties.map(p=>`<option>${esc(p)}</option>`).join('');$('#property-filter').value=page.properties.includes(old)?old:'';
 $('#property-chips').innerHTML=page.properties.map(p=>`<span class="property-chip">${esc(p)} <b>${page.nodes.filter(n=>n.properties.includes(p)).length}</b></span>`).join('')||'<span class="muted">No properties yet</span>';
 $('#selection-count').textContent=selected.size?`${selected.size} nodes selected`:'Lasso nodes to organize them';
 renderPropertiesDropdown();$('#quiz-panel').classList.toggle('hidden',!quiz);$('#toolbar').classList.toggle('hidden',!!quiz);
 document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('chosen',b.dataset.mode===mode));
 $('#mode-label').textContent=quiz?'A little practice, a lasting connection':page.readonly?'Notion import · quiz only':mode==='lasso'?'Draw around the ideas you want to collect':mode==='pan'?'Drag to explore your thinking space':'Let your ideas connect';
 renderNodes(); if(quiz)renderQuiz();
}
function visible(n){return !quiz || quiz.visible.has(n.id);}
function renderNodes(){
 finishEditing();
 $('#nodes').innerHTML=page.nodes.filter(visible).map(n=>{const hidden=quiz&&!quiz.revealed.has(n.id);return `<div class="node ${n.fitted?'fitted':''} ${active===n.id?'active':''} ${selected.has(n.id)?'selected':''} ${quiz?.current===n.id?'quiz-current':''} ${$('#property-filter').value&&!n.properties.includes($('#property-filter').value)?'dim':''}" data-node="${n.id}" style="left:${n.x}px;top:${n.y}px;width:${n.width||210}px"><div class="node-content" ${!quiz&&!page.readonly?'contenteditable="true"':''} role="textbox" aria-label="Mind map node" data-placeholder="An idea starts here…">${hidden?'?':esc(n.text)}</div>${n.properties.length&&!hidden?`<div class="node-tags">${n.properties.map(p=>`<span>${esc(p)}</span>`).join('')}</div>`:''}${quiz?.grades[n.id]?`<div class="grade ${quiz.grades[n.id]}">${quiz.grades[n.id]==='yes'?'✓ Remembered':'↻ Revisit'}</div>`:''}</div>`;}).join('');if(!quiz)for(const n of page.nodes)syncNodeSize(n);transform();
}
function transform(){let v=page.view;$('#world').style.transform=`translate(${v.x}px,${v.y}px) scale(${v.z})`;$('#canvas').style.backgroundSize=`${24*v.z}px ${24*v.z}px`;$('#canvas').style.backgroundPosition=`${v.x}px ${v.y}px`;$('#zoom-value').textContent=Math.round(v.z*100)+'%';drawEdges();}
function width(n){return document.querySelector(`[data-node="${n.id}"]`)?.offsetWidth||n.width||210;}
function height(n){return document.querySelector(`[data-node="${n.id}"]`)?.offsetHeight||n.height||76;}
function drawEdges(){let edges='';for(const n of page.nodes){const p=page.nodes.find(p=>p.id===n.parent);if(!p||!visible(n)||!visible(p))continue;const x=p.x+width(p),y=p.y+height(p)/2,ex=n.x,ey=n.y+height(n)/2;edges+=n.path?.length?`<path d="${tracePath(n.path)}"/>`:`<path d="M ${x} ${y} C ${x+70} ${y},${ex-70} ${ey},${ex} ${ey}"/>`;}
 if(active&&!quiz&&mode==='draw'){const n=page.nodes.find(n=>n.id===active);if(n&&traceOwner===active&&trace.length)edges+=`<path class="draft-edge" d="${tracePath(trace)}"/>`;}
 $('#edges').innerHTML=edges;
}
function point(e){const r=$('#canvas').getBoundingClientRect(),v=page.view;return{x:(e.clientX-r.left-v.x)/v.z,y:(e.clientY-r.top-v.y)/v.z};}
function centerEditor(editor){
 if(quiz||page.readonly||drag||!editor?.matches('.node-content[contenteditable="true"]')||document.activeElement!==editor)return false;
 const box=editor.closest('[data-node]'),node=page.nodes.find(n=>n.id===box.dataset.node);
 if(!node)return false;
 const canvas=$('#canvas'),bounds=canvas.getBoundingClientRect(),v=page.view;
 let centerY=node.y+box.offsetHeight/2;
 // For a box taller than the viewport, follow the insertion point instead.
 if(box.offsetHeight*v.z>bounds.height-100){
  const selection=window.getSelection();
  if(selection?.focusNode&&editor.contains(selection.focusNode)){
   const caret=document.createRange();caret.setStart(selection.focusNode,selection.focusOffset);caret.collapse(true);
   const rect=caret.getClientRects()[0];
   if(rect?.height)centerY=(rect.top+rect.height/2-bounds.top-v.y)/v.z;
  }
 }
 const x=bounds.width/2-(node.x+box.offsetWidth/2)*v.z,y=bounds.height/2-centerY*v.z;
 if(Math.abs(v.x-x)<.25&&Math.abs(v.y-y)<.25)return false;
 v.x=x;v.y=y;resetTrace();transform();return true;
}
function beginEditing(editor){
 if(quiz||page.readonly||drag||!editor?.matches('.node-content[contenteditable="true"]'))return;
 if(editingEditor!==editor)finishEditing();editingEditor=editor;
}
function syncNodeSize(node){
 const el=document.querySelector(`[data-node="${node.id}"]`);if(!el)return;
 const before=nodeLayouts.get(node.id),after={width:el.offsetWidth,height:el.offsetHeight};
 if(before&&(before.width!==after.width||before.height!==after.height)){
  const delta=p=>({x:(p.x-node.x)*(after.width/before.width-1),y:(p.y-node.y)*(after.height/before.height-1)});
  for(const child of page.nodes){
   if(!child.path?.length||(child.id!==node.id&&child.parent!==node.id))continue;
   child.path=shiftPath(child.path,child.parent===node.id?delta(child.path[0]):{x:0,y:0},child.id===node.id?delta(child.path.at(-1)):{x:0,y:0});
  }
  if(traceOwner===node.id&&trace.length)trace=shiftPath(trace,delta(trace[0]),{x:0,y:0});
 }
 node.width=after.width;node.height=after.height;nodeLayouts.set(node.id,after);
}
function finishEditing(){
 if(!editingEditor||drag)return;
 const editor=editingEditor;editingEditor=null;
 const box=editor.closest('[data-node]'),node=page.nodes.find(n=>n.id===box?.dataset.node);
 if(!editor.isConnected||!node||quiz||page.readonly)return;
 const style=getComputedStyle(editor),context=document.createElement('canvas').getContext('2d');
 context.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
 const textWidth=node.text.split('\n').reduce((max,line)=>Math.max(max,context.measureText(line).width),0);
 context.font=`8px ${style.fontFamily}`;
 const tagWidth=node.properties.reduce((total,tag)=>total+context.measureText(tag).width+18,0);
 box.style.width=Math.ceil(Math.max(64,Math.min(320,Math.max(textWidth,tagWidth)+30)))+'px';
 node.fitted=true;box.classList.add('fitted');box.classList.remove('editing');
 syncNodeSize(node);drawEdges();save();
}
$('#nodes').addEventListener('focusin',e=>{beginEditing(e.target);if(centerEditor(e.target))save();});
$('#nodes').addEventListener('focusout',e=>{if(e.target===editingEditor)finishEditing();});
window.addEventListener('resize',()=>{if(centerEditor(document.activeElement))save();});
function create(p){recordTrace(p);const path=active&&traceOwner===active?[...trace,{...p}]:null;const n={id:uid(),text:'',x:p.x-105,y:p.y-35,parent:active,path,properties:[]};resetTrace();page.nodes.push(n);active=n.id;selected=new Set([n.id]);render();document.querySelector(`[data-node="${n.id}"] .node-content`).focus({preventScroll:true});save();}
$('#nodes').addEventListener('input',e=>{const node=page.nodes.find(n=>n.id===e.target.closest('[data-node]')?.dataset.node);if(node){beginEditing(e.target);node.text=e.target.innerText;node.fitted=false;const box=e.target.closest('.node');box.classList.remove('fitted');box.classList.add('editing');box.style.width=Math.max(210,node.width||210)+'px';syncNodeSize(node);centerEditor(e.target);save();drawEdges();}});
$('#nodes').addEventListener('keydown',e=>{if(e.key==='Escape'){e.target.blur();active=null;drawEdges();}});
$('#nodes').addEventListener('paste',e=>{if(!e.target.isContentEditable)return;e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));});
function dragTarget(e){
 const direct=e.target.closest('[data-node]');if(direct)return direct;
 const p=point(e);let closest=null,distance=Infinity;
 // Visible boxes win over neighbouring expanded hitboxes; among halos, pick
 // the closest visible edge, with later (topmost) nodes winning ties.
 for(const el of [...$('#nodes').children].reverse()){
  const node=page.nodes.find(n=>n.id===el.dataset.node);
  const w=el.offsetWidth,h=el.offsetHeight;
  const dx=Math.max(node.x-p.x,0,p.x-node.x-w),dy=Math.max(node.y-p.y,0,p.y-node.y-h);
  if(dx===0&&dy===0)return el;
  const bounds=dragBounds(node.x,node.y,w,h),d=Math.hypot(dx,dy);
  if(p.x>=bounds.left&&p.x<=bounds.right&&p.y>=bounds.top&&p.y<=bounds.bottom&&d<distance){closest=el;distance=d;}
 }
 return closest;
}
function beginNodeDrag(e,el){
 const id=el.dataset.node;
 if(!selected.has(id))selected=new Set([id]);
 const group=selected.size>1;
 // A group click or halo click selects/drags without entering a text editor.
 if(group||!e.target.closest('[data-node]')){e.preventDefault();document.activeElement?.blur();$('#canvas').focus();}
 drag={type:'node',clickedId:id,editor:e.target.closest('.node-content'),start:point(e),clientX:e.clientX,clientY:e.clientY,moved:false,group,
  positions:page.nodes.filter(n=>selected.has(n.id)).map(n=>({id:n.id,x:n.x,y:n.y})),
  paths:page.nodes.filter(n=>n.path?.length&&(selected.has(n.id)||selected.has(n.parent))).map(n=>({id:n.id,source:selected.has(n.parent),target:selected.has(n.id),points:n.path.map(p=>({...p}))}))};
 $('#canvas').setPointerCapture(e.pointerId);
 resetTrace();active=group?null:id;
 $('#selection-count').textContent=`${selected.size} ${group?'nodes':'node'} selected`;
 document.querySelectorAll('.node').forEach(node=>{node.classList.toggle('selected',selected.has(node.dataset.node));node.classList.toggle('active',node.dataset.node===active);});
 drawEdges();
}
$('#canvas').addEventListener('pointerdown',e=>{
 if(e.button===2)return;const n=dragTarget(e);
 const focused=document.activeElement;if(focused?.matches('.node-content')&&focused.closest('[data-node]')!==n)focused.blur();
 if(e.button===1||(mode==='pan'&&(!n||quiz||page.readonly))){e.preventDefault();drag={type:'pan',x:e.clientX,y:e.clientY,v:{...page.view}};$('#canvas').setPointerCapture(e.pointerId);return;}
 if(quiz||page.readonly)return;
 if(mode==='lasso'&&(!n||!selected.has(n.dataset.node))){e.preventDefault();polygon=[point(e)];drag={type:'lasso'};$('#canvas').setPointerCapture(e.pointerId);return;}
 if(n)beginNodeDrag(e,n);else{e.preventDefault();create(point(e));}
});
$('#canvas').addEventListener('pointermove',e=>{pointer=point(e);if(drag?.type==='node'){
 if(!drag.moved&&Math.hypot(e.clientX-drag.clientX,e.clientY-drag.clientY)<5)return;
 e.preventDefault();if(!drag.moved){drag.moved=true;document.activeElement?.blur();window.getSelection()?.removeAllRanges();$('#canvas').setPointerCapture(e.pointerId);$('#canvas').classList.add('dragging-node');}
 const delta={x:pointer.x-drag.start.x,y:pointer.y-drag.start.y};
 for(const position of drag.positions){
  const node=page.nodes.find(n=>n.id===position.id);node.x=position.x+delta.x;node.y=position.y+delta.y;
  const el=document.querySelector(`[data-node="${node.id}"]`);el.style.left=node.x+'px';el.style.top=node.y+'px';
 }
 for(const path of drag.paths){page.nodes.find(n=>n.id===path.id).path=shiftPath(path.points,path.source?delta:{x:0,y:0},path.target?delta:{x:0,y:0});}
 resetTrace();drawEdges();
 }else if(drag?.type==='pan'){page.view.x=drag.v.x+e.clientX-drag.x;page.view.y=drag.v.y+e.clientY-drag.y;transform();}else if(drag?.type==='lasso'){polygon.push(point(e));const v=page.view;$('#overlay').innerHTML=`<polygon points="${polygon.map(p=>`${p.x*v.z+v.x},${p.y*v.z+v.y}`).join(' ')}"/>`;}else{const target=!quiz&&!page.readonly?dragTarget(e):null;$('#canvas').classList.toggle('near-node',!!target&&(mode!=='lasso'||selected.has(target.dataset.node)));recordTrace(pointer);drawEdges();}});
function endDrag(e){
 const finished=drag;drag=null;
 if(finished?.type==='node'&&finished.moved){active=null;resetTrace();$('#canvas').classList.remove('dragging-node');renderNodes();$('#canvas').focus();}
 if(finished?.type==='lasso'){selected=new Set(page.nodes.filter(n=>inside({x:n.x+width(n)/2,y:n.y+height(n)/2},polygon)).map(n=>n.id));$('#overlay').innerHTML='';render();$('#canvas').focus();}
 drag=null;
 // A short click edits one member; a drag keeps the full group selected.
 if(finished?.type==='node'&&finished.group&&!finished.moved&&finished.editor&&e.type==='pointerup'){
  selected=new Set([finished.clickedId]);active=finished.clickedId;
  $('#selection-count').textContent='1 node selected';
  document.querySelectorAll('.node').forEach(el=>{el.classList.toggle('selected',el.dataset.node===active);el.classList.toggle('active',el.dataset.node===active);});
  finished.editor.focus({preventScroll:true});
 }
 // Wait until release to distinguish a click-to-edit from dragging a box.
 if(finished?.type==='node'&&!finished.moved&&!finished.group&&e.type==='pointerup'){beginEditing(document.activeElement);centerEditor(document.activeElement);}
 if(finished)save();
 $('#canvas').classList.remove('near-node');
}
$('#canvas').addEventListener('pointerup',endDrag);$('#canvas').addEventListener('pointercancel',endDrag);
$('#canvas').addEventListener('contextmenu',e=>{e.preventDefault();active=null;resetTrace();document.activeElement?.blur();renderNodes();$('#canvas').focus();});
function zoom(f,center){const v=page.view,r=$('#canvas').getBoundingClientRect(),c=center||{x:r.width/2,y:r.height/2},z=Math.max(.2,Math.min(2.5,v.z*f));v.x=c.x-(c.x-v.x)*z/v.z;v.y=c.y-(c.y-v.y)*z/v.z;v.z=z;transform();save();}
$('#canvas').addEventListener('wheel',e=>{e.preventDefault();if(drag)return;const r=$('#canvas').getBoundingClientRect();if(e.ctrlKey||e.metaKey)zoom(Math.exp(-e.deltaY*.005),{x:e.clientX-r.left,y:e.clientY-r.top});else{page.view.x-=e.deltaX;page.view.y-=e.deltaY;transform();save();}},{passive:false});
$('#zoom-in').onclick=()=>zoom(1.2);$('#zoom-out').onclick=()=>zoom(1/1.2);
function fit(){const ns=page.nodes.filter(visible),r=$('#canvas').getBoundingClientRect();if(!ns.length){page.view={x:80,y:60,z:1};transform();return;}const minX=Math.min(...ns.map(n=>n.x)),minY=Math.min(...ns.map(n=>n.y)),w=Math.max(...ns.map(n=>n.x+width(n)))-minX,h=Math.max(...ns.map(n=>n.y+height(n)))-minY;const z=Math.max(.2,Math.min(1.2,Math.max(120,r.width-(r.width<700?40:340))/w,(r.height-200)/h));page.view={x:50-minX*z,y:(r.height-h*z)/2-minY*z,z};transform();save();}
$('#fit').onclick=fit;
$('#toolbar').onclick=e=>{const b=e.target.closest('[data-mode]');if(!b)return;active=null;resetTrace();mode=b.dataset.mode;render();};
$('#new').onclick=()=>{finishEditing();page={id:uid(),name:'Untitled mind map',nodes:[],properties:[],view:{x:0,y:0,z:1},readonly:false,folderId};pages.push(page);reset();save();$('#title').focus();$('#title').select();};
$('#pages').onclick=handleFileClick;$('#quick-files').onclick=handleFileClick;
$('#title').onchange=e=>{page.name=e.target.value.trim()||'Untitled mind map';render();save();};
$('#delete').onclick=()=>{if(!confirm(`Delete “${page.name}”? Export a backup first if you want to keep it.`))return;pages=pages.filter(p=>p!==page);if(!pages.length){$('#new').click();return;}page=pages[0];reset();save();};
$('#assign').onclick=()=>{if(page.readonly||quiz)return toast('Imported maps are quiz only.');const p=$('#property-name').value.trim();if(!selected.size||!p)return toast('Lasso some nodes and enter a property name.');if(!page.properties.includes(p))page.properties.push(p);page.nodes.filter(n=>selected.has(n.id)).forEach(n=>{if(!n.properties.includes(p))n.properties.push(p);});$('#property-name').value='';render();save();};
$('#clear-properties').onclick=()=>{if(page.readonly||quiz)return;if(!selected.size)return toast('Use Lasso to select nodes first.');page.nodes.filter(n=>selected.has(n.id)).forEach(n=>n.properties=[]);page.properties=page.properties.filter(p=>page.nodes.some(n=>n.properties.includes(p)));render();save();};
$('#property-filter').onchange=renderNodes;
$('#export').onclick=async()=>{const content=JSON.stringify({version:1,pages,folders},null,2);if(window.benetDesktop){try{const saved=await window.benetDesktop.exportLibrary(content);if(saved)toast('Library backup saved.');}catch{toast('Export failed. Please try another location.');}return;}const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='benet-library.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#import').onclick=async()=>{if(window.benetDesktop){try{const file=await window.benetDesktop.importFile();if(file)importContent(file.name,file.text);}catch{toast('Unable to read that file.');}}else $('#file').click();};
function validatePages(data){if(data.version!==1||!Array.isArray(data.pages)||!data.pages.length)throw Error('Not a Benet library.');for(const p of data.pages){if(typeof p.name!=='string'||!Array.isArray(p.nodes)||!Array.isArray(p.properties)||!p.properties.every(x=>typeof x==='string'))throw Error('Invalid page.');const ids=new Set();for(const n of p.nodes){if(typeof n.id!=='string'||ids.has(n.id)||typeof n.text!=='string'||!Number.isFinite(n.x)||!Number.isFinite(n.y)||!Array.isArray(n.properties)||!n.properties.every(x=>typeof x==='string'))throw Error('Invalid node.');if(n.path!=null&&(!Array.isArray(n.path)||!n.path.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y))))throw Error('Invalid connection path.');if(n.width!=null&&(!Number.isFinite(n.width)||n.width<64||n.width>320))throw Error('Invalid node width.');if(n.height!=null&&(!Number.isFinite(n.height)||n.height<=0))throw Error('Invalid node height.');n.fitted=n.fitted===true;ids.add(n.id);}for(const n of p.nodes){const seen=new Set([n.id]);let par=n.parent;while(par){if(!ids.has(par)||seen.has(par))throw Error('Invalid connections.');seen.add(par);par=p.nodes.find(x=>x.id===par).parent;}}const remap=new Map(p.nodes.map(n=>[n.id,uid()]));p.nodes.forEach(n=>{n.id=remap.get(n.id);n.parent=n.parent?remap.get(n.parent):null;});p.id=uid();p.readonly=!!p.readonly;p.folderId=typeof p.folderId==='string'?p.folderId:null;p.view={x:60,y:60,z:1};}return data.pages;}
function importContent(name,text){finishEditing();try{let imported,newFolders=[];if(name.toLowerCase().endsWith('.json')){const data=JSON.parse(text);imported=validatePages(data);newFolders=validateFolders(data.folders||[],imported);}else{const nodes=markdownNodes(text);if(!nodes.length)throw Error('No text found in this Markdown file.');imported=[{id:uid(),name:name.replace(/\.[^.]+$/,''),nodes,properties:[],readonly:true,folderId,view:{x:60,y:60,z:1}}];}pages.push(...imported);folders.push(...newFolders);page=imported[0];folderId=page.folderId||null;setLibraryOpen(false);reset();fit();save();toast('Imported successfully. Your existing pages are still here.');}catch(err){toast('Import failed: '+err.message);}}
$('#file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>20e6)throw Error('Please use a file smaller than 20 MB.');importContent(f.name,await f.text());}catch(err){toast('Import failed: '+err.message);}e.target.value='';};
$('#open-quiz').onclick=()=>{if(!page.nodes.length)return toast('Add a few ideas before starting a quiz.');$('#quiz-scope').innerHTML='<option value="">Everything</option>'+page.properties.map(p=>`<option>${esc(p)}</option>`).join('');$('#quiz-dialog').showModal();};
$('#start-quiz').onclick=()=>{
 const property=$('#quiz-scope').value,plan=quizPlan(page.nodes,property);if(!plan.length)return toast('No nodes in this property.');
 const members=new Set(plan),parents={};for(const id of plan){let n=page.nodes.find(n=>n.id===id);while(n.parent&&!members.has(n.parent))n=page.nodes.find(x=>x.id===n.parent);parents[id]=n.parent||null;}
 const roots=plan.filter(id=>!parents[id]);quiz={property,plan,parents,visible:new Set(roots),revealed:new Set(),grades:{},done:new Set(),queue:[...roots],current:roots[0],phase:'root',batch:[],hint:false};active=null;$('#quiz-dialog').close();render();fit();
};
function children(id){return quiz.plan.filter(n=>quiz.parents[n]===id);}
function renderQuiz(){const q=quiz,finished=q.phase==='finished',n=page.nodes.find(n=>n.id===q.current);$('#quiz-panel').innerHTML=`<div class="panel-title">${finished?'Practice complete':'Recall & connect'}<button id="end-quiz" aria-label="End quiz">×</button></div><p>${esc(q.property||'Everything')} · ${q.revealed.size} / ${q.plan.length} revealed</p><div class="progress"><i style="width:${q.revealed.size/q.plan.length*100}%"></i></div>${finished?`<h3>A little more connected.</h3><p>${Object.values(q.grades).filter(g=>g==='yes').length} remembered · ${Object.values(q.grades).filter(g=>g==='no').length} to revisit</p><button id="done-quiz" class="primary wide">Back to your map</button>`:`<div class="quiz-step">${q.phase==='root'?'01 / RECALL THE ROOT':q.phase==='grade'?'SELF CHECK':'02 / FOLLOW THE BRANCH'}</div><h3>${q.phase==='root'?'What starts this connection?':esc(n.text||'Untitled idea')}</h3>${q.phase==='root'?'<p>Picture the root idea, then check your answer.</p><button id="reveal-root" class="primary wide">Continue →</button>':q.phase==='grade'?`<p>Did you remember these ideas?</p>${q.batch.map(id=>{const node=page.nodes.find(n=>n.id===id);return `<div class="grade-row"><span>${esc(node.text||'Untitled idea')}</span><div><button data-grade="yes" data-id="${id}" class="${q.grades[id]==='yes'?'positive':''}">Yes</button><button data-grade="no" data-id="${id}" class="${q.grades[id]==='no'?'negative':''}">No</button></div></div>`;}).join('')}<button id="next-quiz" class="primary wide" ${q.batch.some(id=>!q.grades[id])?'disabled':''}>Continue →</button>`:`<p>Can you name every child of this idea?</p>${q.hint?`<div class="hint-count">${children(q.current).length} connected ${children(q.current).length===1?'idea':'ideas'}</div>`:''}<button id="hint-quiz" class="primary wide">${q.hint?'Reveal?':'Hint?'}</button><button id="direct-reveal" class="text-button wide">I’m ready — show answers</button>`}${q.phase!=='grade'?`<div class="queue-label">UP NEXT · SAME DEPTH</div>${q.queue.filter(id=>id!==q.current&&depth(page.nodes.find(n=>n.id===id),page.nodes)===depth(n,page.nodes)).map(id=>`<button class="queue-item" data-jump="${id}">${q.revealed.has(id)?esc(page.nodes.find(n=>n.id===id).text):'Unrevealed root'}</button>`).join('')||'<p class="muted">Follow this branch to continue.</p>'}`:''}`}`;
}
function showBatch(ids){quiz.batch=ids;ids.forEach(id=>{quiz.visible.add(id);quiz.revealed.add(id);});quiz.phase='grade';render();fit();}
function advance(){const q=quiz;if(q.batch.length===1&&q.batch[0]===q.current&&!q.done.has(q.current)&&children(q.current).length){q.phase='children';q.hint=false;}else{q.done.add(q.current);q.queue=q.queue.filter(id=>id!==q.current);for(const id of children(q.current)){if(children(id).length&&!q.done.has(id)&&!q.queue.includes(id))q.queue.push(id);else if(!children(id).length)q.done.add(id);}q.queue.sort((a,b)=>q.plan.indexOf(a)-q.plan.indexOf(b));q.current=q.queue[0];q.phase=q.current?(q.revealed.has(q.current)?'children':'root'):'finished';q.hint=false;}render();fit();}
$('#quiz-panel').onclick=e=>{const q=quiz,b=e.target.closest('button');if(!b)return;if(b.id==='end-quiz'||b.id==='done-quiz'){quiz=null;render();fit();return;}if(b.dataset.grade){q.grades[b.dataset.id]=b.dataset.grade;render();return;}if(b.dataset.jump){q.current=b.dataset.jump;q.phase=q.revealed.has(q.current)?'children':'root';q.hint=false;render();return;}if(b.id==='reveal-root')showBatch([q.current]);if(b.id==='next-quiz')advance();if(b.id==='hint-quiz'){if(q.hint)showBatch(children(q.current));else{q.hint=true;renderQuiz();}}if(b.id==='direct-reveal')showBatch(children(q.current));};
const deleteDialog=document.createElement('dialog');
deleteDialog.id='delete-nodes-dialog';
deleteDialog.setAttribute('aria-labelledby','delete-nodes-title');
deleteDialog.innerHTML=`<form method="dialog"><h2 id="delete-nodes-title">Delete this branch?</h2><p id="delete-nodes-message"></p><div class="dialog-actions"><button value="cancel" autofocus>Cancel</button><button value="delete" class="primary">Delete nodes</button></div></form>`;
document.body.append(deleteDialog);
let pendingDeletion=null;
function removeNodes(ids){
 page.nodes=page.nodes.filter(n=>!ids.has(n.id));
 page.properties=page.properties.filter(p=>page.nodes.some(n=>n.properties.includes(p)));
 if(ids.has(active)){active=null;resetTrace();}
 selected.clear();render();save();$('#canvas').focus();
 toast(`${ids.size} ${ids.size===1?'node':'nodes'} deleted`);
}
function requestNodeDeletion(){
 const targets=selected.size?selected:new Set(active?[active]:[]);
 const ids=branchIds(page.nodes,targets);
 if(!ids.size)return;
 const hasChildren=page.nodes.some(n=>targets.has(n.parent));
 if(!hasChildren){removeNodes(ids);return;}
 const descendants=page.nodes.filter(n=>ids.has(n.id)&&ids.has(n.parent)).length;
 $('#delete-nodes-message').textContent=`This will delete ${ids.size} nodes, including ${descendants} child or descendant ${descendants===1?'node':'nodes'}. All subsequent child nodes and their connections will also be removed. This cannot be undone.`;
 pendingDeletion={pageId:page.id,ids};deleteDialog.returnValue='';deleteDialog.showModal();
}
deleteDialog.addEventListener('close',()=>{
 if(deleteDialog.returnValue==='delete'&&pendingDeletion?.pageId===page.id&&!page.readonly&&!quiz)removeNodes(pendingDeletion.ids);
 pendingDeletion=null;
});
window.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))return;if(e.key==='Escape'&&!propertiesHidden){propertiesHidden=true;renderPropertiesDropdown();$('#toggle-properties').focus();return;}if(libraryOpen){if(e.key==='Escape')setLibraryOpen(false);return;}if(e.key==='Delete'||(e.key==='Backspace'&&!e.target.isContentEditable)){if(e.target.closest('input,textarea,select')||quiz||page.readonly||e.isComposing)return;e.preventDefault();requestNodeDeletion();return;}if(e.key==='Escape'){active=null;resetTrace();if(!quiz){mode='draw';render();}}});
initializeLibrary();render();requestAnimationFrame(fit);

function folderTrail(id){const trail=[],seen=new Set();while(id&&!seen.has(id)){seen.add(id);const folder=folders.find(f=>f.id===id);if(!folder)break;trail.unshift(folder);id=folder.parent;}return trail;}
function folderLabel(id){return ['My library',...folderTrail(id).map(f=>f.name)].join(' / ');}
function thumbnail(p){if(!p.nodes.length)return `<span class="empty-preview">A fresh start</span>`;const minX=Math.min(...p.nodes.map(n=>n.x)),minY=Math.min(...p.nodes.map(n=>n.y)),w=Math.max(...p.nodes.map(n=>n.x+(n.width||210)))-minX,h=Math.max(...p.nodes.map(n=>n.y+(n.height||80)))-minY;return `<svg viewBox="${minX-35} ${minY-35} ${w+70} ${h+70}" aria-hidden="true">${p.nodes.map(n=>{const parent=p.nodes.find(a=>a.id===n.parent);return parent?`<path d="M ${parent.x+(parent.width||210)/2} ${parent.y+(parent.height||80)/2} L ${n.x+(n.width||210)/2} ${n.y+(n.height||80)/2}"/>`:'';}).join('')}${p.nodes.map(n=>`<rect x="${n.x}" y="${n.y}" width="${n.width||210}" height="${n.height||80}" rx="18"/>`).join('')}</svg>`;}
function renderLibrary(){
 if(folderId&&!folders.some(f=>f.id===folderId))folderId=null;
 const query=($('#library-search').value||'').toLowerCase();
 const childFolders=folders.filter(f=>(query|| (f.parent||null)===folderId)&&f.name.toLowerCase().includes(query));
 const childPages=pages.filter(p=>(query||(p.folderId||null)===folderId)&&p.name.toLowerCase().includes(query));
 $('#library-label').textContent=folderId?folders.find(f=>f.id===folderId).name:'My library';
 $('#map-folder').textContent=' / '+(folderTrail(page.folderId).at(-1)?.name||'My library');
 $('#breadcrumbs').innerHTML=`<button data-folder="">${icon('folder')}My library</button>`+folderTrail(folderId).map(f=>`<span>/</span><button data-folder="${f.id}">${esc(f.name)}</button>`).join('');
 $('#pages').innerHTML=childFolders.map(f=>`<button class="file-card folder-card" data-folder="${f.id}"><div class="file-preview">${icon('folder')}<span>${folders.filter(x=>x.parent===f.id).length+pages.filter(p=>p.folderId===f.id).length} items</span></div><strong>${esc(f.name)}</strong><small>Folder${query?' · '+esc(folderLabel(f.parent)):''}</small></button>`).join('')+childPages.map(p=>`<button class="file-card ${p===page?'current':''}" data-page="${p.id}"><div class="file-preview">${thumbnail(p)}</div><strong>${esc(p.name)}</strong><small>${p.nodes.length} nodes · ${p.readonly?'Notion import':'Mind map'}${query?' · '+esc(folderLabel(p.folderId)):''}</small>${p===page?'<span class="current-badge">OPEN</span>':''}</button>`).join('');
 if(!childFolders.length&&!childPages.length)$('#pages').innerHTML=`<div class="empty-library">${icon('leaf')}<h3>${query?'No matching ideas yet.':'A little space for something new.'}</h3><p>${query?'Try another name.':'Add a folder or plant your first mind map here.'}</p></div>`;
 $('#quick-files').innerHTML=folders.filter(f=>(f.parent||null)===folderId).map(f=>`<button class="quick-folder" data-folder="${f.id}">${icon('folder')}${esc(f.name)}${icon('down')}</button>`).join('')+pages.filter(p=>(p.folderId||null)===folderId).map(p=>`<button class="quick-page ${p===page?'current':''}" data-page="${p.id}">${icon('map')}<span>${esc(p.name)}</span></button>`).join('');
 $('#count').textContent=`${childFolders.length} folders · ${childPages.length} maps`;
 $('#rename-folder').hidden=!folderId;$('#delete-folder').hidden=!folderId;
}
function setLibraryOpen(open){libraryOpen=open;$('#library-dropdown').classList.toggle('hidden',!open);$('#library-toggle').setAttribute('aria-expanded',String(open));if(open){active=null;resetTrace();drawEdges();renderLibrary();}}
function handleFileClick(e){const folder=e.target.closest('[data-folder]'),file=e.target.closest('[data-page]');if(folder){folderId=folder.dataset.folder||null;$('#library-search').value='';setLibraryOpen(true);}else if(file){finishEditing();page=pages.find(p=>p.id===file.dataset.page);folderId=page.folderId||null;setLibraryOpen(false);reset();}}
function validateFolders(input, imported){
 if(!Array.isArray(input))throw Error('Invalid folder list.');const ids=new Set();
 for(const f of input){if(!f||typeof f.id!=='string'||ids.has(f.id)||typeof f.name!=='string')throw Error('Invalid folder.');ids.add(f.id);}
 for(const f of input){let parent=f.parent;const seen=new Set([f.id]);while(parent){if(!ids.has(parent)||seen.has(parent))throw Error('Invalid folder hierarchy.');seen.add(parent);parent=input.find(x=>x.id===parent).parent;}}
 const mapping=new Map(input.map(f=>[f.id,uid()]));
 for(const p of imported)p.folderId=mapping.get(p.folderId)||null;
 return input.map(f=>({id:mapping.get(f.id),name:f.name,parent:mapping.get(f.parent)||null}));
}
function initializeLibrary(){
 let editingFolder=null;
 $('#library-toggle').onclick=()=>setLibraryOpen(!libraryOpen);
 $('#breadcrumbs').onclick=handleFileClick;
 $('#library-search').oninput=renderLibrary;
 $('#expand-library').onclick=()=>{libraryExpanded=!libraryExpanded;$('#library-dropdown').classList.toggle('expanded',libraryExpanded);$('#expand-library').setAttribute('aria-label',libraryExpanded?'Collapse library':'Expand library');};
 $('#new-in-library').onclick=()=>{setLibraryOpen(false);$('#new').click();};
 $('#new').addEventListener('click',()=>setLibraryOpen(false));
 function openFolderDialog(edit){editingFolder=edit;$('#folder-dialog-title').textContent=edit?'Rename folder':'New folder';$('#folder-name').value=edit?.name||'';$('#folder-dialog').showModal();$('#folder-name').focus();}
 $('#new-folder').onclick=()=>openFolderDialog(null);
 $('#rename-folder').onclick=()=>openFolderDialog(folders.find(f=>f.id===folderId));
 $('#cancel-folder').onclick=()=>$('#folder-dialog').close();
 $('#folder-form').onsubmit=e=>{e.preventDefault();const name=$('#folder-name').value.trim();if(!name)return;if(editingFolder)editingFolder.name=name;else folders.push({id:uid(),name,parent:folderId});$('#folder-dialog').close();save();renderLibrary();};
 $('#delete-folder').onclick=()=>{const f=folders.find(f=>f.id===folderId);if(!f)return;if(!confirm(`Remove folder “${f.name}”? Its maps and subfolders will move to the parent folder. No maps will be deleted.`))return;for(const p of pages)if(p.folderId===f.id)p.folderId=f.parent;for(const child of folders)if(child.parent===f.id)child.parent=f.parent;folders=folders.filter(x=>x!==f);folderId=f.parent||null;save();renderLibrary();};
 $('#move-page').onclick=()=>{$('#move-destination').innerHTML='<option value="">My library</option>'+folders.map(f=>`<option value="${f.id}">${esc(folderLabel(f.id))}</option>`).join('');$('#move-destination').value=page.folderId||'';$('#move-dialog').showModal();};
 $('#confirm-move').onclick=()=>{page.folderId=$('#move-destination').value||null;folderId=page.folderId;$('#move-dialog').close();save();render();};
 $('#properties-dropdown').append($('#properties'));
 $('#toggle-properties').onclick=()=>{propertiesHidden=!propertiesHidden;renderPropertiesDropdown();};
 document.addEventListener('pointerdown',e=>{if(!propertiesHidden&&!e.target.closest('#properties-dropdown')){propertiesHidden=true;renderPropertiesDropdown();}});
 $('#remove-nodes').onclick=()=>{if(!quiz&&!page.readonly)requestNodeDeletion();};
 $('#pause-drawing').onclick=()=>{active=null;resetTrace();renderNodes();$('#canvas').focus();};
 $('#app-info').onclick=()=>$('#app-dialog').showModal();

 if(window.benetDesktop){$('#app-info').textContent='Desktop edition';window.benetDesktop.onMenuAction(action=>{if(['new','import','export','open-quiz'].includes(action))$('#'+action).click();});}
 document.addEventListener('pointerdown',e=>{if(libraryOpen&&!e.target.closest('.library-shell,dialog'))setLibraryOpen(false);});
}

function renderPropertiesDropdown(){
 const open=!quiz&&!propertiesHidden;
 $('#properties').classList.toggle('hidden',!open);
 $('#toggle-properties').setAttribute('aria-expanded',String(open));
 $('#toggle-properties').disabled=!!quiz;
}
