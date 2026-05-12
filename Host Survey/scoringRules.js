function normalize(v){
if(!v) return null
return String(v).trim().toLowerCase()
}

exports.scoreYesNo=(v,yes,no)=>{
const x=normalize(v)
if(x==="yes") return yes
if(x==="no") return no
return null
}

exports.scoreFrequency=(v)=>{
const map={
daily:10,
weekly:8,
occasionally:5,
rarely:3,
never:1
}
return map[normalize(v)] ?? null
}

exports.scoreEventType=(v)=>{
const map={
both:10,
paid:9,
free:7
}
return map[normalize(v)] ?? null
}

exports.scoreConversionRate=(v)=>{
if(!v) return null
const n=Number(v)
if(n<1) return 2
if(n<3) return 5
if(n<5) return 7
if(n<10) return 9
return 10
}

exports.scoreROAS=(v)=>{
if(!v) return null
const n=Number(v)
if(n<1) return 2
if(n<2) return 5
if(n<3) return 7
if(n<5) return 9
return 10
}

exports.scoreOpenRate=(v)=>{
if(!v) return null
const n=Number(v)
if(n<15) return 2
if(n<25) return 5
if(n<35) return 7
if(n<45) return 9
return 10
}

exports.scoreNewsletterPenetration=(subs,followers)=>{
if(!subs || !followers) return null
const p=(subs/followers)*100
if(p<1) return 2
if(p<3) return 5
if(p<7) return 7
if(p<15) return 9
return 10
}