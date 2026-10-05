import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
let sample=0,sequence=[],calls=0;
const context=vm.createContext({crypto:{getRandomValues(array){calls++;array[0]=sequence.length?sequence.shift():sample;return array}}});
vm.runInContext(script.split('const setup=')[0],context);
const {limit,recommend,advance,randomBelow}=context;
let transitions=0;
for(const own of [1,2])for(const other of [1,2])for(const parent of [false,true]){
  const max=parent?other:own;
  const drawn=[];
  for(sample=0;sample<=max;sample++)drawn.push(recommend({own,other,parent}));
  assert.deepEqual(drawn,Array.from({length:max+1},(_,i)=>i));
  for(const chosen of drawn)for(let opponent=0;opponent<=max;opponent++){
    const state={own,other,parent,chosen},next=advance(state,opponent),hit=chosen===opponent;
    assert.equal(next.own,own-(hit&&parent?1:0));
    assert.equal(next.other,other-(hit&&!parent?1:0));
    assert.deepEqual(state,{own,other,parent,chosen});
    assert.equal(limit(state),max);transitions++;
  }
  for(const invalid of [-1,max+1,0.5,NaN])assert.throws(()=>advance({own,other,parent,chosen:0},invalid));
}
sequence=[4294967295,1];calls=0;
assert.equal(randomBelow(3),1);assert.equal(calls,2);
assert.throws(()=>advance({own:0,other:2,parent:true,chosen:0},0));
assert.throws(()=>advance({own:2,other:0,parent:false,chosen:0},0));
// Independently solve the alternating two-state Bellman equations for each pair of counts.
const values=Array.from({length:3},()=>Array(3));
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-14,`${actual} != ${expected}`);
let pureResponses=0;
for(let own=1;own<=2;own++)for(let other=1;other<=2;other++){
  const hitOwn=own===1?1:values[own-1][other].child;
  const hitOther=other===1?0:values[own][other-1].parent;
  const p=1/(other+1),q=1/(own+1);
  const parent=(p*hitOwn+(1-p)*q*hitOther)/(1-(1-p)*(1-q));
  const child=q*hitOther+(1-q)*parent;
  values[own][other]={parent,child};
  assert.ok(hitOwn>child);assert.ok(hitOther<parent);
  // Every pure opposing guess or raised count gives the same value against the uniform policy.
  for(let guess=0;guess<=other;guess++){
    let payoff=0;for(let raised=0;raised<=other;raised++)payoff+=(guess===raised?hitOwn:child)/(other+1);
    close(payoff,parent);pureResponses++;
  }
  for(let raised=0;raised<=own;raised++){
    let payoff=0;for(let guess=0;guess<=own;guess++)payoff+=(guess===raised?hitOther:parent)/(own+1);
    close(payoff,child);pureResponses++;
  }
}
close(values[1][1].parent,2/3);close(values[1][2].parent,5/6);close(values[2][1].parent,1/4);
close(values[2][2].parent,11/20);close(values[2][2].child,9/20);
assert.ok(!/<(?:script[^>]*src|link[^>]*href=["']https?:|img)/i.test(html));
const report={bytes:Buffer.byteLength(html),states:8,transitions,pureResponses,firstPlayerWinProbability:values[2][2].parent,secondPlayerWinProbability:values[2][2].child};
fs.writeFileSync(new URL('verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
