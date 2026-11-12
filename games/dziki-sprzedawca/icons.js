// Previews are rendered from the same real 3D asset shown on the stall.
export function pict(model){if(model.startsWith('illegal_'))return '<span aria-label="Nielegalny towar" style="font-size:32px">⚠</span>';if(!/^[A-Za-z0-9_-]+$/.test(model))return '';return '<img data-model-preview="'+model+'" alt="" width="96" height="96">';}

