// Cloudflare Pages Function — POST /api/lead
// Receives lead form data, sanitises, posts to Bitrix24 webhook (URL hidden in env).

const PHONE_RE = /^[+\d\s\-()]{7,20}$/;
const ALLOWED_MESSENGERS = ['telegram', 'whatsapp', 'phone'];

const messengerLabel = {
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    phone: 'Звонок',
};

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function clampString(value, max) {
    return String(value || '').slice(0, max);
}

export const onRequestPost = async ({ request, env }) => {
    const webhook = env.BITRIX_WEBHOOK_URL;
    if (!webhook) {
        return jsonResponse(500, { error: 'Server not configured' });
    }

    let payload;
    try {
        payload = await request.json();
    } catch (_) {
        return jsonResponse(400, { error: 'Invalid JSON' });
    }

    const name = clampString(payload.name, 100).trim();
    const phone = clampString(payload.phone, 20).trim();
    const messenger = ALLOWED_MESSENGERS.includes(payload.messenger) ? payload.messenger : null;
    const utm = (payload.utm && typeof payload.utm === 'object') ? payload.utm : {};
    const page = clampString(payload.page, 500);
    const referrer = clampString(payload.referrer, 500);

    if (name.length < 2) return jsonResponse(400, { error: 'Invalid name' });
    if (!PHONE_RE.test(phone)) return jsonResponse(400, { error: 'Invalid phone' });
    if (!messenger) return jsonResponse(400, { error: 'Invalid messenger' });

    const utmLines = Object.entries(utm)
        .filter(([, v]) => v)
        .map(([k, v]) => `  ${clampString(k, 50)}: ${clampString(v, 200)}`)
        .join('\n') || '  нет';

    const commentLines = [
        'Продукт: Налоговый сертификат резидента ОАЭ (TRC)',
        `Предпочтительный мессенджер: ${messengerLabel[messenger]}`,
        'Источник: TRC Landing (trc.wtp.ae)',
        `Страница: ${page || '—'}`,
        `Реферер: ${referrer || '—'}`,
        'UTM:',
        utmLines,
    ];

    const fields = {
        TITLE: `TRC Lead: ${name}`,
        NAME: name,
        PHONE: [{ VALUE: phone, VALUE_TYPE: 'WORK' }],
        COMMENTS: commentLines.join('\n'),
        SOURCE_ID: 'WEB',
        SOURCE_DESCRIPTION: 'trc.wtp.ae',
    };

    // Assign lead to a specific Bitrix user (optional env var).
    // If unset, lead goes to the webhook creator by default.
    if (env.BITRIX_ASSIGNED_TO_ID) {
        const assignedId = Number(env.BITRIX_ASSIGNED_TO_ID);
        if (Number.isInteger(assignedId) && assignedId > 0) {
            fields.ASSIGNED_BY_ID = assignedId;
        }
    }

    if (messenger === 'telegram') {
        fields.UF_CRM_TELEGRAM = phone;
    }

    const bitrixUrl = webhook.replace(/\/$/, '') + '/crm.lead.add.json';

    try {
        const bx = await fetch(bitrixUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields }),
        });

        if (!bx.ok) {
            const text = await bx.text();
            console.error('Bitrix non-OK:', bx.status, text.slice(0, 500));
            return jsonResponse(502, { error: 'Bitrix upstream error' });
        }

        const data = await bx.json().catch(() => ({}));
        return jsonResponse(200, { ok: true, id: data.result || null });
    } catch (err) {
        console.error('Bitrix fetch failed:', err && err.message);
        return jsonResponse(502, { error: 'Network error' });
    }
};

// Reject other methods cleanly
export const onRequest = async ({ request }) => {
    if (request.method !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }
    return jsonResponse(404, { error: 'Not found' });
};
