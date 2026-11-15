const weatherBySol=globalThis.marsWeatherSchedule ??= [1]

export function weatherForSol(index) {
  while(weatherBySol.length<=index) {
    const previous=weatherBySol.at(-1)
    const roll=Math.random()
    let next
    if(previous===.2) next=roll<.55?.2:.6
    else if(previous===.6) next=roll<.35?.2:roll<.75?.6:1
    else next=roll<.48?.6:1
    weatherBySol.push(next)
  }
  return weatherBySol[index]
}
