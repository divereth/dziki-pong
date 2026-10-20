import {test} from 'node:test';import assert from 'node:assert/strict';
import {qualifies,displayRows} from '../dist/leaderboard.js';
test('every nonnegative integer score is eligible regardless of other players',()=>{
 for(const score of [0,1,100,10000001,Number.MAX_SAFE_INTEGER])assert.equal(qualifies(score),true);
 for(const score of [-1,1.5,NaN,Infinity,'100'])assert.equal(qualifies(score),false);
});
test('personal ranking inserts ellipses only for gaps and preserves own row',()=>{
 const scores=[1,2,3,420,421,422,423,424,425,426,427,428].map(rank=>({rank,mine:rank===424}));
 assert.deepEqual(displayRows(scores).map(row=>row?.rank??'…'),[1,2,3,'…',420,421,422,423,424,425,426,427,428]);
 assert.equal(displayRows(scores).find(row=>row?.mine).rank,424);
 assert.deepEqual(displayRows([{rank:1},{rank:2}]),[{rank:1},{rank:2}]);
});
