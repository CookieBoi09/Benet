import test from 'node:test';
import assert from 'node:assert/strict';
import {quizPlan,inside,markdownNodes,depth} from '../src/model.js';
const nodes=[{id:'r',parent:null,properties:[]},{id:'a',parent:'r',properties:['p']},{id:'aa',parent:'a',properties:['p']},{id:'b',parent:'r',properties:['p']},{id:'bb',parent:'b',properties:[]}];
test('quiz traverses breadth first, never depth first',()=>assert.deepEqual(quizPlan(nodes),['r','a','b','aa','bb']));
test('property quiz preserves original depth and excludes unrelated nodes',()=>assert.deepEqual(quizPlan(nodes,'p'),['a','b','aa']));
test('lasso selects interior points and rejects exterior points',()=>{const polygon=[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];assert.equal(inside({x:50,y:50},polygon),true);assert.equal(inside({x:120,y:50},polygon),false);});
test('Notion markdown headings and lists retain parent relationships',()=>{const n=markdownNodes('# Root\n## Branch\n- Child\n  - Grandchild\n## Other branch');assert.equal(n.length,5);assert.equal(n[1].parent,n[0].id);assert.equal(n[3].parent,n[2].id);assert.equal(n[4].parent,n[0].id);assert.equal(depth(n[3],n),3);});

test('node IDs work when the secure-context randomUUID API is unavailable', async () => {
  const {uid}=await import('../src/model.js');
  const original=Object.getOwnPropertyDescriptor(globalThis.crypto,'randomUUID');
  Object.defineProperty(globalThis.crypto,'randomUUID',{value:undefined,configurable:true});
  try {
    const ids=Array.from({length:100},()=>uid());
    assert.equal(new Set(ids).size,100);
    for(const id of ids) assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  } finally {
    if(original)Object.defineProperty(globalThis.crypto,'randomUUID',original);
    else delete globalThis.crypto.randomUUID;
  }
});

test('branch deletion includes all descendants and preserves unrelated branches', async () => {
  const {branchIds}=await import('../src/model.js');
  assert.deepEqual([...branchIds(nodes,new Set(['a']))],['a','aa']);
  assert.deepEqual([...branchIds(nodes,new Set(['aa']))],['aa']);
  assert.equal(branchIds(nodes,new Set(['r','a'])).size,5);
  assert.equal(branchIds(nodes,new Set(['missing'])).size,0);
});

test('smoothing rounds bends locally, preserves endpoints and leaves samples unchanged', async () => {
  const {smoothPath}=await import('../src/model.js');
  const points=[{x:0,y:0},{x:100,y:0},{x:100,y:100}];
  const original=structuredClone(points);
  assert.equal(smoothPath(points),'M 0 0 L 92 0 Q 100 0 100 8 L 100 100');
  assert.deepEqual(points,original);
  // A short segment limits rounding to half its length, preserving tight turns.
  assert.equal(smoothPath([{x:0,y:0},{x:2,y:0},{x:2,y:2}]),'M 0 0 L 1 0 Q 2 0 2 1 L 2 2');
});
test('smoothing handles empty, repeated, straight and reversing samples', async () => {
  const {smoothPath}=await import('../src/model.js');
  assert.equal(smoothPath([]),'');
  assert.equal(smoothPath([{x:1,y:2},{x:1,y:2}]),'M 1 2');
  assert.equal(smoothPath([{x:0,y:0},{x:10,y:0}]),'M 0 0 L 10 0');
  const result=smoothPath([{x:0,y:0},{x:10,y:0},{x:10,y:0},{x:0,y:0}]);
  assert.equal(result,'M 0 0 L 5 0 Q 10 0 5 0 L 0 0');
});

test('moving a path endpoint keeps the other attached and distributes displacement by distance', async () => {
 const {shiftPath}=await import('../src/model.js');
 const path=[{x:0,y:0},{x:25,y:0},{x:100,y:0}];
 assert.deepEqual(shiftPath(path,{x:0,y:0},{x:0,y:40}),[{x:0,y:0},{x:25,y:10},{x:100,y:40}]);
 assert.deepEqual(shiftPath(path,{x:10,y:20},{x:10,y:20}),[{x:10,y:20},{x:35,y:20},{x:110,y:20}]);
 assert.deepEqual(path,[{x:0,y:0},{x:25,y:0},{x:100,y:0}]);
});
