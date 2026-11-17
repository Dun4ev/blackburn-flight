import { chapters, library, photoUrl } from './heritage.js';
import { lang } from './locale.js';

const choose = (en, ru) => lang() === 'ru' ? ru : en;
const shortNames = [
  ['First flights','Первые полеты'],['At the controls','За штурвалом'],
  ['In the barn','Находка в амбаре'],['Flying again','Снова в небе']
];

function node(tag, className, text) {
  const el=document.createElement(tag);
  if(className) el.className=className;
  if(text) el.textContent=text;
  return el;
}
function button(text, action, className) {
  const el=node('button',className,text);
  el.type='button';
  el.addEventListener('click',action);
  return el;
}
function link(label,url,className) {
  const a=node('a',className,label);
  a.href=url; a.target='_blank'; a.rel='noopener noreferrer';
  return a;
}

export function chapterIndex(hash) {
  const id=hash.split('/')[1];
  return Math.max(0,chapters.findIndex(c=>c.id===id));
}
export const chapterHash = index => '#history/'+chapters[index].id;

function rcModelFeature() {
  const card = node('article', 'journal-model');
  const figure = node('figure', 'journal-model-figure');
  const image = node('img');
  image.src = photoUrl('assets/history/blackburn-blender.jpg');
  image.width = 760;
  image.height = 451;
  image.loading = 'lazy';
  image.alt = choose('Three-quarter view of the digital Blackburn with cream fabric wings and wire-spoked wheels.',
    'Цифровая модель Blackburn вполоборота, с полотняными крыльями и колесами со спицами.');
  figure.append(image, node('figcaption', 'journal-caption',
    choose('Our digital reconstruction of the 1912 aircraft, rendered in Blender.',
      'Наша цифровая реконструкция самолета 1912 года. Изображение создано в Blender.')));

  const body = node('div', 'journal-model-body');
  body.append(node('p', 'journal-kicker', choose('RCM&E · 25 January 2012', 'RCM&E · 25 января 2012')),
    node('h2', 'journal-model-title', choose('A radio-controlled Blackburn', 'Радиоуправляемый Blackburn')),
    node('p', 'journal-prose', choose(
      'Alex Whittaker describes building and flying his 56-inch-span model. Its thin wing relies on bracing made from fishing trace wire. His plan first appeared in 2002.',
      'Алекс Уиттакер рассказывает, как построил и облетал модель с размахом крыла 1,42 м. Тонкое крыло держат расчалки из проволоки для рыболовных поводков. Чертеж впервые опубликовали в 2002 году.')),
    link(choose('Read in RCM&E', 'Читать в RCM&E'),
      'https://www.modelflying.co.uk/blackburn-monoplane/', 'journal-fly journal-model-link'));
  card.append(figure, body);
  return card;
}

export function renderHistory({index,visited,onChapter,onFly,onModel,canFly}){
  const page=document.getElementById('historyView'), chapter=chapters[index];
  const story=chapter[lang()];
  const shell=node('div','journal');
  const head=node('div','journal-head');
  const titles=node('div');
  titles.append(node('p','journal-marker','BLACKBURN TYPE D  /  G-AANI'),
    node('h1','journal-title',choose('A monoplane’s life','Жизнь одного моноплана')));
  const stamp=node('div','journal-count');
  stamp.append(node('span','',visited.length+' / '+chapters.length),
    node('small','',choose('flight rings visited','колец пройдено')));
  head.append(titles,stamp); shell.append(head);

  const timeline=node('nav','timeline');
  timeline.setAttribute('aria-label',choose('Chapters','Главы'));
  chapters.forEach((item,i)=>{
    const b=button('',()=>onChapter(i),'timeline-item');
    b.setAttribute('aria-current',i===index?'step':'false');
    const n=node('span','timeline-mark',visited.includes(i)?'✓':String(i+1));
    const name=node('span','',choose(...shortNames[i]));
    b.append(n,name);
    if(visited.includes(i))b.title=choose('Ring visited','Кольцо пройдено');
    timeline.append(b);
  });
  shell.append(timeline);
  const entry=node('article','journal-entry');
  const photo=chapter.photo || chapters.find(c=>c.photo)?.photo;
  if(photo && photoUrl(photo.file)){
    const figure=node('figure','journal-photo');
    const img=node('img');img.src=photoUrl(photo.file);img.alt=choose(photo.altEn,photo.altRu);
    const cap=node('figcaption','journal-caption');
    cap.append(node('p','',choose(photo.captionEn,photo.captionRu)));
    const meta=node('div','photo-credit');
    meta.append(link(photo.title+' · '+photo.credit,photo.source),document.createTextNode(' · '),link(photo.licence,photo.licenceUrl),
      document.createTextNode(' · '+choose(photo.changesEn,photo.changesRu)));
    cap.append(meta);figure.append(img,cap);entry.append(figure);
  }else{entry.classList.add('without-photo');}
  const body=node('div','journal-body');
  body.append(node('span','journal-kicker',story.kicker),node('h2','journal-story-title',story.title));
  const paragraphs=Array.isArray(story.text)?story.text:story.text.split(/\n+/);
  for(const paragraph of paragraphs.filter(Boolean))body.append(node('p','journal-prose',paragraph));
  const sources=node('div','source-links');
  for(const source of chapter.sources)sources.append(link(source.label,source.url));
  body.append(sources);
  const fly=button(choose('Fly to this ring →','Полететь к кольцу →'),()=>onFly(index),'journal-fly');
  fly.disabled=!canFly;body.append(fly);
  entry.append(body);shell.append(entry, rcModelFeature());

  const shelves=node('section','journal-library');
  const shelfHead=node('div','shelf-head');
  shelfHead.append(node('h2','',choose('Books, photographs & film','Книги, фотографии и кино')),
    node('span','',choose('Online collection','Материалы в интернете')));
  shelves.append(shelfHead);
  const list=node('div','shelf-list');
  const kinds={book:['Book','Книга'],film:['Film','Видео'],archive:['Archive','Архив'],museum:['Museum','Музей'],photo:['Photographs','Фотографии']};
  for(const item of library){
    const a=link('',item.url,'shelf-item');
    a.append(node('small','shelf-kind',choose(...(kinds[item.kind]||kinds.archive))));
    const desc=node('div','shelf-desc');
    const title=node('strong','',item.title);desc.append(title);
    const credit=[item.author,item.year].filter(Boolean).join(' · ');
    if(credit)desc.append(node('span','shelf-author',credit));
    if(item[lang()]?.note)desc.append(node('p','',item[lang()].note));
    a.append(desc,node('span','shelf-arrow','↗'));list.append(a);
  }
  shelves.append(list);shell.append(shelves);
  const foot=node('footer','journal-foot');
  foot.append(button(choose('About the digital reconstruction','О цифровой реконструкции'),onModel,'history'));
  shell.append(foot);
  page.replaceChildren(shell);
}
