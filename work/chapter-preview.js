import { chapters, photoUrl } from './heritage.js';

export function createChapterPreview(host, {onRead, onDismiss}) {
  host.innerHTML = `
    <div class="trail-story" hidden>
      <button type="button" id="trailRead">
        <span class="trail-photo"><img alt=""><small></small></span>
        <span class="trail-story-copy">
          <span class="trail-chapter-number"></span>
          <strong class="trail-story-title"></strong>
          <span class="trail-teaser"></span>
          <span class="trail-read-link"></span>
        </span>
      </button>
      <button type="button" class="trail-dismiss" aria-label="Dismiss">×</button>
      <a class="trail-film" target="_blank" rel="noopener noreferrer" hidden></a>
    </div>`;
  const story = host.querySelector('.trail-story');
  const read = host.querySelector('#trailRead');
  const dismiss = host.querySelector('.trail-dismiss');
  const image = story.querySelector('img');
  const credit = story.querySelector('.trail-photo small');
  const number = story.querySelector('.trail-chapter-number');
  const title = story.querySelector('.trail-story-title');
  const teaser = story.querySelector('.trail-teaser');
  const action = story.querySelector('.trail-read-link');
  const film = story.querySelector('.trail-film');
  let activeIndex = null, lastLanguage, lastCompleted;

  read.onclick = () => { if (activeIndex !== null) onRead(activeIndex); };
  dismiss.onclick = onDismiss;

  return function update(index, language, completed) {
    story.hidden = index === null;
    if (index === null) { activeIndex = null; return; }
    if (activeIndex === index && language === lastLanguage && completed === lastCompleted) return;
    const chapter = chapters[index], copy = chapter[language], photo = chapter.photo;
    const ru = language === 'ru';
    if (image.dataset.chapter !== chapter.id) {
      image.src = photoUrl(photo.file);
      image.dataset.chapter = chapter.id;
    }
    image.alt = ru ? photo.altRu : photo.altEn;
    credit.textContent = photo.credit;
    credit.title = photo.credit + ' · ' + photo.licence;
    number.textContent = completed ? (ru ? 'Маршрут пройден' : 'Route complete') : (ru ? 'Глава ' : 'Chapter ') + (index + 1) + ' / ' + chapters.length;
    title.textContent = copy.title;
    teaser.textContent = copy.teaser;
    action.textContent = ru ? 'Читать главу →' : 'Read chapter →';
    read.setAttribute('aria-label', action.textContent.replace(' →', '') + ' · ' + copy.title);
    read.setAttribute('aria-describedby', 'trailChapterSummary');
    teaser.id = 'trailChapterSummary';
    dismiss.title = dismiss.ariaLabel = ru ? 'Скрыть карточку главы' : 'Dismiss chapter card';
    film.hidden = !chapter.filmUrl;
    if (chapter.filmUrl) {
      film.href = chapter.filmUrl;
      film.textContent = ru ? 'Смотреть полет G-AANI на YouTube ↗' : 'Watch G-AANI fly on YouTube ↗';
    }
    activeIndex = index;
    lastLanguage = language;
    lastCompleted = completed;
  };
}
