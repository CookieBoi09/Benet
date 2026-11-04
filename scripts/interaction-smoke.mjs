import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});
const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
const fixture={id:'map',name:'Group movement',properties:['Study'],view:{x:0,y:0,z:1},readonly:false,nodes:[
 {id:'r',text:'Outside parent',parent:null,x:100,y:100,properties:[]},
 {id:'a',text:'Selected A',parent:'r',x:400,y:180,properties:['Study'],path:[{x:205,y:138},{x:280,y:70},{x:350,y:220},{x:505,y:218}]},
 {id:'b',text:'Selected B',parent:'a',x:700,y:180,properties:['Study'],path:[{x:505,y:218},{x:590,y:300},{x:650,y:140},{x:805,y:218}]},
 {id:'c',text:'Outside child',parent:'b',x:1000,y:100,properties:[],path:[{x:805,y:218},{x:870,y:80},{x:950,y:140},{x:1105,y:138}]},
 {id:'u',text:'Unrelated edge',parent:'r',x:1000,y:420,properties:[],path:[{x:205,y:138},{x:440,y:500},{x:800,y:530},{x:1105,y:458}]},
 {id:'d',text:'Automatic edge',parent:'b',x:700,y:420,properties:[]}
]};
const node=id=>p.locator(`[data-node="${id}"]`);
const editorFor=id=>node(id).locator('.node-content');
async function dragRight(x,y,dx,dy){await p.mouse.move(x,y);await p.mouse.down({button:'right'});await p.mouse.move(x+dx,y+dy,{steps:8});await p.mouse.up({button:'right'});}
const data=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('benet.pages.v1'))[0]);
const near=(a,b,message)=>assert.ok(Math.abs(a-b)<.001,message+`: ${a} vs ${b}`);
async function settle(){await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function reset(){await p.evaluate(f=>{localStorage.setItem('benet.pages.v1',JSON.stringify([f]));localStorage.removeItem('benet.folders.v1');},fixture);await p.reload();await node('a').waitFor();await settle();}
async function drag(x,y,dx,dy){await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+dx,y+dy,{steps:12});await p.mouse.up();}
function verifyMove(before,after,ids,dx,dy){
 assert.deepEqual(after.view,before.view,'Dragging must not auto-center or pan');
 for(let i=0;i<before.nodes.length;i++){
  const old=before.nodes[i],n=after.nodes[i],moves=ids.has(old.id),source=ids.has(old.parent);
  near(n.x,old.x+(moves?dx:0),'Node x');near(n.y,old.y+(moves?dy:0),'Node y');
  assert.equal(n.parent,old.parent);assert.equal(n.text,old.text);assert.deepEqual(n.properties,old.properties);
  if(!old.path)continue;
  if(!moves&&!source){assert.deepEqual(n.path,old.path,'Unrelated path stays unchanged');continue;}
  for(const [index,moved] of [[0,source],[old.path.length-1,moves]]){
   near(n.path[index].x,old.path[index].x+(moved?dx:0),'Connection endpoint x');near(n.path[index].y,old.path[index].y+(moved?dy:0),'Connection endpoint y');
  }
  if(moves&&source)for(let j=0;j<old.path.length;j++){near(n.path[j].x,old.path[j].x+dx,'Internal path translates once');near(n.path[j].y,old.path[j].y+dy,'Internal path translates once');}
 }
}
try{
 await p.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',path:path.resolve('index.html')}):r.abort());await p.goto('http://benet.test/');await reset();
 // Expanded hit target works outside the visible box, including at a zoomed scale.
 let before=await data(),box=await node('r').boundingBox();
 await drag(box.x-30*before.view.z,box.y+box.height/2,45,25);
 verifyMove(before,await data(),new Set(['r']),45/before.view.z,25/before.view.z);
 assert.equal(await p.locator('.node').count(),6,'Halo drag must not create a node');
 await reset();await p.click('[data-mode="lasso"]');
 const a=await node('a').boundingBox(),b=await node('b').boundingBox(),z=(await data()).view.z;
 const left=a.x-50*z,top=a.y-25*z,right=b.x+b.width+50*z,bottom=Math.max(a.y+a.height,b.y+b.height)+25*z;
 await p.mouse.move(left,top);await p.mouse.down();for(const [x,y] of [[right,top],[right,bottom],[left,bottom],[left,top]])await p.mouse.move(x,y,{steps:10});await p.mouse.up();
 assert.deepEqual(await p.locator('.node.selected').evaluateAll(ns=>ns.map(n=>n.dataset.node)),['a','b']);
 before=await data();const automatic=await p.locator('#edges path').last().getAttribute('d');box=await node('a').boundingBox();
 await drag(box.x+30,box.y+30,54,-30);let after=await data();verifyMove(before,after,new Set(['a','b']),54/z,-30/z);
 assert.notEqual(await p.locator('#edges path').last().getAttribute('d'),automatic,'Generated external connections also update');
 assert.equal(await p.locator('.node.selected').count(),2);assert.equal(await p.locator('.draft-edge').count(),0);
 // Repeat from the expanded halo in Move mode with a different zoom.
 await p.click('[data-mode="pan"]');await p.click('#zoom-in');before=await data();box=await node('b').boundingBox();
 await drag(box.x+box.width+20*before.view.z,box.y+box.height/2,-30,42);after=await data();verifyMove(before,after,new Set(['a','b']),-30/before.view.z,42/before.view.z);
 const saved=structuredClone(after.nodes);await p.reload();await node('a').waitFor();assert.deepEqual((await data()).nodes,saved,'Group movement survives reload');
 // A visible node must beat the expanded hit area of a later overlapping neighbour.
 const overlap=structuredClone(fixture);overlap.nodes=[{...overlap.nodes[0],x:100,y:100},{...overlap.nodes[1],parent:null,path:null,x:300,y:100}];
 await p.evaluate(f=>localStorage.setItem('benet.pages.v1',JSON.stringify([f])),overlap);await p.reload();await node('r').waitFor();await settle();before=await data();box=await node('r').boundingBox();
 await drag(box.x+box.width-25*before.view.z,box.y+box.height/2,20,10);verifyMove(before,await data(),new Set(['r']),20/before.view.z,10/before.view.z);
 // Plain Enter and Shift+Enter keep editing and persist text; right-click exits.
 await node('r').locator('.node-content').click();await p.keyboard.press('ControlOrMeta+End');await p.keyboard.press('Enter');await p.keyboard.insertText('Second line');await p.keyboard.press('Shift+Enter');await p.keyboard.insertText('Third line');
 assert.equal(await node('r').locator('.node-content').evaluate(el=>el===document.activeElement),true);
 const text=(await data()).nodes[0].text;assert.match(text,/Outside parent\nSecond line\nThird line/);
 box=await node('r').boundingBox();await p.mouse.click(box.x+30,box.y+30,{button:'right'});
 assert.equal(await p.locator('.node-content:focus').count(),0);assert.equal(await p.locator('.draft-edge').count(),0);
 await p.reload();await node('r').waitFor();assert.equal((await data()).nodes[0].text,text);
 // Right-button panning works over nodes in every mode without editing geometry.
 await reset();
 for(const mode of ['draw','lasso','pan']){
  await p.click(`[data-mode="${mode}"]`);await p.click('#zoom-in');before=await data();box=await node('a').boundingBox();
  await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down({button:'right'});await p.mouse.move(box.x+box.width/2+70,box.y+box.height/2+40,{steps:8});await p.mouse.up({button:'right'});
  const after=await data();near(after.view.x,before.view.x+70,'Right-pan x');near(after.view.y,before.view.y+40,'Right-pan y');assert.equal(after.view.z,before.view.z);assert.deepEqual(after.nodes,before.nodes);assert.equal(await p.locator('.draft-edge').count(),0);
 }
 // Captured right-drag remains active outside the canvas; releasing stops it.
 await reset();const canvas=await p.locator('#canvas').boundingBox();before=await data();
 await p.mouse.move(canvas.x+20,canvas.y+100);await p.mouse.down({button:'right'});await p.mouse.move(canvas.x-10,canvas.y+50,{steps:5});await p.mouse.up({button:'right'});
 let view=(await data()).view;near(view.x,before.view.x-30,'Outside pan x');near(view.y,before.view.y-50,'Outside pan y');await p.mouse.move(canvas.x+200,canvas.y+200);assert.deepEqual((await data()).view,view);
 assert.equal(await p.locator('#canvas').evaluate(el=>el.classList.contains('panning')),false);
 // A simple right-click exits and resizes without moving the viewport.
 await editorFor('r').fill('Edited text');before=await data();box=await node('r').boundingBox();await p.mouse.click(box.x+box.width/2,box.y+10,{button:'right'});
 assert.deepEqual((await data()).view,before.view);assert.equal((await data()).nodes[0].text,'Edited text');assert.equal((await data()).nodes[0].fitted,true);assert.equal(await p.locator('.node-content:focus').count(),0);
 // Quiz recall state and read-only data survive panning.
 await p.click('#open-quiz');await p.click('#start-quiz');const quizText=await p.locator('#quiz-panel').innerText();before=await data();
 await dragRight(canvas.x+150,canvas.y+200,30,-20);assert.deepEqual((await data()).nodes,before.nodes);assert.equal(await p.locator('#quiz-panel').innerText(),quizText);await p.click('#end-quiz');
 const imported=structuredClone(fixture);imported.readonly=true;await p.evaluate(f=>localStorage.setItem('benet.pages.v1',JSON.stringify([f])),imported);await p.reload();await node('r').waitFor();await settle();before=await data();await dragRight(canvas.x+150,canvas.y+200,-40,35);const afterReadonly=await data();near(afterReadonly.view.x,before.view.x-40,'Read-only pan');assert.deepEqual(afterReadonly.nodes,before.nodes);
 assert.deepEqual(errors,[]);console.log('PASS: enlarged hit targets, visible-box priority, lasso group movement at different zoom levels, internal/incoming/outgoing/unrelated paths, persistence, Enter/Shift+Enter, right-click exit, and right-button panning across modes, quizzes, read-only maps, and canvas boundaries.');
}finally{await browser.close();}
