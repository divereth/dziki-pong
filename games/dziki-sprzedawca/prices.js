export function parsePrice(value){const clean=String(value).trim().replace(/\s/g,'');if(!/^\d+(?:[.,]\d{1,2})?$/.test(clean))return NaN;const price=Math.round(Number(clean.replace(',','.'))*100)/100;return price>=.01&&price<=5_000_000?price:NaN}
export function formatPrice(value){return String(Math.round(value*100)/100).replace('.',',')}
export function priceStep(value,direction){const step=value<20?1:value<200?5:value<2000?50:value<20000?500:5000;return Math.round(Math.max(.01,Math.min(5_000_000,value+step*direction))*100)/100}
