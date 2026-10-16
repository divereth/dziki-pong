import test from 'node:test';
import assert from 'node:assert/strict';
import {CustomerMarket} from './customers.js';
import {newState,buy,listItem,validSave} from './economy.js';
import {BOUNDS,PLAYER_SHOP} from './layout.js';
const rng=()=>.4;
test('18 klientów chodzi po targu, odwiedza stoiska i kupuje',()=>{const s=newState(rng),market=new CustomerMarket(s,()=>{},rng),old=market.customers.map(c=>({x:c.x,z:c.z}));for(let i=0;i<1200;i++)market.update(.1);assert.equal(market.customers.length,18);assert.ok(market.customers.some((c,i)=>Math.hypot(c.x-old[i].x,c.z-old[i].z)>1));assert.ok(s.marketSales>0);market.customers.forEach(c=>{assert.ok(c.x>BOUNDS.left&&c.x<BOUNDS.right);assert.ok(c.z>BOUNDS.back&&c.z<BOUNDS.front)});assert.ok(validSave(s))});
test('Klient musi dojść do straganu i obejrzeć ofertę, zanim zapłaci',()=>{const s=newState(rng);buy(s,s.offers[0].uid);listItem(s,s.inventory[0].uid,60);const events=[],market=new CustomerMarket(s,e=>events.push(e),rng);market.notifyListings();assert.equal(s.cash,65);market.update(.1);assert.equal(s.cash,65);for(let i=0;i<600;i++)market.update(.1);const sale=events.find(e=>e.player);assert.ok(sale);assert.equal(sale.price,60);assert.equal(s.cash,125);assert.equal(s.playerSales,1);const c=market.customers.find(c=>c.name===sale.name);assert.ok(c.bag);assert.ok(validSave(s))});
test('Zawyżona oferta czeka na straganie pomimo odwiedzin klientów',()=>{const s=newState(rng);buy(s,s.offers[0].uid);listItem(s,s.inventory[0].uid,2000);const market=new CustomerMarket(s,()=>{},rng);market.notifyListings();for(let i=0;i<1600;i++)market.update(.1);assert.equal(s.cash,65);assert.equal(s.inventory[0].ask,2000);assert.equal(s.playerSales,0)});
