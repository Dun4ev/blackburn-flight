// File paths are project-relative. The standalone build replaces each path with a JPEG data URL.
const museum = 'https://www.shuttleworth.org/discover/collection/aircraft/blackburn-monoplane';
const flight = 'https://archive.org/details/Flight_International_Magazine_1913-03-29-pdf/page/n10/mode/1up';
const periodPhotos = 'https://archive.org/details/Flight_International_Magazine_1913-04-05-pdf/page/n17/mode/1up';
const jackson = 'https://flyingmachines.ru/Site2/Crafts/Craft28749.htm';
const modelBuilder = 'https://outerzone.co.uk/download_file.asp?FileType=Supp&Filename=1912_Blackburn_Monoplane_oz12266_transcript.pdf&planID=12266';
const pilotLecture = 'https://www.loughborough-raes.org.uk/ewExternalFiles/160216%20Flying%20Shuttleworth%20Aircraft.pdf';
const displayFilm = 'https://www.youtube.com/watch?v=ivlwiNweARA';
const commons = 'https://commons.wikimedia.org/wiki/File:';

// The journal and in-flight cards share the same embedded images.
let photoUrls;
export function photoUrl(file) {
  photoUrls ??= JSON.parse(document.getElementById('historyPhotos').textContent);
  return photoUrls[file];
}

function photograph(file, credit, version, page, title, altEn, altRu, captionEn, captionRu) {
  return {
    file: 'assets/history/' + file, credit, title,
    licence: 'CC BY-SA ' + version,
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/' + version + '/',
    source: commons + page,
    altEn, altRu, captionEn, captionRu,
    changesEn: 'Resized and recompressed for offline viewing.',
    changesRu: 'Размер и степень сжатия изменены для просмотра без сети.'
  };
}

export const chapters = [
  {
    id: 'easter',
    en: {
      kicker: 'Leeds · Easter 1913',
      title: 'Foggin takes the controls',
      teaser: 'His Easter Monday flight in 1913 lasted nearly twenty minutes.',
      text: 'Newly qualified pilot Cyril Foggin ordered his own single-seater from Robert Blackburn in October 1912. At the Easter demonstrations near Leeds, Harold Blackburn flew it around Wakefield. On Easter Monday, 24 March, Foggin finally took his turn. Flight reported that he stayed up for nearly twenty minutes. Hundreds of spectators had come to watch the two men fly.'
    },
    ru: {
      kicker: 'Лидс · Пасха 1913 года',
      title: 'Фоггин берется за штурвал',
      teaser: 'На Пасху 1913 года он провел в воздухе почти двадцать минут.',
      text: 'В октябре 1912 года Сирил Фоггин, недавно получивший свидетельство пилота, заказал у Роберта Блэкберна одноместный самолет. На пасхальных показах под Лидсом Гарольд Блэкберн облетел на нем окрестности Уэйкфилда. В понедельник, 24 марта, за штурвал впервые сел сам заказчик. По сообщению журнала Flight, Фоггин провел в воздухе почти двадцать минут. За полетами обоих пилотов наблюдали сотни зрителей.'
    },
    sources: [{label:'Flight · 29.03.1913 · p. 359',url:flight},{label:'Flight · 05.04.1913 · p. 392',url:periodPhotos},{label:'Shuttleworth Collection',url:museum}],
    photo: photograph('old-warden-2018.jpg','Alan Wilson','2.0','1912_Blackburn_Type_D_Monoplane_(G-AANI)_(40992016760).jpg',
      '1912 Blackburn Type D Monoplane (G-AANI)',
      'The preserved Blackburn standing on the grass, seen from behind its left wing.',
      'Сохранившийся моноплан на траве, вид со стороны хвоста и левого крыла.',
      'The surviving aircraft at Old Warden, 3 June 2018.',
      'Сохранившийся самолет на аэродроме Олд-Уорден, 3 июня 2018 года.')
  },
  {
    id: 'controls',
    en: {
      kicker: 'Cockpit · Wing warping',
      title: 'A wheel that twists the wings',
      teaser: 'A turn of the wheel pulled the cables and twisted the wing tips.',
      text: 'Turn the little wheel and cables pull on the rear wing spars. The trailing edges twist in opposite directions, changing the lift on each side and banking the aircraft. The pilot works the rudder with a foot bar. Ahead of the cockpit, all seven cylinders of the 50 hp Gnôme Omega revolve with the propeller. The curved metal cowling helps keep hot oil out of the pilot’s face.'
    },
    ru: {
      kicker: 'Кабина · Перекос крыла',
      title: 'Штурвал, который скручивает крылья',
      teaser: 'Поворот штурвала натягивал тросы и менял форму крыла.',
      text: 'Пилот поворачивает небольшой штурвал, и тросы тянут за задние лонжероны крыла. Задние кромки слева и справа отклоняются в разные стороны. Разность подъемных сил создает крен. Ногами пилот поворачивает поперечную педаль руля направления. Перед кабиной вместе с винтом вращаются все семь цилиндров двигателя Gnôme Omega мощностью 50 л. с. Изогнутый капот прикрывает лицо пилота от горячего масла.'
    },
    sources:[{label:'Sid Miller · Model Builder · 1982',url:modelBuilder},{label:'Roger Bailey · RAeS · 2016',url:pilotLecture},{label:'Shuttleworth Collection',url:museum}],
    photo: photograph('cockpit-2013.jpg','TSRL','3.0','Blackburn_Type_D_cockpit.JPG',
      'Blackburn Type D cockpit',
      'View forward from behind the cockpit, with its steering wheel and varnished dashboard.',
      'Вид сзади на открытый кокпит, штурвал и лакированную приборную доску.',
      'The real control wheel at Old Warden, 22 September 2013.',
      'Штурвал подлинного моноплана в Олд-Уордене, 22 сентября 2013 года.')
  },
  {
    id: 'barn',
    en: {
      kicker: 'Wittering · 1914 to the 1930s',
      title: 'An aeroplane behind the hay',
      teaser: 'Parts of the Blackburn lay behind the hay for over twenty years.',
      text: 'After Foggin sold the Blackburn, its next owner, M. F. Glew, crashed it on his father’s farm at Wittering. Its parts went into storage in 1914. More than twenty years later, hay still concealed pieces of the airframe at the back of a barn. Richard Shuttleworth acquired them for restoration. In his history of Blackburn, A. J. Jackson records that the dismantled engine and parts of a second one turned up in a barrel.'
    },
    ru: {
      kicker: 'Уиттеринг · С 1914-го до 1930-х',
      title: 'Самолет за стогом сена',
      teaser: 'Части моноплана пролежали в амбаре больше двадцати лет.',
      text: 'Следующий владелец самолета, М. Ф. Глю, потерпел аварию на ферме своего отца в Уиттеринге. В 1914 году детали убрали на хранение. Больше двадцати лет спустя части планера нашли в глубине амбара за сеном. Ричард Шаттлворт приобрел их для восстановления. По данным историка авиации А. Дж. Джексона, разобранный двигатель и детали еще одного мотора обнаружили в бочке.'
    },
    sources:[{label:'Shuttleworth Collection',url:museum},{label:'A. J. Jackson · Blackburn Single-Seat Monoplane',url:jackson}],
    photo: photograph('hangar-2023.jpg','Alan Wilson','2.0','1912_Blackburn_Type_D_Monoplane_-G-AANI_BAPC-5-_(52608247489).jpg',
      '1912 Blackburn Type D Monoplane [G-AANI / BAPC-5]',
      'Restored aircraft in the museum hangar, with the wooden propeller and rotary engine in view.',
      'Восстановленный самолет в музейном ангаре. Видны деревянный винт и цилиндры двигателя.',
      'The restored Blackburn in Hangar 5, Old Warden, 2 January 2023.',
      'Восстановленный Blackburn в музейном ангаре № 5, Олд-Уорден, 2 января 2023 года.')
  },
  {
    id: 'return', filmUrl: displayFilm,
    en: {
      kicker: 'Henlow · September 1949',
      title: 'Back in the air',
      teaser: 'The rebuilt Blackburn flew again at Henlow in September 1949.',
      text: 'The restorers saved the original wing fittings and curved wooden tips, but made new main spars. On 17 September 1949, A. H. Wheeler flew the rebuilt Blackburn at Henlow. The aircraft has needed hands-on care ever since. In 1988 its fabric covering was renewed. Weather permitting, the Shuttleworth Collection still flies it at Old Warden.'
    },
    ru: {
      kicker: 'Хенлоу · Сентябрь 1949 года',
      title: 'Возвращение в небо',
      teaser: 'В сентябре 1949 года в Хенлоу восстановленный Blackburn снова поднялся в воздух.',
      text: 'Реставраторы сохранили исходные крепления крыльев и гнутые деревянные законцовки. Главные лонжероны пришлось изготовить заново. 17 сентября 1949 года А. Х. Уилер поднял восстановленный Blackburn в воздух в Хенлоу. С тех пор самолет продолжали обслуживать. В 1988 году ему заменили полотняную обшивку. В подходящую погоду коллекция Шаттлворта по-прежнему показывает моноплан в полете в Олд-Уордене.'
    },
    sources:[{label:'A. J. Jackson · Blackburn Single-Seat Monoplane',url:jackson},{label:'Shuttleworth Collection',url:museum},{label:'High Flight · Old Warden',url:displayFilm}],
    photo: photograph('display-2018.jpg','Airwolfhound','2.0','Blackburn_Monoplane_-_Season_Premiere_Airshow_2018_(41272925715).jpg',
      'Blackburn Monoplane - Season Premiere Airshow 2018',
      'The Blackburn airborne in profile, pilot visible and propeller turning against a clear sky.',
      'Моноплан в полете на фоне ясного неба. Видны пилот в открытой кабине и вращающийся винт.',
      'G-AANI flying at the 2018 Season Premiere Airshow.',
      'G-AANI в полете на открытии сезона авиашоу 2018 года.')
  }
];

export const library = [
  {kind:'film', title:'Blackburn Monoplane - The Shuttleworth Collection',author:'High Flight',year:'2020',url:displayFilm,
    en:{note:'Footage of the actual G-AANI at the 2020 Vintage Airshow, Old Warden. The year refers to the display.'},
    ru:{note:'Съемка подлинного G-AANI на Vintage Airshow в Олд-Уордене. Указан год авиашоу.'}},
  {kind:'archive',title:'The Blackburn at Leeds',author:'Flight',year:'1913',url:flight,
    en:{note:'Scan of the 29 March issue, page 359. Read the report of Foggin’s Easter flight in the right-hand column.'},
    ru:{note:'Скан номера от 29 марта. Заметка о пасхальном полете Фоггина напечатана в правой колонке страницы 359.'}},
  {kind:'photo',title:'Foggin’s Blackburn at Leeds',author:'Flight',year:'1913',url:periodPhotos,
    en:{note:'Two period photographs of Foggin’s aircraft at the foot of page 392, 5 April. The caption gives 60 hp, while the museum lists the Gnôme Omega at 50 hp.'},
    ru:{note:'Два снимка самолета Фоггина в нижней части страницы 392 номера от 5 апреля. Подпись указывает 60 л. с., музей приводит для Gnôme Omega значение 50 л. с.'}},
  {kind:'film',title:'1912 Blackburn Monoplane Type D',author:'High Flight',year:'2019',url:'https://www.youtube.com/watch?v=pAGJ9_YwD5Y',
    en:{note:'A second display by the original aircraft, filmed at the 2019 Shuttleworth Military Pageant at Old Warden.'},
    ru:{note:'Другой полет оригинального самолета. Запись сделана на авиапразднике Shuttleworth Military Pageant 2019 года в Олд-Уордене.'}},
  {kind:'book',title:'Blackburn Aircraft since 1909',author:'A. J. Jackson',year:'1968',url:'https://libraries.essex.gov.uk/manifestations/69DC044957C3442E9D384C5DF4E074:991478',
    en:{note:'Putnam’s company history. Look for the section “Blackburn Single-Seat Monoplane”. The link opens the Essex library catalogue.'},
    ru:{note:'История фирмы, изданная Putnam. Самолету посвящен раздел «Blackburn Single-Seat Monoplane». Ссылка ведет в библиотечный каталог Эссекса.'}},
  {kind:'book',title:'British Aircraft Before the Great War',author:'Michael H. Goodall & Albert E. Tagg',year:'2001',url:'https://schifferbooks.com/collections/schiffer-military/products/british-ac-bfr-great-war',
    en:{note:'An illustrated survey of British pioneer aircraft, including the Blackburn single-seater. Publisher’s page, ISBN 9780764312076.'},
    ru:{note:'Иллюстрированный обзор ранних британских самолетов, включая одноместный Blackburn. Страница издателя, ISBN 9780764312076.'}},
  {kind:'archive',title:'Flying Early Aircraft - Flying Qualities in the Early Years',author:'Roger Bailey · Mike Hirst',year:'2016',url:pilotLecture,
    en:{note:'Lecture notes from Shuttleworth’s chief pilot. Includes the Blackburn in the aircraft table and explains how a rotary engine feels in flight.'},
    ru:{note:'Конспект лекции шеф-пилота коллекции Шаттлворта. Есть таблица с данными Blackburn и объяснение того, как вращающийся двигатель влияет на поведение самолета.'}},
  {kind:'museum',title:'Blackburn Monoplane',author:'Shuttleworth Collection',year:'',url:museum,
    en:{note:'The owner’s record for G-AANI, with its history, span, length, engine and photographs.'},
    ru:{note:'Карточка G-AANI у владельца самолета. В ней приведены история, размеры, сведения о двигателе и фотографии.'}},
  {kind:'photo',title:'Blackburn Type D Monoplane of the Shuttleworth Collection',author:'Wikimedia Commons',year:'',url:'https://commons.wikimedia.org/wiki/Category:Blackburn_Type_D_Monoplane_of_the_Shuttleworth_Collection',
    en:{note:'More photographs of this aircraft. Each file has its own photographer credit and reuse terms.'},
    ru:{note:'Другие фотографии этого самолета. В описании каждого файла указаны фотограф и условия использования.'}}
];
