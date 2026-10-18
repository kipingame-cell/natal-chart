# Натальная карта

![Обложка проекта](docs/assets/poster.webp)

**Планеты, дома и аспекты в браузере**

Браузерный расчёт натальной карты: планеты, дома, аспекты и русскоязычные интерпретации на Astronomy Engine.

**Тип:** Статический сайт · астрология · **Версия:** Android 1.0.0 · **Документация сверена:** 2026-10-18.

[Версии и скачивание](docs/RELEASES.md) · [Аудит и предложения](docs/AUDIT.md) · [Исходники](https://github.com/kipingame-cell/natal-chart) · [Сборки](https://github.com/kipingame-cell/natal-chart/actions)

## Возможности

- Планеты в знаках и домах, ретроградность, Асцендент и MC.
- Плацидус, аспекты и конфигурации, дополнительные расчётные точки.
- Русскоязычные интерпретации, круг карты и PDF.
- Astronomy Engine фиксирован на commit 826e26ff3a6dc03ee46658b1138fef582d96c5d9.
- Статический фронтенд; server.js и package.json в исходном проекте отсутствуют.

## Запуск и проверка

```bash
python3 -m http.server 3000 --directory public
# http://localhost:3000
# Проверки в отдельном терминале:
node --test
```

`public/vendor/astronomy.js` включён в исходники с сохранённой лицензией upstream. Серверная логика для расчёта не требуется.

## Устройство

![Схема проекта](docs/assets/architecture.svg)

Основные файлы и каталоги: `public/js/astro/ · public/js/data/ · public/vendor/ · tests/`.

## Android и проверка

[Скачать APK 1.0.0](https://github.com/kipingame-cell/natal-chart/releases/download/android-v1.0.0/Natal-Chart-1.0.0.apk) · [Релиз](https://github.com/kipingame-cell/natal-chart/releases/tag/android-v1.0.0)

Android 8.0+, `ru.kipin.natal`. Расчёты и PDF работают офлайн. Автоматический исторический UTC/DST, исправленные узлы, Лилит, скорости, южный Vertex и заполярные дома. Сборка и ключи описаны в [android/README.md](android/README.md).

299 тестов, включая 247 карт с независимыми эталонами Swiss Ephemeris, прошли. [Методика, точность и ограничения](docs/ACCURACY-2026-10-18.md). Хирон остаётся приближённым; Селена — условная модель. Android WebView-содержимое проверено в мобильном Chromium, установка на физическое устройство здесь не проверялась.

Полный список обнаруженных проблем: [AUDIT.md](docs/AUDIT.md).

Подробные материалы первоначальной редакции: [архив README](docs/README-previous.md).
