import { createScene, palette } from './scene.js';
import css from './viewer.css';

const base = new URL('.', document.currentScript.src).href;
if (!document.getElementById('unit-brain-styles')) {
  const style = document.createElement('style');
  style.id = 'unit-brain-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
let modelPromise;
function loadModel() {
  if (window.UnitBrainMeshPayload) return Promise.resolve(window.UnitBrainMeshPayload);
  if (modelPromise) return modelPromise;
  modelPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const finish = error => {
      clearTimeout(timer);
      script.onload = script.onerror = null;
      script.remove();
      if (error) { modelPromise = null; reject(error); }
      else resolve(window.UnitBrainMeshPayload);
    };
    const timer = setTimeout(() => finish(new Error('model-load')), 30000);
    script.src = new URL('brain-model.js', base).href;
    script.async = true;
    script.onload = () => finish(Array.isArray(window.UnitBrainMeshPayload) ? null : new Error('model-data'));
    script.onerror = () => finish(new Error('model-load'));
    document.head.appendChild(script);
  });
  return modelPromise;
}

const { createElement: h, useState, useRef, useEffect, useId } = window.React;
function BrainViewer({ language = 'sq', isDark = false }) {
  const en = language === 'en', t = (sq, english) => en ? english : sq;
  const host = useRef(null), engine = useRef(null);
  const [status, setStatus] = useState('loading');
  const [progress, setProgress] = useState(0);
  const [failure, setFailure] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [lightQuality, setLightQuality] = useState(() => (navigator.deviceMemory && navigator.deviceMemory < 4) || navigator.hardwareConcurrency < 4);
  const [pose, setPose] = useState({ preset: 'overview', zoom: 100 });
  const helpId = useId(), descriptionId = useId();
  useEffect(() => {
    const controller = new AbortController();
    let scene;
    setStatus('loading');
    setProgress(0);
    setFailure('');
    const fail = reason => {
      if (controller.signal.aborted) return;
      setFailure(reason);
      setStatus('error');
    };
    loadModel().then(meshes => createScene({
      host: host.current, meshes, signal: controller.signal, dark: isDark, lightQuality,
      onProgress: value => { if (!controller.signal.aborted) setProgress(value); },
      onChange: value => { if (!controller.signal.aborted) setPose(value); },
      onError: fail
    })).then(instance => {
      scene = instance;
      if (controller.signal.aborted) { instance?.dispose(); return; }
      engine.current = instance;
      if (instance) setStatus('ready');
    }).catch(error => fail(error.message));
    return () => { controller.abort(); scene?.dispose(); engine.current = null; };
  }, [attempt, lightQuality]);
  useEffect(() => { engine.current?.theme(isDark); }, [isDark]);
  const ready = status === 'ready';
  const button = (label, action, extra = {}) => h('button', { type: 'button', disabled: !ready, onClick: action, ...extra }, label);
  const presets = [
    ['overview', t('Në tërësi', 'Overview')], ['left', t('Nga e majta', 'Left side')],
    ['front', t('Përpara', 'Front')], ['top', t('Nga sipër', 'Top')]
  ];
  const parts = [
    ['left', t('Hemisfera e majtë', 'Left hemisphere')], ['right', t('Hemisfera e djathtë', 'Right hemisphere')],
    ['cerebellum-left', t('Truri i vogël (cerebelumi)', 'Cerebellum')], ['brainstem', t('Trungu i trurit', 'Brainstem')]
  ];
  const keyboard = event => {
    if (!ready || event.altKey || event.metaKey || event.ctrlKey) return;
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[event.key]) {
      event.preventDefault();
      const [x, y] = arrows[event.key];
      if (event.shiftKey) engine.current.pan(-x, y);
      else engine.current.rotate(x * 0.12, y * 0.12);
    } else if (['+', '=', '-', 'Home', '0'].includes(event.key)) {
      event.preventDefault();
      if (event.key === 'Home' || event.key === '0') engine.current.view();
      else engine.current.zoom(event.key === '-' ? 1.15 : 1 / 1.15);
    }
  };
  return h('section', { className: 'unit-brain', 'aria-label': t('Eksplorimi i trurit në 3D', '3D brain exploration') },
    h('header', { className: 'unit-brain-heading' },
      h('div', null, h('h2', null, t('Truri në 3D', 'The brain in 3D')),
        h('p', null, t('Eksploro formën dhe orientimin e trurit.', 'Explore the shape and orientation of the brain.'))),
      h('label', { className: 'unit-brain-quality' },
        h('input', { type: 'checkbox', checked: !!lightQuality, onChange: event => setLightQuality(event.target.checked) }),
        t('Pamje e lehtë', 'Lighter rendering'))),
    h('div', { className: 'unit-brain-layout' },
      h('div', { className: 'unit-brain-explorer' },
        h('div', { className: 'unit-brain-presets', role: 'group', 'aria-label': t('Orientimi i pamjes', 'View orientation') },
          presets.map(([id, label]) => button(label, () => engine.current.view(id), { key: id, 'aria-pressed': ready && pose.preset === id }))),
        h('div', { className: 'unit-brain-stage', 'aria-busy': status === 'loading' },
          h('div', { ref: host, className: 'unit-brain-canvas', tabIndex: ready ? 0 : -1, role: 'application',
            'aria-label': t('Modeli interaktiv i trurit', 'Interactive brain model'), 'aria-describedby': `${helpId} ${descriptionId}`,
            onKeyDown: keyboard, style: { visibility: ready ? 'visible' : 'hidden' } }),
          ready && h('div', { className: 'unit-brain-stage-caption', 'aria-hidden': 'true' },
            h('span', null, t('Model nga MRI', 'MRI-derived model')), h('span', null, `${pose.zoom}%`)),
          status === 'loading' && h('div', { className: 'unit-brain-message', role: 'status' },
            h('strong', null, t('Duke përgatitur trurin 3D…', 'Preparing the 3D brain…')),
            h('progress', { value: progress, max: 1, 'aria-label': t('Përgatitja e modelit', 'Preparing model') }),
            h('p', null, t('Modeli i detajuar mund të kërkojë pak sekonda.', 'The detailed model may take a few seconds.'))),
          status === 'error' && h('div', { className: 'unit-brain-fallback' },
            h('img', { src: new URL('brain-preview.png', base).href, alt: t('Pamje statike e të njëjtit model anatomik të trurit.', 'Static view of the same anatomical brain model.') }),
            h('div', { className: 'unit-brain-fallback-message', role: 'alert' },
              h('strong', null, t('Pamja 3D nuk u hap', 'The 3D view could not open')),
              h('p', null, failure === 'model-load' || failure === 'model-data'
                ? t('Modeli nuk u ngarkua. Kontrollo që dosja assets/brain është pranë app-it.', 'The model did not load. Check that the assets/brain folder is next to the app.')
                : t('Pajisja nuk e hapi dot pamjen interaktive. Mund ta provosh përsëri me pamjen e lehtë.', 'This device could not open the interactive view. Try again with lighter rendering.')),
              h('button', { type: 'button', onClick: () => setAttempt(value => value + 1) }, t('Provo përsëri', 'Try again'))))),
        h('div', { className: 'unit-brain-controls', role: 'group', 'aria-label': t('Kontrollet e modelit', 'Model controls') },
          button('−', () => engine.current.zoom(1.2), { 'aria-label': t('Largo pamjen', 'Zoom out') }),
          button('+', () => engine.current.zoom(1 / 1.2), { 'aria-label': t('Afro pamjen', 'Zoom in') }),
          button(t('Rikthe pamjen', 'Reset view'), () => engine.current.view(), { className: 'unit-brain-reset' })),
        h('details', { className: 'unit-brain-help' }, h('summary', null, t('Si ta përdorësh', 'How to explore')),
          h('p', { id: helpId }, t('Rrotullo me tërheqje ose me shigjetat e tastierës. Afro me rrotën e mausit, me dy gishta ose me +/−. Zhvendos me butonin e djathtë, dy gishta ose Shift + shigjeta. Home rikthen pamjen. Tab të nxjerr nga modeli.', 'Drag or use arrow keys to rotate. Zoom with the mouse wheel, pinch, or +/−. Pan with right-drag, two fingers, or Shift + arrows. Home resets the view. Tab moves out of the model.')))),
      h('div', { className: 'unit-brain-info', role: 'complementary', 'aria-label': t('Shpjegimi i modelit', 'Model explanation') },
        h('h3', null, t('Çfarë po shikon', 'What you are viewing')),
        h('p', { id: descriptionId }, t('Sipërfaqen e jashtme të hemisferave, trurin e vogël dhe trungun e trurit. Ngjyrat ndihmojnë dallimin e tyre.', 'The outer surfaces of the cerebral hemispheres, the cerebellum and the brainstem. Colours help distinguish them.')),
        h('ul', { className: 'unit-brain-legend' }, parts.map(([id, label]) => h('li', { key: id },
          h('span', { className: 'unit-brain-swatch', style: { background: palette[id] }, 'aria-hidden': true }), label))),
        h('p', { className: 'unit-brain-note' }, t('“E majta” dhe “e djathta” i referohen anëve anatomike të modelit, jo anëve të ekranit.', '“Left” and “right” refer to the model’s anatomical sides, not the sides of the screen.')),
        h('details', { className: 'unit-brain-source' }, h('summary', null, t('Burimi dhe kufizimet', 'Source and limitations')),
          h('p', null, 'Anderson Winkler · ', h('a', { href: 'https://brainder.org/research/brain-for-blender/', target: '_blank', rel: 'noopener noreferrer' }, 'Brain for Blender'), ' · ',
            h('a', { href: 'https://creativecommons.org/licenses/by-sa/3.0/', target: '_blank', rel: 'noopener noreferrer' }, 'CC BY-SA 3.0')),
          h('p', null, t('Rindërtim nga MRI i një individi. Palosjet ndryshojnë mes njerëzve. Rrjeta origjinale është ruajtur; ngjyrat dhe ndriçimi janë për ilustrim.', 'Reconstructed from one individual’s MRI. Folds vary between people. Original meshes are retained; colours and lighting are illustrative.')),
          h('p', null, t('Kjo pamje e jashtme nuk tregon strukturat e thella. Modeli i cerebelumit dhe trungut është më pak i hollësishëm se sipërfaqja e hemisferave.', 'This external view does not expose deep structures. The cerebellar and brainstem meshes are less detailed than the hemispheric surfaces.')),
          h('a', { href: new URL('README.md', base).href, target: '_blank', rel: 'noopener noreferrer' }, t('Dokumentimi i modelit', 'Model documentation'))))));
}
window.UnitBrainViewer = BrainViewer;
