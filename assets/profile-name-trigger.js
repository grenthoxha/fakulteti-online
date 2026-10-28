/* Name-edit entry only: mouse/keyboard, double tap, hold, or a revealed touch action. */
(function () {
  'use strict';
  const h = React.createElement;
  function ProfileNameTrigger({ name, onEdit, editing, language }) {
    const [hint, setHint] = React.useState(false);
    const gesture = React.useRef({ timer:null, pointer:null, lastTap:null, suppressUntil:0, type:'mouse' });
    const clearHold = () => { clearTimeout(gesture.current.timer); gesture.current.timer = null; };
    const cancel = () => { clearHold(); gesture.current.pointer = null; gesture.current.lastTap = null; };
    React.useEffect(() => () => clearHold(), []);
    const begin = () => { cancel(); setHint(false); onEdit(); };
    const t = (sq,en) => language === 'en' ? en : sq;
    return h('span', { className:'profile-name-control' },
      h('button', {
        type:'button', className:'profile-name-trigger', 'aria-expanded':editing,
        'aria-controls':editing ? 'profile-name-edit' : undefined,
        title:t('Maus: kliko për të ndryshuar emrin. Telefon: dy prekje ose mbaje të shtypur; një prekje shfaq butonin.', 'Mouse: click to edit your name. Touch: double tap or hold; one tap reveals the edit button.'),
        onClick:event => {
          event.preventDefault();
          if (event.detail === 0 || (gesture.current.type === 'mouse' && Date.now() >= gesture.current.suppressUntil)) begin();
        },
        onPointerDown:event => {
          if (event.isPrimary === false || event.button > 0) return;
          gesture.current.type = event.pointerType || 'mouse';
          if (gesture.current.type === 'mouse') return;
          clearHold();
          gesture.current.suppressUntil = Date.now() + 1000;
          gesture.current.pointer = { id:event.pointerId, x:event.clientX, y:event.clientY };
          gesture.current.timer = setTimeout(begin, 550);
        },
        onPointerMove:event => {
          const pointer = gesture.current.pointer;
          if (pointer && (Math.abs(event.clientX-pointer.x)>12 || Math.abs(event.clientY-pointer.y)>12)) cancel();
        },
        onPointerUp:event => {
          const pointer = gesture.current.pointer;
          clearHold();
          gesture.current.pointer = null;
          if (!pointer || pointer.id !== event.pointerId) return;
          gesture.current.suppressUntil = Date.now() + 800;
          const last = gesture.current.lastTap;
          if (last && Date.now()-last.at<=350 && Math.abs(pointer.x-last.x)<=24 && Math.abs(pointer.y-last.y)<=24) begin();
          else { gesture.current.lastTap = { at:Date.now(), x:pointer.x, y:pointer.y }; setHint(true); }
        },
        onPointerCancel:cancel,
        onPointerLeave:cancel,
        onContextMenu:event => { if (gesture.current.type !== 'mouse') event.preventDefault(); },
        style:{ touchAction:'manipulation', WebkitTouchCallout:'none' }
      }, name || t('Student','Student')),
      hint && !editing && h('button', { type:'button', className:'profile-name-edit-hint', onClick:begin, 'aria-label':t('Ndrysho emrin','Edit name') },
        h('svg', { width:14,height:14,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true }, h('path',{d:'m16 3 5 5L9 20l-6 1 1-6L16 3Z'}),h('path',{d:'m14 5 5 5'})),t('Ndrysho','Edit')));
  }
  window.UnitProfileName = { ProfileNameTrigger };
})();
