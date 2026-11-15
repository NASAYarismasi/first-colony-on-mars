export function readMenuPreferences(){
  const preferences={master:70,ambient:50,effects:65,resolution:'native',muted:false,selected:'astronaut-1'};
  try{
    const settings=JSON.parse(localStorage.getItem('mars-menu-settings'));
    for(const key of ['master','ambient','effects']){
      if(Number.isFinite(settings?.[key]))preferences[key]=Math.max(0,Math.min(100,settings[key]));
    }
    if(['native','1920x1080','1600x900','1280x720'].includes(settings?.resolution))preferences.resolution=settings.resolution;
    preferences.muted=settings?.muted===true;
    const selected=localStorage.getItem('mars-appearance');
    if(['astronaut-1','astronaut-2','astronaut-3'].includes(selected))preferences.selected=selected;
  }catch{ /* Use defaults where browser storage is unavailable. */ }
  return preferences;
}
