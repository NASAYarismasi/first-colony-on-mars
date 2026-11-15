// The persistent top-level document owns fullscreen while game pages navigate inside it.
export async function toggleFullscreen() {
  const owner=window.parent===window?document:window.parent.document;
  try {
    if(owner.fullscreenElement)await owner.exitFullscreen();
    else await owner.documentElement.requestFullscreen({navigationUI:'hide'});
    return true;
  } catch(error) {
    const status=document.getElementById('save-state');
    if(status)status.textContent="This browser blocked fullscreen. Open the game in Chrome and press F11.";
    console.warn('Fullscreen request rejected:',error.name);
    return false;
  }
}
function onKey(event){
  const shortcut=event.code==='F11'||(event.code==='Enter'&&event.altKey);
  if(!shortcut||event.ctrlKey||event.metaKey)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!event.repeat)void toggleFullscreen();
}
window.addEventListener('keydown',onKey,true);
if(import.meta.hot)import.meta.hot.dispose(()=>window.removeEventListener('keydown',onKey,true));
