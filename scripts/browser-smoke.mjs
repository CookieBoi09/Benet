import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'4173'},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Server exited: '+code)));});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});
const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
const library=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('benet.pages.v1')));
const nodes=()=>p.locator('.node');
async function assertCentered(node){const canvas=await p.locator('#canvas').boundingBox(),box=await node.boundingBox();assert.ok(Math.abs(box.x+box.width/2-canvas.x-canvas.width/2)<1,'Editing box is horizontally centered');assert.ok(Math.abs(box.y+box.height/2-canvas.y-canvas.height/2)<1,'Editing box is vertically centered');}

async function quiz(scope=''){
 await p.click('#open-quiz');await p.selectOption('#quiz-scope',scope);await p.click('#start-quiz');
 let steps=0;
 while(!await p.locator('#done-quiz').count()){
  assert.ok(steps++<50,'Quiz terminates');
  if(await p.locator('#reveal-root').count())await p.click('#reveal-root');
  else if(await p.locator('#next-quiz').count()){for(const button of await p.locator('[data-grade="yes"]').all())await button.click();await p.click('#next-quiz');}
  else {await p.click('#hint-quiz');assert.ok(await p.locator('.hint-count').count());await p.click('#hint-quiz');}
 }
 await p.click('#done-quiz');assert.equal(await p.locator('.grade').count(),0);
}
try {
 await p.goto('http://localhost:4173');await p.locator('.node').first().waitFor();
 assert.equal(await p.locator('#properties').isVisible(),false);await p.click('#toggle-properties');assert.equal(await p.locator('#properties').isVisible(),true);await p.keyboard.press('Escape');assert.equal(await p.locator('#toggle-properties').getAttribute('aria-expanded'),'false');await p.click('#toggle-properties');await p.click('#title');assert.equal(await p.locator('#properties').isVisible(),false);
 await mkdir('artifacts',{recursive:true});await p.screenshot({path:'artifacts/forest-desktop.png'});
 await quiz();await quiz('Ideas');
 await p.click('#library-toggle');await p.click('#new-folder');await p.fill('#folder-name','Biology');await p.locator('#folder-form button.primary').click();
 await p.locator('#pages [data-folder]').filter({hasText:'Biology'}).click();
 await p.click('#new-folder');await p.fill('#folder-name','Forests');await p.locator('#folder-form button.primary').click();await p.locator('#pages [data-folder]').filter({hasText:'Forests'}).click();
 await p.click('#new-in-library');await p.fill('#title','Forest ecology');await p.locator('#title').press('Tab');
 const c=await p.locator('#canvas').boundingBox();
 await p.mouse.click(c.x+150,c.y+200);await assertCentered(nodes().first());await p.locator('.node-content').fill('Ecosystem\nA growing idea\nMore detail');await assertCentered(nodes().first());await p.locator('.node-content').fill('Ecosystem');
 for(const [x,y] of [[850,356],[900,240],[1030,240],[1050,320]])await p.mouse.move(c.x+x,c.y+y,{steps:10});
 await p.mouse.click(c.x+1050,c.y+320);await p.locator('.node-content').last().fill('Trees');await assertCentered(nodes().last());await p.click('#pause-drawing');
 assert.equal(await nodes().count(),2);assert.match(await p.locator('#edges path').getAttribute('d'),/Q/);
 const before=(await library()).at(-1),box=await p.locator('.node-content').last().boundingBox();
 await p.mouse.move(box.x+30,box.y+25);await p.mouse.down();await p.mouse.move(box.x+90,box.y+65,{steps:8});await p.mouse.up();
 const after=(await library()).at(-1);assert.equal(after.nodes[1].x,before.nodes[1].x+60);assert.deepEqual(after.nodes[1].path[0],before.nodes[1].path[0]);assert.deepEqual(after.view,before.view,'Dragging does not move the viewport');
 const geometry=after.nodes;await p.click('#zoom-in');const zoom=(await library()).at(-1).view.z;await p.locator('.node-content').first().click();await assertCentered(nodes().first());assert.equal((await library()).at(-1).view.z,zoom);assert.deepEqual((await library()).at(-1).nodes,geometry,'Focusing pans only; it does not alter nodes or connection paths');
 await p.keyboard.insertText('!');await assertCentered(nodes().first());await p.click('#pause-drawing');await p.click('#fit');

 await p.click('[data-mode="lasso"]');
 const boxes=await Promise.all((await nodes().all()).map(n=>n.boundingBox()));const padding=Math.max(...boxes.map(b=>b.height))*(Math.SQRT2-1)/2+15;const left=Math.max(c.x+5,Math.min(...boxes.map(b=>b.x))-60),top=Math.min(...boxes.map(b=>b.y))-padding,right=Math.max(...boxes.map(b=>b.x+b.width))+60,bottom=Math.max(...boxes.map(b=>b.y+b.height))+padding;
 await p.mouse.move(left,top);await p.mouse.down();for(const [x,y] of [[right,top],[right,bottom],[left,bottom],[left,top]])await p.mouse.move(x,y,{steps:12});await p.mouse.up();
 assert.equal(await p.locator('.node.selected').count(),2);await p.click('#toggle-properties');await p.fill('#property-name','Study');await p.click('#assign');assert.equal(await p.locator('.node-tags').count(),2);
 await quiz('Study');
 await p.click('#toggle-properties');await p.click('#clear-properties');assert.equal(await p.locator('.node-tags').count(),0);
 await p.click('[data-mode="draw"]');await p.locator('.node-content').first().click();await p.keyboard.press('Delete');await p.locator('#delete-nodes-dialog').waitFor();assert.match(await p.locator('#delete-nodes-message').innerText(),/2 nodes/);await p.locator('#delete-nodes-dialog button[value="cancel"]').click();assert.equal(await nodes().count(),2);
 // Folder movement and expanded browser preserve data.
 await p.click('#move-page');await p.selectOption('#move-destination',{label:'My library / Biology'});await p.click('#confirm-move');
 await p.click('#library-toggle');await p.click('#expand-library');await p.fill('#library-search','forest');assert.equal(await p.locator('#pages [data-page]').count(),1);await p.screenshot({path:'artifacts/forest-library.png'});await p.locator('#pages [data-page]').click();
 const downloadEvent=p.waitForEvent('download');await p.click('#export');const download=await downloadEvent;const backup=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(backup.folders.length,2);assert.ok(backup.pages.at(-1).nodes[1].path.length>5);
 await p.reload();await p.locator('#quick-files [data-page]').first().waitFor();await p.click('#library-toggle');await p.fill('#library-search','Forest ecology');await p.locator('#pages [data-page]').click();assert.equal(await nodes().count(),2);
 await p.setInputFiles('#file',{name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await p.waitForFunction(()=>JSON.parse(localStorage.getItem('benet.pages.v1')).length===4);
 assert.equal((await library()).length,4);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('benet.folders.v1')).length),4);
 // Backwards-compatible import without folders.
 const legacy={version:1,pages:[{id:'legacy',name:'Old map',nodes:[{id:'oldroot',text:'Legacy idea',x:100,y:150,parent:null,properties:['Keep']}],properties:['Keep'],readonly:false}]};
 await p.setInputFiles('#file',{name:'old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});await p.waitForFunction(()=>document.querySelector('#title').value==='Old map');assert.equal(await p.locator('.node-content').innerText(),'Legacy idea');
 await p.locator('.node-content').fill(Array.from({length:80},(_,i)=>'Line '+i).join('\n'));await p.keyboard.press('ControlOrMeta+End');await p.keyboard.insertText('typing');
 const caret=await p.evaluate(()=>{const s=getSelection(),r=document.createRange();r.setStart(s.focusNode,s.focusOffset);r.collapse(true);const b=r.getBoundingClientRect();const c=document.querySelector('#canvas').getBoundingClientRect();return {y:b.y,h:b.height,top:c.top,bottom:c.bottom};});assert.ok(caret.y>=caret.top&&caret.y+caret.h<=caret.bottom,'Caret stays visible in oversized boxes');await p.locator('.node-content').fill('Legacy idea');

 await p.setInputFiles('#file',{name:'Notion.md',mimeType:'text/markdown',buffer:Buffer.from('# Root\n## Branch\n- Leaf')});await p.waitForFunction(()=>document.querySelectorAll('.node').length===3);assert.equal(await p.locator('[contenteditable=true]').count(),0);await quiz();
 await p.setViewportSize({width:390,height:844});await p.screenshot({path:'artifacts/forest-mobile.png'});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('PASS: auto-centering, multiline/caret visibility, zoom and drag preservation, full/property quizzes, smoothed drawing, dragging, lasso tagging/removal, delete confirmation, folders/subfolders/search/move, backup round-trip, legacy imports, Notion quiz-only, mobile layout.');
} finally {await browser.close();server.kill();}
