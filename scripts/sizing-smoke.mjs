import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});
const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
const fixture={id:'map',name:'Sizing',readonly:false,properties:['Review'],view:{x:0,y:0,z:1},nodes:[
 {id:'r',text:'Root',x:100,y:100,parent:null,properties:[]},
 {id:'c',text:'Child',x:500,y:100,parent:'r',properties:['Review'],path:[{x:205,y:138},{x:300,y:30},{x:450,y:160},{x:605,y:138}]}
]};
const node=id=>p.locator(`[data-node="${id}"]`),editor=id=>node(id).locator('.node-content');
const data=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('benet.pages.v1'))[0]);
async function exitNode(id){const box=await node(id).boundingBox();await p.mouse.click(box.x+box.width/2,box.y+10,{button:'right'});}
const near=(a,b)=>assert.ok(Math.abs(a-b)<.01,`${a} should equal ${b}`);
function assertAnchored(n,point){assert.ok(point.x>=n.x&&point.x<=n.x+n.width&&point.y>=n.y&&point.y<=n.y+n.height,'Connection endpoint remains inside resized box');}
try{
 await p.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',path:path.resolve('index.html')}):r.abort());await p.goto('http://benet.test/');
 await p.evaluate(f=>localStorage.setItem('benet.pages.v1',JSON.stringify([f])),fixture);await p.reload();await node('r').waitFor();
 await editor('r').fill('Hi');const editing=await data();await exitNode('r');let compact=await data();
 assert.ok(compact.nodes[0].width<editing.nodes[0].width);assert.ok(compact.nodes[0].height<editing.nodes[0].height);assert.equal(compact.nodes[0].text,'Hi');
 assert.equal(compact.nodes[0].x,editing.nodes[0].x);assert.equal(compact.nodes[0].y,editing.nodes[0].y);assert.deepEqual(compact.view,editing.view,'Finishing editing does not pan the canvas');
 assertAnchored(compact.nodes[0],compact.nodes[1].path[0]);assert.deepEqual(compact.nodes[1].path.at(-1),editing.nodes[1].path.at(-1),'Opposite endpoint stays fixed');
 // Explicit newlines and property labels fit, including incoming endpoints.
 await editor('c').fill('One\nTwo');await exitNode('c');compact=await data();assert.equal(compact.nodes[1].text,'One\nTwo');assertAnchored(compact.nodes[1],compact.nodes[1].path.at(-1));
 const tag=await node('c').locator('.node-tags span').boundingBox(),box=await node('c').boundingBox();assert.ok(tag.x>=box.x&&tag.x+tag.width<=box.x+box.width);assert.ok(tag.y+tag.height<=box.y+box.height);
 const saved=structuredClone(compact.nodes);await p.reload();await node('r').waitFor();assert.deepEqual((await data()).nodes,saved);
 // Re-editing makes room while typing; long words wrap without clipping.
 await editor('r').fill('LongWord'.repeat(35));assert.ok((await data()).nodes[0].width>=210);await exitNode('r');let long=(await data()).nodes[0];assert.equal(long.width,320);assert.equal(long.text,'LongWord'.repeat(35));
 assert.equal(await editor('r').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
 await editor('r').click();await p.keyboard.press('ControlOrMeta+A');await p.keyboard.press('Backspace');await exitNode('r');const empty=(await data()).nodes[0];assert.equal(empty.width,64);assert.ok(empty.height<76);assert.equal(empty.text.trim(),'');
 // Lasso uses each compact node's actual center, and group dragging still works.
 await editor('r').fill('R');await exitNode('r');await p.click('#fit');await p.click('[data-mode="lasso"]');
 const boxes=await Promise.all([node('r').boundingBox(),node('c').boundingBox()]),canvas=await p.locator('#canvas').boundingBox();
 const left=Math.max(canvas.x+5,Math.min(...boxes.map(b=>b.x))-40),top=Math.min(...boxes.map(b=>b.y))-40,right=Math.max(...boxes.map(b=>b.x+b.width))+40,bottom=Math.max(...boxes.map(b=>b.y+b.height))+40;
 await p.mouse.move(left,top);await p.mouse.down();for(const [x,y] of [[right,top],[right,bottom],[left,bottom],[left,top]])await p.mouse.move(x,y,{steps:8});await p.mouse.up();assert.equal(await p.locator('.node.selected').count(),2);
 const before=await data(),r=await node('r').boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.mouse.move(r.x+r.width/2+45,r.y+r.height/2+30,{steps:10});await p.mouse.up();const moved=await data();
 for(let i=0;i<2;i++){near(moved.nodes[i].x,before.nodes[i].x+45/before.view.z);near(moved.nodes[i].y,before.nodes[i].y+30/before.view.z);assert.equal(moved.nodes[i].width,before.nodes[i].width);}
 for(let i=0;i<before.nodes[1].path.length;i++){near(moved.nodes[1].path[i].x,before.nodes[1].path[i].x+45/before.view.z);near(moved.nodes[1].path[i].y,before.nodes[1].path[i].y+30/before.view.z);}
 assert.deepEqual(errors,[]);console.log('PASS: compact sizing on exit, text/line-break/tag preservation, both connection endpoints, persistence, long/empty text, and dragging lasso-selected compact nodes.');
}finally{await browser.close();}
