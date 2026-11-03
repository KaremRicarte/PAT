// Busca fotos livres no Wikimedia Commons e salva miniaturas + créditos.
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
const UA = 'BancadaPrototype/1.0';
const Q = {
  furadeira:'Bosch drill machine', parafusadeira:'cordless screwdriver', trena:'laser distance meter', nivel:'cross line laser',
  esmerilhadeira:'angle grinder sparks', chave:'combination wrench set', torneira:'dripping tap water', lavadora:'pressure washer cleaning',
  loja:'hardware store tools', parafusos:'screw drive types heads', buchas:'wall plug dowel plastic', balcao:'hardware store counter',
  porto:'Porto de Galinhas piscinas naturais', gramado:'Gramado Natal Luz', catamara:'catamaran sailing tourists', dayuse:'hotel swimming pool palm trees',
  trilha:'Chapada Diamantina', cruzeiro:'cruise ship Brazil', buggy:'buggy dunas Genipabu', reveillon:'Copacabana fireworks new year',
  mala:'suitcase packing', serra:'Serra Gaúcha', praia:'Maragogi', guia:'grupo trilha cachoeira',
};
const strip = s => String(s||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
const credits = {};
fs.mkdirSync(OUT, {recursive:true});
for (const [key, q] of Object.entries(Q)) {
  const only = process.argv[3]; if (only && !only.split(',').includes(key)) continue;
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiextmetadatafilter=Artist|LicenseShortName&iiurlwidth=720&format=json&gsrsearch=' + encodeURIComponent(q);
  try {
    const j = await (await fetch(url, {headers:{'User-Agent':UA}})).json();
    const pages = Object.values(j.query?.pages||{}).sort((a,b)=>a.index-b.index);
    const pick = pages.find(p => { const i=p.imageinfo?.[0]; return i && i.mime==='image/jpeg' && i.width>=600; });
    if (!pick) { console.log(key, 'SEM RESULTADO'); continue; }
    const i = pick.imageinfo[0];
    const buf = Buffer.from(await (await fetch(i.thumburl, {headers:{'User-Agent':UA}})).arrayBuffer());
    fs.writeFileSync(path.join(OUT, key+'.jpg'), buf);
    credits[key] = {title:pick.title.replace(/^File:/,''), autor:strip(i.extmetadata?.Artist?.value), licenca:strip(i.extmetadata?.LicenseShortName?.value), url:i.descriptionurl};
    console.log(key, Math.round(buf.length/1024)+'KB', '|', credits[key].title, '|', credits[key].licenca);
  } catch (e) { console.log(key, 'ERRO', e.message); }
}
const cf = path.join(OUT, 'credits.json');
const prev = fs.existsSync(cf) ? JSON.parse(fs.readFileSync(cf,'utf8')) : {};
fs.writeFileSync(cf, JSON.stringify({...prev, ...credits}, null, 1));
