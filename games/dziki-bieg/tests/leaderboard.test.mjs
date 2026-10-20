import {test} from 'node:test';import assert from 'node:assert/strict';
import {qualifies} from '../dist/leaderboard.js';
test('qualifying scores use all six global places and preserve existing ties',()=>{
 const full=[600,500,400,300,200,100].map(score=>({score}));
 assert.equal(qualifies(101,full),true);assert.equal(qualifies(100,full),false);assert.equal(qualifies(99,full),false);
 assert.equal(qualifies(1,full.slice(0,5)),true);assert.equal(qualifies(1,[]),true);
 for(const score of [0,-1,1.5,NaN,Infinity])assert.equal(qualifies(score,[]),false);
});
