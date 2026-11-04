export function uid() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  // HTTP previews may expose getRandomValues without the secure-context UUID API.
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function depth(node, nodes) {
  let d = 0, seen = new Set([node.id]);
  while (node.parent) { node = nodes.find(n => n.id === node.parent); if (!node || seen.has(node.id)) break; seen.add(node.id); d++; }
  return d;
}
export function quizPlan(nodes, property = '') {
  return nodes.filter(n => !property || n.properties.includes(property)).map((n,i) => ({n,i,d:depth(n,nodes)})).sort((a,b) => a.d-b.d || a.i-b.i).map(x => x.n.id);
}
export function branchIds(nodes, selectedIds) {
  const children = new Map();
  for (const node of nodes) {
    if (!children.has(node.parent)) children.set(node.parent, []);
    children.get(node.parent).push(node.id);
  }
  const existing = new Set(nodes.map(node => node.id));
  const result = new Set(), queue = [...selectedIds].filter(id => existing.has(id));
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (result.has(id)) continue;
    result.add(id);
    queue.push(...(children.get(id) || []));
  }
  return result;
}
// Round each corner locally rather than fitting a spline that can overshoot.
// The original samples remain unchanged, including both endpoints.
export function smoothPath(points, radius = 8) {
  const samples = points.filter((p, i) => !i || p.x !== points[i-1].x || p.y !== points[i-1].y);
  if (!samples.length) return '';
  let path = `M ${samples[0].x} ${samples[0].y}`;
  for (let i = 1; i < samples.length - 1; i++) {
    const prev = samples[i-1], p = samples[i], next = samples[i+1];
    const incoming = Math.hypot(p.x-prev.x, p.y-prev.y);
    const outgoing = Math.hypot(next.x-p.x, next.y-p.y);
    const trim = Math.min(Math.max(0, radius), incoming/2, outgoing/2);
    const entry = {x:p.x+(prev.x-p.x)*trim/incoming, y:p.y+(prev.y-p.y)*trim/incoming};
    const exit = {x:p.x+(next.x-p.x)*trim/outgoing, y:p.y+(next.y-p.y)*trim/outgoing};
    path += ` L ${entry.x} ${entry.y} Q ${p.x} ${p.y} ${exit.x} ${exit.y}`;
  }
  if (samples.length > 1) {
    const end = samples.at(-1);
    path += ` L ${end.x} ${end.y}`;
  }
  return path;
}
export function shiftPath(points, startDelta, endDelta) {
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances[i-1] + Math.hypot(points[i].x-points[i-1].x, points[i].y-points[i-1].y));
  const total = distances.at(-1) || 0;
  return points.map((p,i) => {
    const t = total ? distances[i]/total : i/Math.max(1,points.length-1);
    return {x:p.x+startDelta.x*(1-t)+endDelta.x*t, y:p.y+startDelta.y*(1-t)+endDelta.y*t};
  });
}
export function inside(point, polygon) {
  let result = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i], b=polygon[j];
    if ((a.y>point.y)!==(b.y>point.y) && point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) result=!result;
  }
  return result;
}
export function markdownNodes(markdown) {
  const nodes=[], stack=[];
  for (const line of markdown.split('\n')) {
    if (!line.trim() || /^\s*```/.test(line)) continue;
    const heading=line.match(/^(#{1,6})\s+(.*)/), list=line.match(/^(\s*)(?:[-*+] |\d+\. )(.*)/);
    const level=heading ? heading[1].length-1 : list ? 6+Math.floor(list[1].replace(/\t/g,'  ').length/2) : 7;
    const text=(heading ? heading[2] : list ? list[2] : line.trim()).replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/[*_`]/g,'').trim();
    if (!text) continue;
    while (stack.length && stack.at(-1).level>=level) stack.pop();
    const parent=stack.at(-1)?.node;
    const node={id:uid(),text,parent:parent?.id || null,x:80+(parent ? depth(parent,nodes)+1 : 0)*260,y:80+nodes.length*120,properties:[]};
    nodes.push(node); stack.push({level,node});
  }
  return nodes;
}
