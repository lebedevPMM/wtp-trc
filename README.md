# wtp-trc-landing

Standalone micro-landing для продукта «Налоговый сертификат резидента ОАЭ (TRC)» под новое СИДН Россия–ОАЭ 2026. Хостинг — Cloudflare Pages. Лид-форма (Имя · Телефон · Мессенджер) уходит в Bitrix24 через server-side proxy (CF Pages Function), webhook URL не виден на клиенте.

## Структура

```
index.html              ← главная страница (RU)
privacy.html            ← политика конфиденциальности
styles.css              ← cream WTP brand
form.js                 ← валидация + fetch /api/lead
functions/api/lead.js   ← CF Pages Function → Bitrix24 crm.lead.add
public/                 ← favicon + og-image
```

## GitHub Pages preview

Visual preview лендинга (без работающей формы — GH Pages не запускает CF Functions):

```
https://lebedevpmm.github.io/wtp-trc/
```

На preview форма показывает уведомление «отправка отключена, пишите в Telegram» — это ожидаемо. Реальный submit работает только на Cloudflare Pages (см. Deploy ниже).

## Локальная разработка

```bash
# Простой статический preview без функции:
python3 -m http.server 5188

# С функцией (нужен Bitrix webhook):
echo 'BITRIX_WEBHOOK_URL=https://<portal>.bitrix24.ru/rest/<USER>/<CODE>' > .dev.vars
npx wrangler pages dev . --port 5188
```

## Деплой

**1. Создать CF Pages проект (один раз):**

```bash
npx wrangler pages project create wtp-trc \
    --production-branch=main
```

**2. Установить env var (одной командой):**

```bash
npx wrangler pages secret put BITRIX_WEBHOOK_URL --project-name=wtp-trc
# (вставить значение в prompt: https://<portal>.bitrix24.ru/rest/<USER>/<CODE>)
```

Или через Dashboard → Pages → wtp-trc → Settings → Environment variables → Production → `BITRIX_WEBHOOK_URL = https://<portal>.bitrix24.ru/rest/<USER>/<CODE>`.

**Опционально:** `BITRIX_ASSIGNED_TO_ID` — ID сотрудника, который будет ответственным за входящие лиды. Если не задан, лид попадает на пользователя, создавшего вебхук.

```bash
npx wrangler pages secret put BITRIX_ASSIGNED_TO_ID --project-name=wtp-trc
# вставить число, например: 42
```

**3. Деплой:**

```bash
npx wrangler pages deploy . --project-name=wtp-trc --branch=main
```

**4. DNS + custom domain (для `trc.wtp.ae`):**

В зоне `wtp.ae` (Cloudflare):

```
CNAME  trc → wtp-trc.pages.dev   (Proxied)
```

Затем Dashboard → Pages → `wtp-trc` → Custom domains → Add → `trc.wtp.ae`.

## Bitrix payload

CF Function (`functions/api/lead.js`) шлёт POST на `${BITRIX_WEBHOOK_URL}/crm.lead.add.json` со следующим телом:

```json
{
    "fields": {
        "TITLE": "TRC Lead: <Имя>",
        "NAME": "<Имя>",
        "PHONE": [{ "VALUE": "<+...>", "VALUE_TYPE": "WORK" }],
        "COMMENTS": "Продукт: ...\nПредпочтительный мессенджер: ...\nИсточник: trc.wtp.ae\nСтраница: ...\nРеферер: ...\nUTM: ...",
        "SOURCE_ID": "WEB",
        "SOURCE_DESCRIPTION": "trc.wtp.ae",
        "UF_CRM_TELEGRAM": "<phone>"
    }
}
```

`UF_CRM_TELEGRAM` заполняется только если выбран Telegram.

## Server-side валидация

- `name`: 2–100 символов
- `phone`: regex `/^[+\d\s\-()]{7,20}$/`
- `messenger`: enum `telegram | whatsapp | phone`
- honeypot `website` — если заполнен, форма «успешно отправляется» но запрос не уходит
- UTM-ключи: `utm_source/medium/campaign/content/term` автоматически захватываются с URL и кладутся в COMMENTS

## Что НЕ делать

- Не клади webhook URL в HTML/JS/repo. Только в env var на CF Pages.
- `BITRIX_WEBHOOK_URL` (а не `VITE_BITRIX_WEBHOOK_URL`) — это server-side env, не client.
