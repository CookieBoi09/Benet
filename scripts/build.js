import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const css = await read('src/style.css');
const model = (await read('src/model.js')).replace(/^export /gm, '');
const app = (await read('src/app.js')).replace(/^import .* from '\.\/model\.js';\n/, '');
const script = `${model}\n${app}`.replace(/<\/script/gi, '<\\/script');
const executable = `(() => {\n${script}\n})();`;
const hash = createHash('sha256').update(executable).digest('base64');
await writeFile(new URL('index.html', root), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src data: blob:; base-uri 'none'; object-src 'none'"><meta name="theme-color" content="#244c38"><title>Benet — space to connect</title><style>${css}</style></head>
<body><div id="app"></div><script>${executable}</script></body></html>\n`);
console.log('Built standalone index.html');
