/** Image measurements from a downscaled RGBA game frame. */
export function analyzeFrame({data,width,height}) {
  const pixels = width * height;
  const luminance = new Uint8Array(pixels);
  const histogram = new Uint32Array(256);
  let sum = 0, dark = 0, edges = 0;
  for(let i=0;i<pixels;i++){
    const offset=i*4;
    const value=Math.round(.2126*data[offset]+.7152*data[offset+1]+.0722*data[offset+2]);
    luminance[i]=value;
    histogram[value]++;
    sum+=value;
    if(value<40)dark++;
  }
  for(let y=1;y<height;y++){
    for(let x=1;x<width;x++){
      const i=y*width+x;
      if(Math.max(Math.abs(luminance[i]-luminance[i-1]),Math.abs(luminance[i]-luminance[i-width]))>=28)edges++;
    }
  }
  const percentile=fraction=>{
    let count=0;
    return histogram.findIndex(bin=>(count+=bin)>=pixels*fraction);
  };
  return {
    brightness:sum/(pixels*255)*100,
    contrast:(percentile(.9)-percentile(.1))/255*100,
    darkArea:dark/pixels*100,
    edgeArea:edges/(Math.max(1,(width-1)*(height-1)))*100,
  };
}
