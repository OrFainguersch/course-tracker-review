const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");

const source=fs.readFileSync("assets/evaluation-voice.js","utf8");
const context={console,Map,Set,Object,Array,String,Number,Math,RegExp};
context.window=context;
context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:"assets/evaluation-voice.js"});

const voice=context.FLYMPUS_EVALUATION_VOICE;
assert(voice&&typeof voice.parse==="function","Evaluation voice helper must expose the deterministic parser");
assert.equal(voice.recognitionSupported(),false,"Speech recognition support must be feature-detected instead of assumed");
assert.equal(voice.createRecognition(),null,"Unsupported browsers must retain a no-crash fallback");
assert(!/openai|anthropic|gemini|fetch\s*\(|XMLHttpRequest|WebSocket/i.test(source),"Voice parser must not call a paid/external AI API");

const criteria=[
  {id:"flight_path_control",name:"Flight path control"},
  {id:"work_method",name:"Work method"},
  {id:"airmanship",name:"Airmanship"},
  {id:"emergency_handling",name:"Emergency handling"},
  {id:"brief_debrief",name:"Brief / debrief quality"}
];
const emergencies=[
  {id:"engine_cut",name:"Engine Cut"},
  {id:"spin",name:"Spin Recovery"},
  {id:"flat_tire",name:"Flat Tire"},
  {id:"vertigo",name:"Vertigo"}
];

const english=voice.parse(
  "All criteria 4 except flight path control 3. Emergencies: engine cut twice, spin recovery and flat tire. 2 takeoffs, 3 landings.",
  {criteria,emergencies,grading:{min:1,max:5}}
);
assert.equal(english.hasValues,true);
assert.equal(english.criteria.length,5,"All-criteria command must populate every configured criterion");
assert.equal(english.criteria.find(x=>x.id==="flight_path_control").score,3,"Explicit criterion grade must override the all-criteria grade");
assert.equal(english.criteria.find(x=>x.id==="airmanship").score,4);
assert.equal(english.emergencies.find(x=>x.id==="engine_cut").count,2,"Emergency repetition counts must be recognized");
assert.equal(english.emergencies.find(x=>x.id==="spin").count,1);
assert.equal(english.emergencies.find(x=>x.id==="flat_tire").count,1);
assert.equal(english.counters.takeoffs,2);
assert.equal(english.counters.landings,3);

const hebrew=voice.parse(
  "כל הקריטריונים ארבע, שיטת עבודה שלוש, ורטיגו פעמיים, שתי המראות ושלוש נחיתות",
  {criteria,emergencies,grading:{min:1,max:5}}
);
assert.equal(hebrew.criteria.find(x=>x.id==="work_method").score,3,"Hebrew criterion aliases must override the default grade");
assert.equal(hebrew.criteria.find(x=>x.id==="airmanship").score,4);
assert.equal(hebrew.emergencies.find(x=>x.id==="vertigo").count,2,"Hebrew number words must work for emergency repetitions");
assert.equal(hebrew.counters.takeoffs,2,"Hebrew takeoff counters must be recognized");
assert.equal(hebrew.counters.landings,3,"Hebrew conjunction-number words must be recognized");

const ambiguousDefs=[
  {id:"engine_cut_high",name:"Engine Cut High Altitude"},
  {id:"engine_cut_downwind",name:"Engine Cut Downwind"}
];
const ambiguous=voice.parse("engine cut",{criteria:[],emergencies:ambiguousDefs,grading:{min:1,max:5}});
assert.equal(ambiguous.emergencies.length,0,"Ambiguous shorthand must not guess which emergency was performed");
assert(ambiguous.warnings.some(x=>x.includes("matches more than one configured emergency")),"Ambiguous emergency shorthand must ask for the full name");

const specific=voice.parse("engine cut high altitude",{criteria:[],emergencies:ambiguousDefs,grading:{min:1,max:5}});
assert.equal(specific.emergencies.map(x=>x.id).join(","),"engine_cut_high","Full emergency names must resolve uniquely");
assert.equal(specific.warnings.length,0,"A full unique emergency name must not retain the generic ambiguity warning");

const badGrade=voice.parse("All criteria 8",{criteria,emergencies:[],grading:{min:1,max:5}});
assert.equal(badGrade.criteria.length,0,"Out-of-range spoken grades must never be applied");
assert(badGrade.warnings.length>0,"Out-of-range grades must be surfaced for review");

const html=fs.readFileSync("index.html","utf8");
assert(html.includes('<script src="./assets/evaluation-voice.js?v=0741"></script>'),"Evaluation page must load the local zero-cost voice helper");
assert(html.includes("function evaluationVoiceInputHtml()")&&html.includes("${evaluationVoiceInputHtml()}"),"Voice input UI must be mounted in Evaluation");
assert.equal((html.match(/\$\{evaluationVoiceInputHtml\(\)\}/g)||[]).length,1,"Voice input must be mounted only once, in Evaluation");
assert(html.includes("Apply detected values")&&html.includes("review before submitting"),"Detected voice values must require instructor review before normal Evaluation submission");
assert(html.includes("Use device dictation")&&html.includes("keyboard microphone"),"Unsupported direct recognition must retain a zero-cost device-dictation fallback");
assert(html.includes("does not use a paid AI/API")&&html.includes("does not store the audio"),"Evaluation voice UI must disclose its privacy/cost behavior");
const sw=fs.readFileSync("sw.js","utf8");
assert(sw.includes("./assets/evaluation-voice.js?v=0741"),"Installed PWA shell must cache the local Evaluation voice helper");

console.log("Evaluation voice tests passed");
