// TRC lead form — vanilla JS submit to /api/lead (CF Pages Function proxies to Bitrix).
(() => {
    const form = document.getElementById('trc-form');
    if (!form) return;

    const fields = {
        name: form.elements.name,
        phone: form.elements.phone,
        messenger: () => form.querySelector('input[name="messenger"]:checked'),
        consent: form.elements.consent,
        website: form.elements.website, // honeypot
    };

    const errorEls = {
        name: form.querySelector('[data-error="name"]'),
        phone: form.querySelector('[data-error="phone"]'),
        consent: form.querySelector('[data-error="consent"]'),
    };

    const alerts = {
        success: form.querySelector('[data-alert="success"]'),
        error: form.querySelector('[data-alert="error"]'),
    };

    const submitBtn = form.querySelector('.submit-btn');
    const btnLabel = submitBtn.querySelector('.btn-label');
    const btnSpinner = submitBtn.querySelector('.btn-spinner');

    const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    const readUtm = () => {
        const params = new URLSearchParams(window.location.search);
        const out = {};
        for (const key of UTM_KEYS) {
            const v = params.get(key);
            if (v) out[key] = v.slice(0, 200);
        }
        return out;
    };

    const PHONE_RE = /^[+\d\s\-()]{7,20}$/;

    const clearErrors = () => {
        Object.values(errorEls).forEach((el) => { if (el) el.textContent = ''; });
        [fields.name, fields.phone].forEach((el) => el && el.classList.remove('error'));
    };

    const showError = (key, message) => {
        if (errorEls[key]) errorEls[key].textContent = message;
        if (fields[key] && fields[key].classList) fields[key].classList.add('error');
    };

    const setBusy = (busy) => {
        submitBtn.disabled = busy;
        btnLabel.hidden = busy;
        btnSpinner.hidden = !busy;
    };

    const hideAlerts = () => {
        alerts.success.hidden = true;
        alerts.error.hidden = true;
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearErrors();
        hideAlerts();

        // Honeypot — if filled, silently "succeed" without server call.
        if (fields.website && fields.website.value && fields.website.value.length > 0) {
            alerts.success.hidden = false;
            form.reset();
            return;
        }

        const name = (fields.name.value || '').trim();
        const phone = (fields.phone.value || '').trim();
        const messengerEl = fields.messenger();
        const messenger = messengerEl ? messengerEl.value : '';
        const consent = !!fields.consent.checked;

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
            const res = await fetch('/api/lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                throw new Error('Lead submit failed: ' + res.status);
            }
            alerts.success.hidden = false;
            form.reset();
            // Restore default radio to telegram after reset
            const tg = form.querySelector('input[name="messenger"][value="telegram"]');
            if (tg) tg.checked = true;
        } catch (err) {
            console.error(err);
            alerts.error.hidden = false;
        } finally {
            setBusy(false);
        }
    });
})();
