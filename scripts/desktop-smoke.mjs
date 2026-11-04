import { _electron as electron } from 'playwright';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const temp=await mkdtemp(path.join(tmpdir(),'benet-desktop-'));
const runner=path.join(temp,'runner.cjs');
await writeFile(runner,`const {app}=require('electron');app.setPath('userData',${JSON.stringify(path.join(temp,'profile'))});require(${JSON.stringify(path.resolve('desktop/main.cjs'))});`);
const args=[...(process.platform==='linux'?['--no-sandbox','--ozone-platform=headless','--disable-gpu']:[]),runner];
const env={...process.env,XDG_CACHE_HOME:path.join(temp,'cache'),XDG_CONFIG_HOME:path.join(temp,'config')};
let desktop=await electron.launch({args,env});
try {
 let p=await desktop.firstWindow();await p.locator('.node').first().waitFor();assert.equal(await p.evaluate(()=>typeof window.require),'undefined');assert.equal(await p.locator('#app-info').innerText(),'Desktop edition');
 const backupPath=path.join(temp,'backup.json');
 await desktop.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},backupPath);
 await p.click('#export');await p.waitForFunction(()=>document.querySelector('#toast').textContent==='Library backup saved.');
 const backup=JSON.parse(await readFile(backupPath,'utf8'));assert.equal(backup.pages.length,1);
 await desktop.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},backupPath);
 await p.click('#import');await p.waitForFunction(()=>JSON.parse(localStorage.getItem('benet.pages.v1')).length===2);
 await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('menu:action','new'));
 await p.waitForFunction(()=>document.querySelector('#title').value==='Untitled mind map');await p.fill('#title','Desktop persistence');await p.locator('#title').press('Tab');
 await desktop.close();desktop=await electron.launch({args,env});p=await desktop.firstWindow();await p.locator('#title').waitFor();
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('benet.pages.v1')).at(-1).name),'Desktop persistence');
 console.log('PASS: Electron launch, isolated renderer, native import/export handlers with simulated file selection, menu action, persistence across app restart.');
} finally {await desktop.close();}
