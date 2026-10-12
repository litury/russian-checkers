# Принятые темы меню и боя — подготовленные игровые петли

Задача t_569d0465. База: c6ebeb2264f9e5eb506aca8e90090e5e7527c5f6.
Владелец принял характер исходных menu-review / match-review из t_e9e2e3a7.
Это авторский кандидат, не независимый QA PASS и не публикация.

## Материал и обработка

Исходные 55-секундные WAV, review MP3 и исходный provenance сохранены без
изменений в attachments/t_e9e2e3a7. SHA исходников проверены; полный prompt,
seed, endpoint и generation id перенесены в provenance.json. Новых платных
вызовов не было. Старые игровые доставки доступны в git на SHA базы; новые
заменяют только две музыкальные доставки, не SFX/голоса/арт/таймеры.

У каждой темы использован один непрерывный внутренний фрагмент без затухающего
финала. Поиск согласованной фразы сравнивает pitch classes и onset целого такта
через 32 доли: меню 76 BPM, бой 94 BPM. Crossfade — 4 доли, smoothstep,
без ресэмплинга/изменения темпа. Затем циклический PCM сдвинут к границе со
стабильным уровнем. Разные мелодии не склеиваются. Native loop=true повторяет
весь декодированный буфер; прежняя runtime-подрезка 1 s удалена.

Консервативная локальная кубическая интерполяция затрагивает только серии
full/near-full-scale samples (359 меню, 2933 бой на полном исходнике).
Это приблизительное восстановление, НЕ доказательство устранения слышимых
искажений. Снижение gain само по себе клиппинг не лечит. Короткие level-matched
match-clipping-before / after и три цикла обеих петель приложены к Review.

Формат обоих delivery: MP3 192 kbps, stereo, 44100 Hz.

| Тема | Native decode | Delivery LUFS-I | True peak | Размер |
|---|---:|---:|---:|---:|
| Меню | 25.263151927 s / 1114105 frames | -15.96 | -0.89 dBTP | 608174 B |
| Бой | 20.425532880 s / 900766 frames | -16.66 | -1.25 dBTP | 491564 B |

Имена menu_music_source.mp3 и match-b-90s.mp3 сохранены ради текущего player/glob;
legacy `90s` НЕ обозначает реальную длительность. Обе петли — 8 тактов.
Музыка меню уменьшилась с 1440750 до 608174 B. Бой: 489056 -> 491564 B.

Level-match независимый, не единый loudnorm: относительно старых доставок
-13.07 LUFS-I меню / -13.76 LUFS-I бой. Сохранены music buses .45 / .16 и duck;
компенсация в musicDelivery.ts — 1.3947616576 / 1.3963683611.
При master=music=1 эффективные уровни -20.006 / -29.678 LUFS-I; при штатном
master=.4 — -27.965 / -37.636. Бой остаётся существенно тише меню.
Это измерительный match, не субъективная приёмка баланса на динамике.

## Авторская проверка

- 97 тестов / 8 файлов прошли: menuAudio.interaction, menuAudioPolicy,
  menuAudioPreview, audioMix, coldStartup, deferredSdk, soundToggle,
  musicDelivery (SHA/bytes/provenance и независимый level-match).
- npm run build: tsc --noEmit + Vite — exit 0.
- git diff --check — exit 0.
- Biome новых musicDelivery.ts, musicDelivery.spec.ts и provenance.json — exit 0.
- npm run check НЕ проходит: проектный lint/format-долг. Два затронутых
  исходных файла имеют те же 4 format/import errors, что SHA базы;
  noNonNullAssertion warnings уменьшились 10 -> 9. Полный lint не исправлялся.
  Не выдавать это за зелёный global lint.
- Isolated headless Chrome, временные browser contexts, без личного браузера.
  14 checks / 3 сценария: native gestures, cold first Play, отсутствие
  AudioContext. Native decode совпал с ffmpeg по frames и duration.
- На реальном browser timeline по три цикла обоих beds без повторных JS starts.
  OfflineAudioContext также рендерит три sample-exact повторения: ошибка 0;
  max local seam RMS change 0.075 dB, паузы/тишины нет. Эти цифры не заменяют слух.
- Пройдены меню -> бой -> сдача/итог -> меню, volume без restart, mute/unmute,
  сохранённый mute после reload, совместные controlled SDK pause/hidden,
  Play и результат при недоступном AudioContext. Uncaught page errors: 0.
- Найден и устранён cold Play late-warm баг: playCommitted мог вызвать лишний
  fetch темы меню. Central requestBuffer guard + два регрессионных теста;
  после исправления cold first Play загружает только тему боя.

## Воспроизведение и QA

Offline preparation (numpy 2.4.3, ffmpeg/ffprobe):

    /home/hermes/.hermes/hermes-agent/venv/bin/python scripts/prepare_music_loops.py /home/hermes/.hermes/kanban/boards/russian-checkers/attachments/t_e9e2e3a7 artifacts/music c6ebeb2264f9e5eb506aca8e90090e5e7527c5f6

Browser harness и evidence лежат в приложенном music-review.zip, не в production
пакете. Запуск из корня кандидата после build/preview:

    node artifacts/music/browser/scripts/music_native_seams.mjs
    node artifacts/music/browser/scripts/music_browser_smoke.mjs

Авторский preview: http://127.0.0.1:4316/. QA нужен свой свободный порт и
изолированный context; заменить base/разрешённый loopback port в harness.
Отдельно прослушать несколько музыкальных стыков и before/after clipping.
Слуховая оценка агентом, Safari/телефонный динамик, настоящая Yandex-реклама
и online не проверены. SDK и hidden в harness — управляемые lifecycle stimuli,
не доказательство поведения настоящей рекламы/OS background. Код online не менялся.

qa2: независимая проверка текущего кандидата, не дублировать старую приёмку
направления. После PASS сразу интеграция проверенного SHA в свежий main,
проверки объединённого кандидата, публикация и проверка live assets/сценария
на damka.fun по разрешению карточки. До PASS автор ничего не пушит.
