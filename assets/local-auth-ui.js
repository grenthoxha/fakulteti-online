(function (root) {
  'use strict';
  const h = React.createElement;
  const { useState, useRef, useEffect } = React;
  const accounts = root.FakultetiLocalAccounts;
  const errors = {
    PROFILE_INVALID: 'Plotëso emrin, mbiemrin dhe të dhënat e profilit.',
    EMAIL_INVALID: 'Shkruaj një adresë emaili të vlefshme.',
    EMAIL_EXISTS: 'Ky email ka llogari në këtë pajisje. Përdor “Hyr”.',
    PASSWORD_LENGTH: 'Fjalëkalimi duhet të ketë 8–128 karaktere.',
    CREDENTIALS_INVALID: 'Email-i ose fjalëkalimi nuk është i saktë.',
    RECOVERY_INVALID: 'Email-i ose kodi i rikuperimit nuk është i saktë.',
    LEGACY_CLAIMED: 'Të dhënat ekzistuese janë lidhur tashmë me një llogari.',
    STORAGE_INVALID: 'Të dhënat e hyrjes nuk u lexuan. Provo ta rihapësh aplikacionin.',
    STORAGE_UNAVAILABLE: 'Ruajtja në këtë pajisje nuk u krye. Kontrollo hapësirën dhe cilësimet e browser-it.',
    CRYPTO_UNAVAILABLE: 'Hape aplikacionin nga lidhja online për të vazhduar.',
    SESSION_INVALID: 'Llogaria ndryshoi në një dritare tjetër. Provo përsëri.'
  };
  const icon = (path, cls = '') => h('svg', { className: cls, width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: path }));
  root.FakultetiLocalAuthView = function LocalAuthView() {
    const [mode, setMode] = useState('intro');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [gender, setGender] = useState('');
    const [role, setRole] = useState('student');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [code, setCode] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [importLegacy, setImportLegacy] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [created, setCreated] = useState(null);
    const pending = useRef(false);
    useEffect(() => {
      const releaseSignedOutSession = () => {
        if (accounts.current()) return;
        root.fakultetiAndroid?.send('notification-clear');
        root.fakultetiAndroid?.send('focus-unlock');
      };
      root.addEventListener('fakulteti:android-ready', releaseSignedOutSession);
      root.addEventListener('fakulteti:focus-restore', releaseSignedOutSession);
      releaseSignedOutSession();
      return () => {
        root.removeEventListener('fakulteti:android-ready', releaseSignedOutSession);
        root.removeEventListener('fakulteti:focus-restore', releaseSignedOutSession);
      };
    }, []);
    const legacy = accounts.legacyProfile();
    const changeMode = next => { if (pending.current) return; setMode(next); setError(''); setNotice(''); setPassword(''); setConfirm(''); setCode(''); setShowPassword(false); };
    const finish = () => { try { created.complete(); root.location.reload(); } catch (e) { setError(errors[e.code] || errors.STORAGE_UNAVAILABLE); } };
    const submit = async event => {
      event.preventDefault();
      if (pending.current) return;
      if (mode !== 'signin' && password !== confirm) { setError('Fjalëkalimet nuk përputhen.'); return; }
      pending.current = true; setBusy(true); setError(''); setNotice('');
      try {
        if (mode === 'signup') {
          if (!['male', 'female'].includes(gender)) { setError('Zgjidh gjininë për të vazhduar.'); return; }
          const identity = root.FakultetiStudentIdentity;
          const result = await identity.validate(firstName, lastName);
          if (!result.ok) { setError(result.error); return; }
          setCreated(await accounts.register(email, password, importLegacy, {
            firstName: identity.normalize(firstName), lastName: identity.normalize(lastName), gender, role
          }));
          setPassword(''); setConfirm('');
        } else {
          if (mode === 'recover') await accounts.resetPassword(email, code, password);
          else await accounts.signIn(email, password);
          setPassword(''); setConfirm(''); setCode(''); root.location.reload();
        }
      } catch (e) { setError(errors[e.code] || 'Hyrja nuk u krye. Provo përsëri.'); }
      finally { pending.current = false; setBusy(false); }
    };
    const input = (label, props) => h('label', { className: 'local-auth-field' }, h('span', null, label), h('input', { ...props, disabled: busy, required: true, 'aria-invalid': Boolean(error), 'aria-describedby': error ? 'local-auth-error' : undefined }));
    const passwordInput = (label, value, setValue, autoComplete) => h('label', { className: 'local-auth-field' }, h('span', null, label), h('span', { className: 'local-auth-password' },
      h('input', { type: showPassword ? 'text' : 'password', value, onChange: e => setValue(e.target.value), autoComplete, minLength: autoComplete === 'new-password' ? 8 : undefined, maxLength: 128, required: true, disabled: busy, 'aria-invalid': Boolean(error), 'aria-describedby': error ? 'local-auth-error' : undefined }),
      h('button', { type: 'button', disabled: busy, onClick: () => setShowPassword(v => !v), 'aria-label': showPassword ? 'Fshih fjalëkalimin' : 'Shfaq fjalëkalimin', 'aria-pressed': showPassword }, icon(showPassword ? 'M3 3l18 18M10.5 10.5a2 2 0 002.8 2.8M9.9 5.2A11 11 0 0112 5c7 0 10 7 10 7a16 16 0 01-4 4.8M6.5 6.5A18 18 0 002 12s3 7 10 7a11 11 0 005.5-1.5' : 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM15 12a3 3 0 11-6 0 3 3 0 016 0'))));
    const isRegistration = mode === 'signup' && !created;
    const brand = h('div', { className: 'local-auth-brand' }, h('img', { src: root.document.documentElement.classList.contains('dark') ? './assets/fakulteti-online-logo-dark.png' : './assets/fakulteti-online-logo.png', alt: 'Fakulteti', width: 42, height: 42 }), h('span', null, 'Fakulteti'));
    if (mode === 'intro') return h('main', { className: 'local-auth-page' },
      h('section', { className: 'local-auth-card local-intro-card', 'aria-labelledby': 'local-intro-title' },
        brand,
        h('header', { className: 'local-auth-heading' }, h('h1', { id: 'local-intro-title' }, 'Studimet, në një vend.'),
          h('p', null, 'Më pak kërkim. Më shumë kohë për të mësuar.')),
        h('div', { className: 'local-intro-features' }, [
          ['M8 2v4M16 2v4M3 10h18M3 4h18v17H3z', 'Orari dhe sallat e lira', 'Dije ku dhe kur e ke ligjëratën.'],
          ['M4 4h6a3 3 0 013 3v14a4 4 0 00-4-2H4zM13 7a3 3 0 013-3h5v15h-5a3 3 0 00-3 2', 'Materialet e mësimit', 'Libra, artikuj dhe video pranë lëndëve.'],
          ['M9 5h11v16H4V5h2M9 3h6v4H9zM8 12l2 2 5-5', 'Detyrat dhe progresi', 'Organizo ditën dhe ndiq rezultatet.']
        ].map(([path, title, copy]) => h('div', { key: title, className: 'local-intro-feature' },
          h('span', { className: 'local-intro-icon' }, icon(path)), h('div', null, h('strong', null, title), h('p', null, copy))))),
        h('button', { type: 'button', className: 'local-auth-primary', onClick: () => changeMode('signup') }, 'Krijo llogari', icon('M5 12h14M13 6l6 6-6 6')),
        h('button', { type: 'button', className: 'local-auth-text-button', onClick: () => changeMode('signin') }, 'Ke llogari? Hyr')),
      h('p', { className: 'local-auth-device-note' }, 'Të dhënat e tua ruhen në këtë pajisje.'),
      typeof UnitInstallButton === 'function' && h('div', { className: 'local-auth-install' }, h(UnitInstallButton, { className: 'local-auth-install-link', uiLanguage: 'sq' })));
    return h('main', { className: 'local-auth-page' },
      !isRegistration && brand,
      h('section', { className: 'local-auth-card', 'aria-labelledby': 'local-auth-title' },
        h('header', { className: 'local-auth-heading' }, isRegistration ? brand : h('span', { className: 'local-auth-emblem' }, icon(created ? 'M5 12l4 4L19 6' : 'M5 21v-3a7 7 0 0114 0v3M16 7a4 4 0 11-8 0 4 4 0 018 0')), h('h1', { id: 'local-auth-title' }, created ? 'Llogaria u krijua' : mode === 'signup' ? 'Krijo llogarinë' : mode === 'recover' ? 'Rikthe hyrjen' : 'Mirë se erdhe'), h('p', null, created ? 'Ruaje kodin për rikuperimin e fjalëkalimit.' : mode === 'signup' ? 'Plotëso profilin. Fakultetin e zgjedh në hapin tjetër.' : mode === 'recover' ? 'Përdor kodin që ruajte kur krijove llogarinë.' : 'Hyr për të vazhduar me profilin tënd.')),
        created ? h('div', { className: 'local-auth-recovery' },
          h('span', { className: 'local-auth-email' }, created.email),
          h('code', { className: 'local-auth-code' }, created.recoveryCode),
          h('button', { type: 'button', className: 'local-auth-secondary', onClick: async () => { try { await navigator.clipboard.writeText(created.recoveryCode); setNotice('Kodi u kopjua.'); } catch { setNotice('Mbaje shtypur kodin për ta kopjuar.'); } } }, icon('M9 9h12v12H9zM3 15V3h12'), 'Kopjo kodin'),
          h('p', { className: 'local-auth-help' }, 'Ky kod të lejon të vendosësh fjalëkalim të ri për llogarinë në këtë pajisje.'),
          h('button', { type: 'button', className: 'local-auth-primary', onClick: finish }, 'E ruajta, vazhdo', icon('M5 12h14M13 6l6 6-6 6'))) : h(React.Fragment, null,
          mode !== 'recover' && h('div', { className: 'local-auth-tabs', role: 'tablist', 'aria-label': 'Hyrja në llogari' }, [['signup', 'Krijo llogari'], ['signin', 'Hyr']].map(([id, text]) => h('button', { key: id, type: 'button', role: 'tab', 'aria-selected': mode === id, disabled: busy, onClick: () => changeMode(id) }, text))),
          h('form', { onSubmit: submit, className: 'local-auth-form', 'aria-busy': busy },
            mode === 'signup' && h('div', { className: 'local-auth-name-row' },
              input('Emri', { type: 'text', value: firstName, onChange: e => setFirstName(e.target.value), autoComplete: 'given-name', maxLength: 80, placeholder: 'Emri yt' }),
              input('Mbiemri', { type: 'text', value: lastName, onChange: e => setLastName(e.target.value), autoComplete: 'family-name', maxLength: 80, placeholder: 'Mbiemri yt' })),
            input('Email', { type: 'email', value: email, onChange: e => setEmail(e.target.value), placeholder: 'emri@email.com', autoComplete: 'username', maxLength: 254, autoCapitalize: 'none', spellCheck: false }),
            mode === 'recover' && input('Kodi i rikuperimit', { type: 'text', value: code, onChange: e => setCode(e.target.value), autoComplete: 'off', maxLength: 64, spellCheck: false, autoCapitalize: 'none' }),
            passwordInput(mode === 'recover' ? 'Fjalëkalimi i ri' : 'Fjalëkalimi', password, setPassword, mode === 'signin' ? 'current-password' : 'new-password'),
            mode !== 'signin' && passwordInput('Përsërite fjalëkalimin', confirm, setConfirm, 'new-password'),
            mode === 'signup' && h('p', { className: 'local-auth-help' }, 'Përdor të paktën 8 karaktere.'),
            mode === 'signup' && h('div', { className: 'local-auth-name-row' },
              h('label', { className: 'local-auth-field' }, h('span', null, 'Gjinia'), h('select', { value: gender, onChange: e => setGender(e.target.value), required: true, disabled: busy },
                h('option', { value: '', disabled: true }, 'Zgjidh'), h('option', { value: 'male' }, 'Mashkull'), h('option', { value: 'female' }, 'Femër'))),
              h('label', { className: 'local-auth-field' }, h('span', null, 'Profili'), h('select', { value: role, onChange: e => setRole(e.target.value), required: true, disabled: busy },
                h('option', { value: 'student' }, 'Student'), h('option', { value: 'instructor' }, 'Profesor'), h('option', { value: 'admin' }, 'Admin')))),
            mode === 'signup' && legacy && h('label', { className: 'local-auth-import' }, h('input', { type: 'checkbox', checked: importLegacy, disabled: busy, onChange: e => setImportLegacy(e.target.checked) }), h('span', null, 'Lidh të dhënat ekzistuese të ', h('strong', null, legacy.name), ' me këtë llogari. Emri i profilit bëhet ai që shkruan më sipër.')),
            error && h('p', { id: 'local-auth-error', className: 'local-auth-error', role: 'alert' }, error),
            h('button', { type: 'submit', disabled: busy, className: 'local-auth-primary' }, busy ? 'Po punohet…' : mode === 'signup' ? 'Krijo llogarinë' : mode === 'recover' ? 'Ruaj fjalëkalimin' : 'Hyr në llogari', !busy && icon('M5 12h14M13 6l6 6-6 6'))),
          h('button', { type: 'button', disabled: busy, className: 'local-auth-text-button', onClick: () => changeMode(mode === 'signin' ? 'recover' : 'signin') }, mode === 'recover' ? 'Kthehu te hyrja' : mode === 'signup' ? 'Ke llogari? Hyr' : 'Ke harruar fjalëkalimin?')),
        notice && h('p', { className: 'local-auth-help', role: 'status' }, notice),
        created && error && h('p', { className: 'local-auth-error', role: 'alert' }, error)),
      h('p', { className: 'local-auth-device-note' }, icon('M5 4h14v16H5zM10 17h4', 'local-auth-device-icon'), 'Llogari lokale · Të dhënat ruhen në këtë pajisje'),
      typeof UnitInstallButton === 'function' && h('div', { className: 'local-auth-install' }, h(UnitInstallButton, { className: 'local-auth-install-link', uiLanguage: 'sq' })));
  };
})(window);
