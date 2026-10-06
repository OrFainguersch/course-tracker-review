/* FLYMPUS Evaluation Voice Input
 * Zero-paid-API helper: browser speech recognition + deterministic parsing.
 * Audio is never stored by this module. Structured values are only proposed;
 * the Evaluation screen decides when the instructor applies them.
 */
(function(global){
  'use strict';

  const NUMBER_WORDS=Object.freeze({
    zero:'0',oh:'0',אפס:'0',
    one:'1',first:'1',אחד:'1',אחת:'1',
    two:'2',second:'2',שניים:'2',שתיים:'2',שני:'2',שתי:'2',
    three:'3',third:'3',שלוש:'3',שלושה:'3',
    four:'4',fourth:'4',ארבע:'4',ארבעה:'4',
    five:'5',fifth:'5',חמש:'5',חמישה:'5',
    six:'6',שש:'6',שישה:'6',
    seven:'7',שבע:'7',שבעה:'7',
    eight:'8',שמונה:'8',
    nine:'9',תשע:'9',תשעה:'9',
    ten:'10',עשר:'10',עשרה:'10'
  });

  function normalize(value){
    return String(value??'')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0591-\u05c7]/g,'')
      .replace(/[^a-z0-9\u0590-\u05ff.]+/g,' ')
      .replace(/\./g,(mark,offset,input)=>/\d/.test(input[offset-1]||'')&&/\d/.test(input[offset+1]||'')?mark:' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function withNumericWords(value){
    return normalize(value).split(' ').map(token=>{
      const suffix=token.match(/[.]+$/)?.[0]||'',plain=suffix?token.slice(0,-suffix.length):token;
      const mapped=NUMBER_WORDS[plain]??(plain.startsWith('ו')&&NUMBER_WORDS[plain.slice(1)]?NUMBER_WORDS[plain.slice(1)]:null);
      return mapped==null?token:String(mapped)+suffix
    }).join(' ');
  }

  function escapeRegExp(value){
    return String(value).replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
  }

  function withinGradeRange(value,grading){
    const n=Number(value),min=Number(grading?.min??1),max=Number(grading?.max??5);
    return Number.isFinite(n)&&n>=min&&n<=max;
  }

  function distinct(values){
    return [...new Set((values||[]).map(normalize).filter(Boolean))];
  }

  function criterionAliases(name){
    const n=normalize(name),aliases=[n];
    if(/flight path/.test(n))aliases.push('flight path','flight control','נתיב טיסה','שליטה בנתיב');
    if(/altitude/.test(n))aliases.push('altitude','altitude control','גובה','שמירת גובה');
    if(/airmanship/.test(n))aliases.push('airmanship','אויראות','אוויראות');
    if(/work method|working method|workflow|work flow/.test(n))aliases.push('work method','working method','workflow','work flow','שיטת עבודה');
    if(/emergency/.test(n))aliases.push('emergency handling','emergency management','emergencies','טיפול בחירום','ניהול חירום','חירומים');
    if(/brief/.test(n)&&/debrief/.test(n))aliases.push('brief debrief','briefing debriefing','debrief','תדריך תחקיר','תחקיר');
    if(/system control/.test(n))aliases.push('system control','שליטה במערכת');
    if(/procedure/.test(n))aliases.push('procedure','procedures','procedure discipline','procedure compliance','נוהל','נהלים','משמעת נהלים');
    if(/teamwork/.test(n))aliases.push('teamwork','ip ep teamwork','עבודת צוות');
    if(/technical quality/.test(n))aliases.push('technical quality','quality','איכות טכנית');
    if(/safety/.test(n))aliases.push('safety','בטיחות');
    if(/independent/.test(n))aliases.push('independent execution','independence','עצמאות','ביצוע עצמאי');
    if(/planning/.test(n))aliases.push('planning','תכנון');
    if(/communication/.test(n))aliases.push('communication','communications','תקשורת');
    if(/situational/.test(n))aliases.push('situational awareness','awareness','מודעות מצבית');
    return distinct(aliases);
  }

  function scoreAfterAlias(text,alias){
    const escaped=escapeRegExp(alias);
    const patterns=[
      new RegExp('(?:^|\\s)'+escaped+'(?:\\s+(?:score|grade|is|was|gets|got|ציון|מקבל|מקבלת|קיבל|קיבלה))?\\s*([0-9]+(?:\\.[0-9]+)?)\\b','i'),
      new RegExp('(?:^|\\s)([0-9]+(?:\\.[0-9]+)?)\\s+(?:for\\s+|ל\\s*)?'+escaped+'(?:\\s|$)','i')
    ];
    for(const re of patterns){
      const m=text.match(re);
      if(m)return Number(m[1]);
    }
    return null;
  }

  function globalCriterionScore(text){
    const re=/(?:all criteria|all assessment criteria|all categories|כל הקריטריונים|כל קטגוריות ההערכה|כל הקטגוריות)(?:\s+(?:are|at|score|grade|ציון|מקבלים|מקבלות))?\s*([0-9]+(?:\.[0-9]+)?)/i;
    const m=text.match(re);
    return m?Number(m[1]):null;
  }

  function emergencyAliases(name){
    const n=normalize(name),aliases=[n];
    if(/vertigo/.test(n))aliases.push('vertigo','ורטיגו');
    if(/flight box/.test(n)||/\bsbx\b/.test(n))aliases.push('flight box','sbx');
    if(/single ins/.test(n))aliases.push('single ins','one ins');
    if(/dual ins/.test(n))aliases.push('dual ins','both ins','two ins');
    if(/ias sensor stuck/.test(n))aliases.push('ias stuck','stuck ias');
    if(/ias sensor drift/.test(n))aliases.push('ias drift');
    if(/\batol\b/.test(n))aliases.push('atol');
    if(/intercom/.test(n))aliases.push('intercom');
    if(/kangaroo/.test(n))aliases.push('kangaroo','kangaroo landing');
    if(/spin/.test(n))aliases.push('spin','spin recovery');
    if(/stall/.test(n))aliases.push('stall','stall recovery');
    if(/no report/.test(n))aliases.push('no report');
    if(/engine cut/.test(n))aliases.push('engine cut');
    if(/generator failure/.test(n))aliases.push('generator','generator failure');
    if(/gps failure/.test(n))aliases.push('gps','gps failure');
    if(/flat tire/.test(n))aliases.push('flat tire');
    if(/gear asymmetry/.test(n))aliases.push('gear asymmetry','landing gear asymmetry');
    if(/veering off runway/.test(n))aliases.push('runway excursion','veering off runway');
    if(/arresting cable/.test(n))aliases.push('cable run through','cable runthrough','arresting cable');
    return distinct(aliases);
  }

  function phraseIndex(text,alias){
    const padded=' '+text+' ',needle=' '+alias+' ';
    return padded.indexOf(needle);
  }

  function isNegated(text,index){
    const before=text.slice(0,Math.max(0,index)).trim().split(/\s+/).slice(-4);
    return before.some(token=>['לא','בלי','not','without','didnt'].includes(token))||
      before.slice(-2).join(' ')==='did not';
  }

  function countNearAlias(text,alias,index){
    const after=text.slice(index+alias.length).trimStart();
    if(/^(?:twice|פעמיים)\b/i.test(after))return 2;
    if(/^(?:thrice)\b/i.test(after))return 3;
    const m=after.match(/^([0-9]+)\s*(?:times|time|פעמים|פעם|x)\b/i);
    if(m)return Math.max(1,Math.min(99,Number(m[1])||1));
    return 1;
  }

  function counterValue(text,aliases){
    const pattern=aliases.map(escapeRegExp).join('|');
    const before=new RegExp('(?:^|\\s)([0-9]+)\\s*(?:'+pattern+')(?:\\s|$)','i').exec(text);
    if(before)return Math.max(0,Math.min(99,Number(before[1])||0));
    const after=new RegExp('(?:^|\\s)(?:'+pattern+')\\s*([0-9]+)(?:\\s|$)','i').exec(text);
    if(after)return Math.max(0,Math.min(99,Number(after[1])||0));
    return null;
  }

  function parse(transcript,context={}){
    const text=withNumericWords(transcript),criteria=Array.isArray(context.criteria)?context.criteria:[],
      emergencies=Array.isArray(context.emergencies)?context.emergencies:[],grading=context.grading||{min:1,max:5},
      warnings=[],scores=new Map(),globalScore=globalCriterionScore(text);

    if(globalScore!==null){
      if(withinGradeRange(globalScore,grading))criteria.forEach(c=>scores.set(String(c.id),{id:String(c.id),name:String(c.name||c.id),score:globalScore,source:'all'}));
      else warnings.push('All-criteria grade '+globalScore+' is outside the configured scale.');
    }

    criteria.forEach(c=>{
      let found=null;
      for(const alias of criterionAliases(c.name)){
        const value=scoreAfterAlias(text,alias);
        if(value!==null){found=value;break}
      }
      if(found===null)return;
      if(!withinGradeRange(found,grading)){warnings.push(String(c.name||c.id)+' grade '+found+' is outside the configured scale.');return}
      scores.set(String(c.id),{id:String(c.id),name:String(c.name||c.id),score:found,source:'explicit'});
    });

    const aliasMap=new Map();
    emergencies.forEach(em=>{
      emergencyAliases(em.name).forEach(alias=>{
        const rows=aliasMap.get(alias)||[];rows.push(em);aliasMap.set(alias,rows)
      })
    });
    const emergencyMatches=new Map(),ambiguous=new Set();
    [...aliasMap.entries()].sort((a,b)=>b[0].length-a[0].length).forEach(([alias,rows])=>{
      const idx=phraseIndex(text,alias);
      if(idx<0||isNegated(text,idx))return;
      if(rows.length!==1){
        if(alias.split(' ').length>1)ambiguous.add(alias);
        return
      }
      const em=rows[0],id=String(em.id),existing=emergencyMatches.get(id);
      if(existing&&existing.alias.length>=alias.length)return;
      emergencyMatches.set(id,{id,name:String(em.name||id),count:countNearAlias(text,alias,idx),alias})
    });
    ambiguous.forEach(alias=>{
      const covered=[...emergencyMatches.values()].some(row=>{
        const matched=normalize(row.alias||''),name=normalize(row.name||'');
        return matched!==alias&&(matched.startsWith(alias+' ')||name.startsWith(alias+' '))
      });
      if(!covered)warnings.push('Emergency phrase “'+alias+'” matches more than one configured emergency; say the full emergency name.')
    });

    const takeoffs=counterValue(text,['takeoff','takeoffs','המראה','המראות']),
      landings=counterValue(text,['landing','landings','full stop landing','full stop landings','נחיתה','נחיתות']),
      touchAndGo=counterValue(text,['touch and go','touch and goes','touch n go','t and g','t g','טאץ אנד גו']);

    if(touchAndGo!==null)warnings.push('Touch-and-go count was heard ('+touchAndGo+'), but this Evaluation form currently has no dedicated T&G field.');

    return {
      transcript:String(transcript??''),
      normalized:text,
      criteria:[...scores.values()],
      emergencies:[...emergencyMatches.values()],
      counters:{takeoffs,landings,touchAndGo},
      warnings,
      hasValues:scores.size>0||emergencyMatches.size>0||takeoffs!==null||landings!==null
    };
  }

  function recognitionSupported(){
    return !!(global.SpeechRecognition||global.webkitSpeechRecognition)
  }

  function createRecognition(options={}){
    const Ctor=global.SpeechRecognition||global.webkitSpeechRecognition;
    if(!Ctor)return null;
    const recognition=new Ctor();
    recognition.continuous=true;
    recognition.interimResults=true;
    recognition.maxAlternatives=1;
    recognition.lang=options.lang||'en-US';
    let finalText='',active=false;
    recognition.onstart=()=>{active=true;options.onStatus?.('listening')};
    recognition.onresult=event=>{
      let interim='';
      for(let i=event.resultIndex;i<event.results.length;i++){
        const result=event.results[i],text=String(result?.[0]?.transcript||'').trim();
        if(!text)continue;
        if(result.isFinal)finalText+=(finalText?' ':'')+text;
        else interim+=(interim?' ':'')+text;
      }
      options.onText?.({finalText,interimText:interim,combined:[finalText,interim].filter(Boolean).join(' ').trim()})
    };
    recognition.onerror=event=>{options.onError?.(String(event?.error||'speech-recognition-error'))};
    recognition.onend=()=>{active=false;options.onStatus?.('ended');options.onEnd?.(finalText)};
    return {
      start(){finalText='';recognition.lang=options.langProvider?.()||options.lang||recognition.lang||'en-US';recognition.start()},
      stop(){try{recognition.stop()}catch{}},
      abort(){try{recognition.abort()}catch{}},
      get active(){return active},
      raw:recognition
    }
  }

  global.FLYMPUS_EVALUATION_VOICE=Object.freeze({
    parse,
    normalize,
    withNumericWords,
    recognitionSupported,
    createRecognition
  });
})(typeof window!=='undefined'?window:globalThis);
