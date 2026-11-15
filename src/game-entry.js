import './ui/fullscreen.js';
if(window.parent===window){
  const frame=document.createElement('iframe');
  frame.title="First Colony on Mars";frame.allow='fullscreen; autoplay';frame.allowFullscreen=true;
  frame.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;display:block;background:#050608;z-index:2147483647';
  frame.src=location.href;
  document.body.replaceChildren(frame);
  document.documentElement.style.overflow='hidden';
  frame.addEventListener('load',()=>{
    try{history.replaceState(null,'',frame.contentWindow.location.href);document.title=frame.contentDocument.title;frame.contentWindow.focus();}catch{}
  });
}else{
  const path=location.pathname;
  if(path.endsWith('/colony.html'))await import('./colony/main.js');
  else if(path.endsWith('/flight.html'))await import('./main.js');
  else await import('./menu/launch.js');
}
