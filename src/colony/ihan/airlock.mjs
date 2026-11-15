/** Two doors with an interlocked pressure cycle and walk-through collision. */
export function createAirlock({innerZ,outerZ,halfWidth,clearance=.25,setDoors}) {
  let phase='idle', exiting=false, elapsed=0
  const between=(z,min,max)=>z>=min&&z<=max
  const close=()=>{phase='idle';setDoors(false,false,false)}
  return {
    get phase(){return phase},
    get active(){return phase!=='idle'},
    get targetZ(){return exiting?outerZ:innerZ},
    get prompt(){
      return {
        entry:"Walk through the open door into the airlock",
        cycling:"Airlock · Equalizing pressure…",
        ready:"E · Pressure ready, open the second door",
        exit:"Walk through the open door",
      }[phase]??''
    },
    open(fromInside){
      exiting=fromInside
      phase='entry'
      setDoors(exiting,!exiting,false)
    },
    release(){
      if(phase!=='ready')return
      phase='exit'
      setDoors(!exiting,exiting,false)
    },
    reset:close,
    update(dt,x,z){
      if(phase==='entry'){
        if(between(z,innerZ+clearance,outerZ-clearance)&&Math.abs(x)<=halfWidth){
          phase='cycling';elapsed=0;setDoors(false,false,true)
        }else if(Math.abs(x)>2.5||(exiting?z<innerZ-2.5:z>outerZ+2.5))close()
      }else if(phase==='cycling'){
        elapsed+=dt
        if(elapsed>=4.2){phase='ready';setDoors(false,false,false)}
      }else if(phase==='exit'&&(exiting?z>=outerZ+clearance:z<=innerZ-clearance)){
        close()
        return !exiting
      }
      return null
    },
    passage(x,z){
      // Override collision only around the doorway and chamber.
      if(!between(z,innerZ-clearance-.15,outerZ+clearance+.15))return null
      if(Math.abs(x)>halfWidth)return true
      const innerOpen=phase==='entry'&&exiting||phase==='exit'&&!exiting
      const outerOpen=phase==='entry'&&!exiting||phase==='exit'&&exiting
      return (!innerOpen&&z<innerZ+clearance)||(!outerOpen&&z>outerZ-clearance)
    },
  }
}
