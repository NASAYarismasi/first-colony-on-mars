// Local mission correspondence simulation; no external messages are sent.
export function createEarthMessages() {
  const inbox=["Mission Control: Colony link ready. Awaiting your status report."];
  const sent=[];
  let dialog;
  const rows=index=>index===0
    ? ["EARTH → MARS",`${inbox.length} INCOMING MESSAGE`,inbox[0].slice(0,30),"E · OPEN INBOX"]
    : ["MARS → EARTH",`${sent.length} MESSAGES QUEUED`,"STATUS REPORT / NEW MESSAGE","E · WRITE MESSAGE"];
  return {
    rows,
    open(index,onChange){
      if(dialog?.open)return;
      const previous=document.activeElement;
      dialog=document.createElement('dialog');
      dialog.style.cssText='width:min(640px,90vw);box-sizing:border-box;padding:32px;border:1px solid #68d6c2;border-radius:16px;background:#081c24;color:#d7e7e5;font:16px system-ui;box-shadow:0 20px 100px #000c';
      const heading=document.createElement('h2');heading.textContent=index===0?"Earth · Inbox":"Send a message to Earth";dialog.append(heading);
      const note=document.createElement('p');note.textContent="Mission communications simulation · Messages are kept in this game session. There is no live Earth connection.";dialog.append(note);
      const list=document.createElement('div');list.style.cssText='max-height:240px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere';
      const refresh=()=>{list.replaceChildren();for(const message of index===0?inbox:sent){const p=document.createElement('p');p.textContent=message;list.append(p);}};refresh();dialog.append(list);
      if(index===1){
        const input=document.createElement('textarea');input.maxLength=500;input.placeholder="Write your message to Mission Control…";input.setAttribute('aria-label',"Message to send to Earth");input.style.cssText='width:100%;box-sizing:border-box;min-height:130px;background:#102e39;color:#fff;padding:14px;border:1px solid #68d6c2;border-radius:8px;font:inherit';dialog.append(input);
        const send=document.createElement('button');send.textContent="Add to transmission queue";send.onclick=()=>{const message=input.value.trim();if(!message)return;sent.unshift("Awaiting transmission · "+message);input.value='';refresh();onChange();};dialog.append(send);
      }
      const close=document.createElement('button');close.textContent="Close";close.onclick=()=>dialog.close();dialog.append(close);
      for(const button of dialog.querySelectorAll('button'))button.style.cssText='margin:16px 12px 0 0;padding:12px 18px;background:#173e49;color:#e9fffa;border:1px solid #68d6c2;border-radius:8px;cursor:pointer';
      dialog.addEventListener('keydown',event=>event.stopPropagation());
      dialog.addEventListener('keyup',event=>event.stopPropagation());
      dialog.addEventListener('close',()=>{dialog.remove();previous?.focus();},{once:true});
      document.body.append(dialog);dialog.showModal();
    },
    dispose(){dialog?.close();dialog?.remove();},
  };
}
