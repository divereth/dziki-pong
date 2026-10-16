import {MarketWorld} from './world.js';
import {CustomerMarket} from './customers.js';
import {TouchJoystick} from './joystick.js';
import {parsePrice,formatPrice,priceStep} from './prices.js';
import {pict} from './icons.js';
import {CATALOG,GOAL,CAPACITY,SAVE_KEY,LEGACY_SAVE_KEY,getItem,itemValue,suggestedPrice,wealth,listedItems,newState,buy,listItem,withdrawListing,nextDay,refillSoldOffers,checkWin,restoreSave} from './economy.js';

const $=id=>document.getElementById(id),money=n=>new Intl.NumberFormat('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const icon=name=>`<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const canvas=$('scene'),frame=$('world'),inventory=$('inventory-dialog'),help=$('help-dialog'),negotiation=$('negotiation-dialog');
let state,loaded=false,saveAvailable=true;
try{const raw=localStorage.getItem(SAVE_KEY)||localStorage.getItem(LEGACY_SAVE_KEY);if(raw){state=restoreSave(JSON.parse(raw));loaded=!!state}}catch{saveAvailable=false}
state||=newState();
let world,market,started=false,running=false,touchMode=matchMedia('(any-pointer:coarse)').matches||navigator.maxTouchPoints>0;
let targetId=null,targetCustomer=null,negotiationId=null,activeSeconds=0,lastTime=performance.now(),lastUI=0,lastHUD=0,lastRefill=0,lastSave=0,simTime=0,gesture=null,soundEnabled=false,audioContext,toastTimer,deliveryTimer,inventorySignature='';
const keys=new Set(),drafts=new Map();
const joystick=new TouchJoystick($('joystick'),$('stick-thumb'),()=>running&&touchMode);
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));$('save-status').textContent='Postęp zapisany automatycznie.'}catch{saveAvailable=false;$('save-status').textContent='Zapis jest niedostępny w tej przeglądarce.'}}
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4200)}
function tone(type='buy'){if(!soundEnabled)return;try{audioContext||=new AudioContext();audioContext.resume();const now=audioContext.currentTime;for(const [i,f] of (type==='sell'?[523,659,784]:[587,880]).entries()){const o=audioContext.createOscillator(),g=audioContext.createGain();o.frequency.value=f;g.gain.setValueAtTime(.001,now+i*.09);g.gain.linearRampToValueAtTime(.04,now+i*.09+.015);g.gain.exponentialRampToValueAtTime(.001,now+i*.09+.3);o.connect(g);g.connect(audioContext.destination);o.start(now+i*.09);o.stop(now+i*.09+.32)}}catch{}}
function setTouchMode(value){touchMode=value;document.body.classList.toggle('touch-mode',value);$('touch-controls').hidden=!value||!running;$('touch-toggle').setAttribute('aria-pressed',String(value));$('touch-toggle').textContent=`Sterowanie dotykowe: ${value?'wł.':'wył.'}`;$('intro-controls').textContent=value?'Lewy kciuk — ruch · Prawy — rozglądanie · Dotknij klienta, by porozmawiać':'WASD · ruch   Mysz · rozglądanie   E · działanie';if(world){world.renderer.setPixelRatio(Math.min(devicePixelRatio,value?1:1.5));world.resize()}joystick.reset()}
function updateUI(){
  $('cash').innerHTML=`${money(state.cash)} <small>zł</small>`;$('stock-count').textContent=`${state.inventory.length}/${CAPACITY}`;$('day-label').textContent=`Dzień ${String(state.day).padStart(2,'0')}`;
  $('goal-fill').style.width=`${Math.min(100,wealth(state)/GOAL*100)}%`;
  $('goal-caption').textContent=state.won?'Milion osiągnięty. Grasz dalej!':'Cel: 1 000 000 zł';
  if(!started){$('start-btn').innerHTML=`${loaded||state.trades?'Kontynuuj grę':'Otwieram interes'} ${icon('next')}`;$('intro-copy').innerHTML=loaded||state.trades?`Dzień ${state.day}. W portfelu ${money(state.cash)} zł.<br>Twoje oferty i klienci czekają.`:'Masz 100 zł i własny stragan.<br>Znajdź okazję. Ustal cenę. Dogadaj się z klientem.'}
  if(inventory.open)renderInventory();
  document.body.dataset.cash=String(state.cash);document.body.dataset.inventory=String(state.inventory.length);document.body.dataset.listings=String(listedItems(state).length);document.body.dataset.sales=String(state.playerSales);document.body.dataset.day=String(state.day);
}
function syncStock(){world?.setPlayerStock(listedItems(state),CATALOG);market?.notifyListings()}
function priceControls(entry){const value=drafts.get(entry.uid)??formatPrice(entry.ask??suggestedPrice(entry,state)),base=itemValue(entry,state),listed=entry.ask!==null;return `<div class="price-presets"><button type="button" data-preset="${entry.uid}" data-factor="0.9">Szybko · ${money(base*.9)} zł</button><button type="button" data-preset="${entry.uid}" data-factor="1.02">Rynkowa · ${money(base*1.02)} zł</button><button type="button" data-preset="${entry.uid}" data-factor="1.2">+20% · ${money(base*1.2)} zł</button></div><form class="price-form" data-list="${entry.uid}"><button type="button" class="step-btn" data-step="${entry.uid}" data-direction="-1" aria-label="Obniż cenę: ${getItem(entry.itemId).name}">−</button><div class="price-input"><input id="price-${entry.uid}" data-price="${entry.uid}" type="text" inputmode="decimal" autocomplete="off" aria-label="Cena sprzedaży: ${getItem(entry.itemId).name}" value="${escape(value)}"><span>zł</span></div><button type="button" class="step-btn" data-step="${entry.uid}" data-direction="1" aria-label="Podnieś cenę: ${getItem(entry.itemId).name}">+</button><button class="primary" type="submit">${listed?'Zapisz cenę':'Wystaw'}</button>${listed?`<button type="button" class="withdraw-btn" data-withdraw="${entry.uid}">Wycofaj</button>`:''}</form>`}
function renderInventory(){
  $('dialog-capacity').textContent=`${state.inventory.length}/${CAPACITY}`;$('sell-total').textContent=`Na straganie: ${listedItems(state).length} ofert`;$('list-all').disabled=!state.inventory.some(e=>e.ask===null);
  const signature=JSON.stringify([state.inventory,state.market]);
  if(signature!==inventorySignature){
    const active=document.activeElement,activeId=active?.dataset?.price,selection=activeId?[active.selectionStart,active.selectionEnd]:null;
    $('inventory-list').innerHTML=state.inventory.length?state.inventory.map(e=>`<article class="inventory-row"><span class="item-picture">${pict(getItem(e.itemId).model)}</span><div class="listing-info"><h3>${getItem(e.itemId).name}</h3><p>Kupiono: ${money(e.paid)} zł · Wartość: ${money(itemValue(e,state))} zł</p><span class="listing-state ${e.ask!==null?'listed':''}">${e.ask!==null?`● Wystawiono za ${money(e.ask)} zł`:'W plecaku · wybierz cenę poniżej'}</span>${priceControls(e)}<p class="price-guide">Możesz użyć przycisków lub wpisać kwotę z przecinkiem.</p></div></article>`).join(''):'<div class="empty-state">Twój następny dobry interes czeka na targu.<br>Kup przedmiot, a tutaj wystawisz go z własną ceną.</div>';
    inventorySignature=signature;
    if(activeId&&$(`price-${activeId}`)){const input=$(`price-${activeId}`);input.focus({preventScroll:true});if(selection)input.setSelectionRange(...selection)}
  }
  const historySignature=JSON.stringify(state.history);if($('sales-history').dataset.signature!==historySignature){$('sales-history').dataset.signature=historySignature;$('sales-history').innerHTML=state.history.length?`<h3>Ostatnie sprzedaże</h3>${state.history.map(h=>`<div><span>${escape(h.name)} · ${getItem(h.itemId).name}</span><b>${money(h.price)} zł</b></div>`).join('')}`:''}
}
function setDraft(uid,value){drafts.set(uid,formatPrice(value));const input=$(`price-${uid}`);if(input)input.value=formatPrice(value)}
function submitListing(uid){const price=parsePrice($(`price-${uid}`)?.value);if(!Number.isFinite(price)){$('listing-feedback').textContent='Podaj kwotę od 0,01 do 5 000 000 zł, np. 68,50.';return}const result=listItem(state,uid,price);if(!result.ok){toast(result.message);return}drafts.delete(uid);syncStock();updateUI();save();tone();$('listing-feedback').textContent=`Wystawiono: ${result.item.name} za ${money(price)} zł. Klienci mogą już składać oferty.`}
function openInventory(){if(inventory.open)return;pause();$('pause-card').hidden=true;renderInventory();inventory.showModal();$('listing-feedback').textContent='Gotowe ceny działają jednym dotknięciem. Zatwierdź przyciskiem Wystaw. Targ działa podczas ustalania cen.'}
function openNegotiation(id){
  if(anyDialog())return;const result=market.beginNegotiation(id);if(!result.ok){toast(result.message);return}pause();$('pause-card').hidden=true;negotiationId=id;renderNegotiation(`„Za tę cenę odpuszczę. Mogę zapłacić ${money(result.counter)} zł.”`);negotiation.showModal();
}
function renderNegotiation(message){
  const c=market.customers.find(c=>c.id===negotiationId),deal=c?.negotiation,entry=state.inventory.find(e=>e.uid===deal?.uid);$('negotiation-name').textContent=c?`Rozmowa: ${c.name}`:'Rozmowa zakończona';$('negotiation-speech').textContent=message;
  if(deal&&entry){$('negotiation-item').innerHTML=`<span class="item-picture">${pict(getItem(entry.itemId).model)}</span><div><h3>${getItem(entry.itemId).name}</h3><p>Twoja cena: ${money(entry.ask)} zł · Kupiono: ${money(entry.paid)} zł</p></div>`;$('accept-counter').hidden=false;$('accept-counter').textContent=`Zgoda — ${money(deal.counter)} zł`;$('negotiation-price').value=formatPrice(deal.counter);$('negotiation-rounds').textContent=`Pozostałe próby: ${3-deal.rounds}`;$('negotiation-form').hidden=false}
  else{$('accept-counter').hidden=true;$('negotiation-form').hidden=true;$('negotiation-rounds').textContent='Rozmowa zakończona'}
}
function propose(price){if(!Number.isFinite(price)){renderNegotiation('Wpisz poprawną kwotę, np. 65,50.');return}const result=market.offer(negotiationId,price);if(result.ok){negotiationId=null;negotiation.close();return}if(result.reason==='counter')renderNegotiation(`„To nadal za dużo. Moja propozycja to ${money(result.counter)} zł.”`);else if(result.reason==='ended')renderNegotiation('„Nie dogadamy się dzisiaj. Może innym razem.”');else renderNegotiation('Ten przedmiot nie jest już dostępny. Rozmowa dobiegła końca.')}
function onCustomerSale(result){
  if(result.player){drafts.delete(result.uid);syncStock();tone('sell');toast(`${result.name}: „${result.negotiated?'Dogadane!':'Biorę!'}” +${money(result.price)} zł`);$('listing-feedback').textContent=`${result.name} kupuje ${result.item.name.toLowerCase()} za ${money(result.price)} zł.`}
  else{world.removeOffer(result.uid);if(targetId===result.uid){targetId=null;$('interaction').hidden=true}}
  updateUI();save();testWin();
}
function testWin(){if(checkWin(state)){save();pause();for(const d of document.querySelectorAll('dialog[open]'))d.close();$('win-detail').textContent=`Masz ${money(state.cash)} zł. Dzień ${state.day}, ${state.playerSales} sprzedaży. Twój dziki interes może rosnąć dalej.`;$('win-dialog').showModal()}}
function advanceDay(){const result=nextDay(state);activeSeconds=0;targetId=null;world.setOffers(state.offers,CATALOG);syncStock();updateUI();save();toast(result.recovery?'Pomogłeś rozstawić stragany. Masz 25 zł na powrót do handlu.':`Dzień ${state.day}. Nowe oferty i notowania. Twoje ceny pozostają aktywne.`)}
function interaction(){
  const candidate=world.pickCustomer(),c=market.customers.find(c=>c.id===candidate),talk=c?.stage==='waiting';targetCustomer=talk?candidate:null;targetId=world.target();
  const kiosk=world.nearKiosk();$('crosshair').classList.toggle('target',targetId!==null||talk||kiosk);$('interaction').hidden=!(targetId!==null||talk||kiosk);$('aim-hint').hidden=!$('interaction').hidden;
  $('touch-buy').textContent=talk?'Rozmawiaj':kiosk?'Stragan':'Kup / E';
  const signature=`${targetId}:${targetCustomer}:${kiosk}:${state.cash}:${state.inventory.length}`;if($('interaction').dataset.signature===signature)return;$('interaction').dataset.signature=signature;
  if(talk){$('interaction').innerHTML=`<div class="item-heading"><span class="item-picture">${icon('chat')}</span><div><span class="item-kind">KLIENT CZEKA NA CIEBIE</span><h3>${c.name}: „Za drogo”</h3></div></div><div class="item-prices"><span>Porozmawiaj i zaproponuj własną cenę.<br>Klient może jeszcze zmienić zdanie.</span></div><button class="item-action" data-talk="${c.id}"><kbd>E</kbd> Negocjuj</button>`;return}
  if(kiosk){$('interaction').innerHTML=`<div class="item-heading"><span class="item-picture">${icon('bag')}</span><div><span class="item-kind">TWÓJ STRAGAN</span><h3>Twoje ceny. Twój interes.</h3></div></div><div class="item-prices"><span>Aktywne oferty: ${listedItems(state).length} / 8</span><span>Sprzedaże: ${state.playerSales}</span></div><button class="item-action" data-inventory><kbd>E</kbd> Otwórz plecak i ceny</button>`;return}
  const offer=state.offers.find(o=>o.uid===targetId&&!o.sold);if(!offer)return;const value=itemValue(offer,state),profit=Math.round((value/offer.price-1)*100),available=state.cash>=offer.price&&state.inventory.length<CAPACITY;
  $('interaction').innerHTML=`<div class="item-heading"><span class="item-picture">${pict(getItem(offer.itemId).model)}</span><div><span class="item-kind">${offer.quality>1?'STAN KOLEKCJONERSKI':offer.quality<1?'ŚLADY UŻYWANIA':'BARDZO DOBRY STAN'}</span><h3>${getItem(offer.itemId).name}</h3></div><span class="bargain ${profit<0?'bad':''}">${profit>=0?'+':''}${profit}%</span></div><div class="item-prices"><div>Cena sprzedawcy<br><strong>${money(offer.price)} zł</strong></div><span>Wartość: ${money(value)} zł<br>Cenę sprzedaży ustalisz sam.</span></div><button class="item-action" data-buy ${available?'':'disabled'}><kbd>E</kbd> ${state.inventory.length>=CAPACITY?'Plecak pełny':state.cash<offer.price?'Za mało gotówki':'Kup przedmiot'}</button>`;
}
function act(){if(!running)return;if(targetCustomer!==null){openNegotiation(targetCustomer);return}if(world.nearKiosk()){openInventory();return}if(targetId===null){toast('Podejdź i wyceluj w przedmiot lub klienta.');return}const result=buy(state,targetId);if(!result.ok){toast(result.message);return}world.removeOffer(targetId);targetId=null;$('interaction').hidden=true;updateUI();save();tone();toast(`Kupiono: ${result.item.name}. Otwórz plecak i wybierz cenę.`)}
function tapAt(x,y){if(!running)return;const id=world.pickCustomer(x,y);if(id!==null){const c=market.customers.find(c=>c.id===id);if(c?.stage==='waiting')openNegotiation(id);else toast(`${c.name}: „Rozglądam się po targu.”`)}}
function anyDialog(){return !!document.querySelector('dialog[open]')}
function clearInput(){keys.clear();gesture=null;joystick.reset();$('touch-run').setAttribute('aria-pressed','false')}
function pause(){if(!started)return;running=false;clearInput();$('pause-card').hidden=anyDialog();$('crosshair').hidden=true;$('interaction').hidden=true;$('aim-hint').hidden=true;$('touch-controls').hidden=true;if(document.pointerLockElement)document.exitPointerLock();save()}
async function start(){if(!world)return;started=true;running=true;clearInput();$('intro').hidden=true;$('pause-card').hidden=true;$('crosshair').hidden=false;$('aim-hint').hidden=false;$('touch-controls').hidden=!touchMode;canvas.focus({preventScroll:true});market.notifyListings();if(!touchMode)try{const p=canvas.requestPointerLock?.();if(p?.catch)await p}catch{toast('Przytrzymaj mysz i przeciągaj, by się rozejrzeć. Kliknij klienta, by rozmawiać.')}lastTime=performance.now()}
function closeDialog(dialog){dialog.close()}
function onClose(event){if(event.target===negotiation&&negotiationId!==null){market.cancelNegotiation(negotiationId);negotiationId=null}if(started&&!running&&!anyDialog()){$('pause-card').hidden=false;canvas.focus({preventScroll:true})}}
function resetGame(){state=newState();loaded=false;started=false;running=false;activeSeconds=0;lastRefill=0;simTime=0;drafts.clear();inventorySignature='';market=new CustomerMarket(state,onCustomerSale);world.camera.position.set(.2,1.8,7.4);world.yaw=.08;world.pitch=-.055;world.camera.rotation.set(world.pitch,world.yaw,0);world.setOffers(state.offers,CATALOG);syncStock();help.close();$('intro').hidden=false;$('pause-card').hidden=true;$('reset-confirm').hidden=true;$('reset-btn').hidden=false;clearInput();save();updateUI()}

$('start-btn').addEventListener('click',start);$('resume-btn').addEventListener('click',start);$('pause-btn').addEventListener('click',()=>running?pause():started?start():null);
for(const id of ['inventory-btn','portfolio-btn'])$(id).addEventListener('click',openInventory);
$('back-to-market').addEventListener('click',()=>{inventory.close();start()});$('next-day').addEventListener('click',advanceDay);$('help-btn').addEventListener('click',()=>{pause();$('pause-card').hidden=true;help.showModal()});
$('fullscreen-btn').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await frame.requestFullscreen()}catch{toast('Ta przeglądarka nie udostępnia pełnego ekranu. Obróć urządzenie, aby powiększyć widok.')}});
$('sound-btn').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('sound-btn').textContent=`Dźwięk: ${soundEnabled?'wł.':'wył.'}`;$('sound-btn').setAttribute('aria-pressed',String(soundEnabled));if(soundEnabled)tone()});$('touch-toggle').addEventListener('click',()=>setTouchMode(!touchMode));
$('inventory-list').addEventListener('input',e=>{if(e.target.dataset.price)drafts.set(Number(e.target.dataset.price),e.target.value)});
$('inventory-list').addEventListener('focusin',e=>{if(e.target.dataset.price&&!drafts.has(Number(e.target.dataset.price)))e.target.select()});
$('inventory-list').addEventListener('submit',e=>{const form=e.target.closest('[data-list]');if(form){e.preventDefault();submitListing(Number(form.dataset.list))}});
$('inventory-list').addEventListener('click',e=>{const preset=e.target.closest('[data-preset]'),step=e.target.closest('[data-step]'),withdraw=e.target.closest('[data-withdraw]');
  if(preset){const uid=Number(preset.dataset.preset),entry=state.inventory.find(i=>i.uid===uid);if(entry){setDraft(uid,itemValue(entry,state)*Number(preset.dataset.factor));preset.parentElement.querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b===preset))}}
  if(step){const uid=Number(step.dataset.step),entry=state.inventory.find(i=>i.uid===uid),value=parsePrice($(`price-${uid}`).value);if(entry)setDraft(uid,priceStep(Number.isFinite(value)?value:suggestedPrice(entry,state),Number(step.dataset.direction)))}
  if(withdraw){const uid=Number(withdraw.dataset.withdraw);if(market.reservations.has(uid)){toast('Ten przedmiot jest zarezerwowany do rozmowy.');return}withdrawListing(state,uid);drafts.delete(uid);syncStock();save();updateUI()}
});
$('list-all').addEventListener('click',()=>{let count=0;for(const entry of state.inventory)if(entry.ask===null){listItem(state,entry.uid,itemValue(entry,state)*Number($('bulk-strategy').value));drafts.delete(entry.uid);count++}syncStock();save();updateUI();$('listing-feedback').textContent=`Wystawiono ${count} przedmiotów. Twoje wcześniejsze ceny pozostały bez zmian.`});
$('interaction').addEventListener('click',e=>{const talk=e.target.closest('[data-talk]');if(talk)openNegotiation(Number(talk.dataset.talk));else if(e.target.closest('[data-inventory]'))openInventory();else if(e.target.closest('[data-buy]'))act()});
$('accept-counter').addEventListener('click',()=>{const c=market.customers.find(c=>c.id===negotiationId);if(c?.negotiation)propose(c.negotiation.counter)});
$('negotiation-form').addEventListener('submit',e=>{e.preventDefault();propose(parsePrice($('negotiation-price').value))});
for(const [id,direction] of [['negotiation-minus',-1],['negotiation-plus',1]])$(id).addEventListener('click',()=>{const value=parsePrice($('negotiation-price').value);$('negotiation-price').value=formatPrice(priceStep(Number.isFinite(value)?value:1,direction))});
$('negotiation-price').addEventListener('focus',e=>e.target.select());$('leave-negotiation').addEventListener('click',()=>closeDialog(negotiation));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeDialog(b.closest('dialog'))));document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',onClose));
$('reset-btn').addEventListener('click',()=>{$('reset-confirm').hidden=false;$('reset-btn').hidden=true});$('reset-no').addEventListener('click',()=>{$('reset-confirm').hidden=true;$('reset-btn').hidden=false});$('reset-yes').addEventListener('click',resetGame);$('keep-playing').addEventListener('click',()=>{$('win-dialog').close();start()});
document.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;if(e.repeat)return;if(e.code==='KeyB'&&!help.open&&!negotiation.open&&!$('win-dialog').open){e.preventDefault();if(inventory.open){inventory.close();start()}else openInventory();return}if(anyDialog())return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&started)e.preventDefault();if(e.code==='Escape'&&running){pause();return}if(e.code==='KeyE'&&running){act();return}if(e.code==='KeyN'&&started){advanceDay();return}if(running)keys.add(e.code)});
document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{if(running)pause();else clearInput()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)pause()});document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&running&&!touchMode)pause()});
document.addEventListener('mousemove',e=>{if(running&&document.pointerLockElement===canvas)world.look(e.movementX,e.movementY)});
canvas.addEventListener('pointerdown',e=>{if(!running)return;if(e.pointerType==='touch'&&!touchMode)setTouchMode(true);if(document.pointerLockElement===canvas){const id=world.pickCustomer();if(id!==null&&market.customers.find(c=>c.id===id)?.stage==='waiting')openNegotiation(id);else act();return}if(gesture)return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,time:performance.now(),moved:false};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!running||!gesture||e.pointerId!==gesture.id)return;const dx=e.clientX-gesture.lastX,dy=e.clientY-gesture.lastY;if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>8)gesture.moved=true;world.look(dx*(e.pointerType==='touch'?1.65:1),dy*(e.pointerType==='touch'?1.65:1));gesture.lastX=e.clientX;gesture.lastY=e.clientY});
canvas.addEventListener('pointerup',e=>{if(!gesture||e.pointerId!==gesture.id)return;const tap=!gesture.moved&&performance.now()-gesture.time<600;gesture=null;if(tap)tapAt(e.clientX,e.clientY)});canvas.addEventListener('pointercancel',()=>{gesture=null});canvas.addEventListener('lostpointercapture',()=>{gesture=null});
$('touch-buy').addEventListener('click',act);$('touch-jump').addEventListener('pointerdown',e=>{e.preventDefault();keys.add('Space');e.currentTarget.setPointerCapture(e.pointerId)});for(const event of ['pointerup','pointercancel','lostpointercapture'])$('touch-jump').addEventListener(event,()=>keys.delete('Space'));
$('touch-run').addEventListener('click',()=>{const on=!keys.has('ShiftLeft');if(on)keys.add('ShiftLeft');else keys.delete('ShiftLeft');$('touch-run').setAttribute('aria-pressed',String(on))});

try{world=new MarketWorld(canvas,{mobile:touchMode});market=new CustomerMarket(state,onCustomerSale);world.setOffers(state.offers,CATALOG);syncStock();world.syncCustomers(market.customers,0);document.body.dataset.ready='true'}catch(error){console.error(error);$('start-btn').disabled=true;const el=document.createElement('div');el.className='webgl-error';el.textContent='Nie udało się uruchomić grafiki 3D. Włącz akcelerację sprzętową i odśwież stronę.';frame.prepend(el);$('intro').hidden=true;document.body.dataset.ready='error'}
setTouchMode(touchMode);updateUI();if(loaded)save();if(!saveAvailable)$('save-status').textContent='Zapis jest niedostępny w tej przeglądarce.';
function loop(time){
  const dt=Math.min((time-lastTime)/1000,1);lastTime=time;
  if(world){
    const simulating=started&&(running||inventory.open||negotiation.open)&&!document.hidden;
    if(simulating){let remaining=dt;while(remaining>0){const step=Math.min(remaining,.033);simTime+=step;state.elapsed+=step;activeSeconds+=step;market.update(step);if(running)world.move(keys,step,simTime,joystick.value);remaining-=step}world.syncCustomers(market.customers,simTime);
      if(state.elapsed-lastRefill>=1){lastRefill=state.elapsed;const arrivals=refillSoldOffers(state);if(arrivals.length){arrivals.forEach(o=>world.addOffer(o,CATALOG));const noun={one:'przedmiot',few:'przedmioty',many:'przedmiotów',other:'przedmiotu'}[new Intl.PluralRules('pl-PL').select(arrivals.length)];$('delivery-note').textContent=`Nowa dostawa · ${arrivals.length} ${noun}`;$('delivery-note').classList.add('visible');clearTimeout(deliveryTimer);deliveryTimer=setTimeout(()=>$('delivery-note').classList.remove('visible'),3500);save()}}
      if(state.elapsed-lastSave>=8){save();lastSave=state.elapsed}if(activeSeconds>=240&&!negotiation.open)advanceDay();
    }
    if(running&&time-lastUI>100){interaction();lastUI=time}
    if(time-lastHUD>500){const minutes=9*60+Math.floor(Math.min(240,activeSeconds)/240*9*60);$('clock-label').textContent=`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;$('area-name').textContent=world.nearKiosk()?'TWÓJ STRAGAN':world.camera.position.z<-40?'NOWY PASAŻ HANDLOWY':world.camera.position.z<-15?'ALEJA SMAKÓW I STYLU':'ALEJA OKAZJI';lastHUD=time}
    world.render(simTime);world.map($('minimap').getContext('2d'),market?.customers||[]);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
