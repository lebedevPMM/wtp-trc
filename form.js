// TRC lead form — vanilla JS submit to /api/lead (CF Pages Function proxies to Bitrix).
// On GitHub Pages (no serverless functions) /api/lead returns 404 — show a preview notice.
// Supports multiple forms on the page (e.g. desktop hero + mobile final CTA) via [data-trc-form].
(() => {
    const isGitHubPagesPreview = /\.github\.io$/i.test(window.location.hostname);
    const PHONE_RE = /^[+\d\s\-()]{7,20}$/;
    const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

    const readUtm = () => {
        if (typeof window === 'undefined') return {};
        const params = new URLSearchParams(window.location.search);
        const out = {};
        for (const key of UTM_KEYS) {
            const v = params.get(key);
            if (v) out[key] = v.slice(0, 200);
        }
        return out;
    };

    const attachForm = (form) => {
        if (!form) return;

        const get = (sel) => form.querySelector(sel);
        const fields = {
            name: get('input[name="name"]'),
            phone: get('input[name="phone"]'),
            consent: get('input[name="consent"]'),
            website: get('input[name="website"]'),
            messenger: () => form.querySelector('input[name="messenger"]:checked'),
        };
        const errorEls = {
            name: get('[data-error="name"]'),
            phone: get('[data-error="phone"]'),
            consent: get('[data-error="consent"]'),
        };
        const alerts = {
            success: get('[data-alert="success"]'),
            error: get('[data-alert="error"]'),
        };
        const submitBtn = get('.submit-btn');
        const btnLabel = submitBtn && submitBtn.querySelector('.btn-label');
        const btnSpinner = submitBtn && submitBtn.querySelector('.btn-spinner');

        const clearErrors = () => {
            Object.values(errorEls).forEach((el) => { if (el) el.textContent = ''; });
            [fields.name, fields.phone].forEach((el) => el && el.classList && el.classList.remove('error'));
        };
        const showError = (key, message) => {
            if (errorEls[key]) errorEls[key].textContent = message;
            if (fields[key] && fields[key].classList) fields[key].classList.add('error');
        };
        const setBusy = (busy) => {
            if (submitBtn) submitBtn.disabled = busy;
            if (btnLabel) btnLabel.hidden = busy;
            if (btnSpinner) btnSpinner.hidden = !busy;
        };
        const hideAlerts = () => {
            if (alerts.success) alerts.success.hidden = true;
            if (alerts.error) alerts.error.hidden = true;
        };

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearErrors();
            hideAlerts();

            if (fields.website && fields.website.value && fields.website.value.length > 0) {
                if (alerts.success) alerts.success.hidden = false;
                form.reset();
                return;
            }

            const name = (fields.name && fields.name.value || '').trim();
            const phone = (fields.phone && fields.phone.value || '').trim();
            const messengerEl = fields.messenger();
            const messenger = messengerEl ? messengerEl.value : '';
            const consent = !!(fields.consent && fields.consent.checked);

            let firstError = null;
            if (name.length < 2) { showError('name', 'Укажите имя (минимум 2 символа)'); firstError = firstError || fields.name; }
            if (name.length > 100) { showError('name', 'Имя слишком длинное'); firstError = firstError || fields.name; }
            if (!PHONE_RE.test(phone)) { showError('phone', 'Допустимы цифры, +, -, скобки, пробел (7–20 символов)'); firstError = firstError || fields.phone; }
            if (!['telegram', 'whatsapp', 'phone'].includes(messenger)) {
                showError('consent', 'Выберите способ связи');
            }
            if (!consent) {
                showError('consent', 'Нужно согласие с политикой конфиденциальности');
                firstError = firstError || fields.consent;
            }
            if (firstError) {
                try { firstError.focus(); } catch (_) {}
                return;
            }

            if (isGitHubPagesPreview) {
                if (alerts.error) {
                    alerts.error.innerHTML =
                        'Это превью-версия на GitHub Pages — отправка заявок временно отключена. ' +
                        'Напишите нам напрямую: <a href="https://t.me/ivanborodach">@ivanborodach</a>.';
                    alerts.error.hidden = false;
                }
                return;
            }

            const payload = {
                name,
                phone,
                messenger,
                utm: readUtm(),
                page: window.location.href.slice(0, 500),
                referrer: (document.referrer || '').slice(0, 500),
            };

            setBusy(true);
            try {
                const res = await fetch('api/lead', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    throw new Error('Lead submit failed: ' + res.status);
                }
                if (alerts.success) alerts.success.hidden = false;
                form.reset();
                const tg = form.querySelector('input[name="messenger"][value="telegram"]');
                if (tg) tg.checked = true;
            } catch (err) {
                console.error(err);
                if (alerts.error) alerts.error.hidden = false;
            } finally {
                setBusy(false);
            }
        });
    };

    document.querySelectorAll('form[data-trc-form]').forEach(attachForm);
})();
