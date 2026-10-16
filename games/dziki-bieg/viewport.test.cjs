const {test}=require('node:test');
const assert=require('node:assert/strict');
const {layout}=require('./dist/viewport.js');

test('phones and tablets retain at least one second of look-ahead at maximum speed',()=>{
  for(const [width,height,controls,hud] of [[292,390,106,60],[362,473,106,60],[820,330,84,54],[736,594,106,68],[976,445,106,68],[1336,620,106,68]]){
    const v=layout(width,height,{touch:true,pixelRatio:3,controls,hud});
    assert(v.width-250>=760,`${width}×${height}: obstacles appear too late`);
    assert(Math.abs(v.width*v.scale-width)<.001,'the scene must fit without cropping');
    const feet=(465+v.offsetY)*v.scale;
    assert(feet<height-controls,'controls must stay below the running surface');
    assert(feet-(294+82)*v.scale>=hud,'both jumps must fit below the HUD');
  }
});
test('wide short screens zoom out enough to preserve the jump arc',()=>{
  const portrait=layout(362,473,{touch:true,controls:106,hud:60});
  const landscape=layout(820,330,{touch:true,controls:84,hud:54});
  assert(landscape.width>portrait.width);
  assert(landscape.scale<820/1280);
  assert.equal(portrait.dpr,1);
  assert.equal(layout(362,473,{pixelRatio:3}).dpr,2);
});
test('desktop keeps its original scene dimensions and ground position',()=>{
  const v=layout(1280,600,{hud:60});
  assert.equal(v.width,1280);assert.equal(v.scale,1);assert.equal(v.offsetY,0);
});
