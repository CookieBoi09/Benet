import {execFileSync} from 'node:child_process';
import {mkdtemp, readdir, mkdir, writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {_electron as electron} from 'playwright';

const arch=process.argv[2];
assert.equal(process.platform,'darwin','DMG verification must run on macOS');
assert.ok(['arm64','x64'].includes(arch),'Specify arm64 or x64');
assert.equal(process.arch,arch,'Use a runner matching the packaged architecture');
const images=(await readdir('dist')).filter(file=>file.endsWith(`-${arch}.dmg`));
assert.equal(images.length,1,'Expected exactly one DMG for this architecture');
const dmg=path.resolve('dist',images[0]);
const temp=await mkdtemp(path.join(tmpdir(),'benet-dmg-'));
const mount=path.join(temp,'volume');await mkdir(mount);
const command=(name,args)=>execFileSync(name,args,{stdio:'inherit'});
command('hdiutil',['verify',dmg]);
let mounted=false,application;
try {
 command('hdiutil',['attach','-nobrowse','-readonly','-mountpoint',mount,dmg]);mounted=true;
 const bundle=path.join(mount,'Benet.app');
 command('codesign',['--verify','--deep','--strict','--verbose=2',bundle]);
 command('codesign',['--display','--verbose=2',bundle]);
 const executable=path.join(bundle,'Contents','MacOS','Benet');
 const architectures=execFileSync('lipo',['-archs',executable],{encoding:'utf8'}).trim().split(/\s+/);
 assert.ok(architectures.includes(arch==='x64'?'x86_64':'arm64'),'Packaged CPU architecture does not match the download name');
 application=await electron.launch({executablePath:executable,args:[`--user-data-dir=${path.join(temp,'profile')}`],timeout:60000});
 const page=await application.firstWindow();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.locator('#app-info').waitFor();assert.equal(await page.locator('#app-info').innerText(),'Desktop edition');
 await page.click('#new');await page.fill('#title','Packaged launch check');await page.locator('#title').press('Tab');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('benet.pages.v1')).at(-1).name),'Packaged launch check');
 assert.deepEqual(errors,[]);
} finally {
 try {if(application)await application.close();}
 finally {if(mounted)command('hdiutil',['detach',mount]);}
}
const hash=createHash('sha256');for await(const chunk of createReadStream(dmg))hash.update(chunk);
await writeFile(dmg+'.sha256',`${hash.digest('hex')}  ${path.basename(dmg)}\n`);
console.log('Verified disk image, bundle signatures, architecture, packaged startup and saving. Checksum written.');
