window.EP_CATALOG = {
  version: "2026-09-29",
  profession: { id: "EP", name: "External Pilot" },
  sourceDocuments: [
    {name:"EP Screenings - RC Simulator Syllabus (Edition B) - Instructor.docx",kind:"Syllabus",scope:"Screening · RC Simulator"},
    {name:"EP Screenings - RC Simulator Syllabus (Edition B) - Trainee.docx",kind:"Syllabus",scope:"Screening · RC Simulator"},
    {name:"EP Screenings - RC Syllabus (Edition C) - Instructor.docx",kind:"Syllabus",scope:"Screening · Live RC"},
    {name:"EP Screenings - RC Syllabus (Edition C) - Trainee - Copy.docx",kind:"Syllabus",scope:"Screening · Live RC"},
    {name:"EP Course – R.C Model stage (Edition E)– Instructor.docx",kind:"Syllabus",scope:"RC Model"},
    {name:"EP Course – R.C Model stage (Edition E)– Trainee.docx",kind:"Syllabus",scope:"RC Model"},
    {name:"EP Course – Half Scale stage (Edition F)– Instructor.docx",kind:"Syllabus",scope:"Half Scale"},
    {name:"EP Course – Half Scale stage (Edition F)– Trainee.docx",kind:"Syllabus",scope:"Half Scale"},
    {name:"EP Course – Full scale stage (Edition F) – Instructor.docx",kind:"Syllabus",scope:"Full Scale · Aerostar"},
    {name:"EP Course – Full scale stage (Edition F) – Trainee.docx",kind:"Syllabus",scope:"Full Scale · Aerostar"},
    {name:"EP Refreshment – Full scale stage (Edition A) – Trainee.docx",kind:"Syllabus",scope:"Full Scale · Refreshment"},
    {name:"EP Return to Currency – Full scale stage (Edition B).docx",kind:"Syllabus",scope:"Full Scale · Return to Currency"},
    {name:"EP FLIGHT MANUAL AEROSTAR BP ENG. D.docx",kind:"Flight Manual",scope:"Aerostar"},
    {name:"EP FLIGHT MANUAL AEROSTAR BP ENG. H.docx",kind:"Flight Manual",scope:"Aerostar"},
    {name:"בדח כיס אירוסטאר- חוץ.docx",kind:"Pocket Checklist",scope:"Aerostar"},
    {name:"בדח כיס אירוסטאר- חוץ.pdf",kind:"Pocket Checklist",scope:"Aerostar"},
    {name:"New Microsoft Word Document.docx",kind:"Supplemental Procedure",scope:"Aerostar"},
    {name:"EP Flight Manual Orbiter 3MP Revision 0 NMT.docx",kind:"Flight Manual",scope:"Orbiter 3MP"},
    {name:"Limitations.docx",kind:"Limitations",scope:"Orbiter 3MP"}
  ],
  phases: [
    { id: "ep_screening", name: "Screening", description: "EP screening flow: RC Simulator and live RC screening." },
    { id: "ep_rc", name: "RC Model", description: "Foundational RC model training phase." },
    { id: "ep_half", name: "Half Scale", description: "Half-scale bridge phase between RC model and full scale." },
    { id: "ep_full", name: "Full Scale", description: "Operational platform phase, including day/night and recurrent packages." }
  ],
  platforms: [
    { id: "rc_simulator", name: "RC Simulator", phaseIds: ["ep_screening"] },
    { id: "rc_model", name: "RC Model", phaseIds: ["ep_screening","ep_rc"] },
    { id: "half_scale", name: "Half Scale Trainer", phaseIds: ["ep_half"] },
    { id: "aerostar", name: "Aerostar", phaseIds: ["ep_full"] },
    { id: "orbiter3mp", name: "Orbiter 3MP", phaseIds: ["ep_full"] }
  ],
  criteria: [
    { id:"flight_path_control", name:"Flight path control", weight:25 },
    { id:"work_method", name:"Work method", weight:20 },
    { id:"airmanship", name:"Airmanship", weight:20 },
    { id:"emergency_handling", name:"Emergency handling", weight:20 },
    { id:"brief_debrief", name:"Brief / debrief quality", weight:15 }
  ],
  programs: [
    {
      id:"ep_screening_simulator",
      name:"EP Screening · RC Simulator",
      phaseId:"ep_screening", platformId:"rc_simulator", trainingKind:"screening", dayNight:"day",
      source:"EP Screenings - RC Simulator Syllabus (Edition B)",
      completion:"Screening decision according to trainee performance.",
      theory:[
        {no:1,name:"Screening General Brief",type:"Presentation",duration:"0:30 H"},
        {no:2,name:"RC Simulator Brief",type:"Instruction",duration:"0:10 H"}
      ],
      syllabi:[
        {id:"screen_sim_basics",name:"Basics",minimum:2,mode:"INSTRUCTED",topics:"Taxi in straight line on runway; Straight & Level flight; Figure-8s; High-altitude circuit pattern"}
      ],
      totalFlights:"Approx. 2"
    },
    {
      id:"ep_screening_rc",
      name:"EP Screening · Live RC",
      phaseId:"ep_screening", platformId:"rc_model", trainingKind:"screening", dayNight:"day",
      source:"EP Screenings - RC Syllabus (Edition C)",
      completion:"Screening decision according to trainee performance.",
      theory:[
        {no:1,name:"Screening General Brief",type:"Presentation",duration:"0:30 H"},
        {no:2,name:"Screenings RC Flights Brief",type:"Presentation",duration:"0:45 H"}
      ],
      syllabi:[
        {id:"screen_rc_flights",name:"Screening Real Flights",minimum:"1-2",mode:"INSTRUCTED",topics:"Straight and Level flight; Flight positions & transitions; High-altitude circuit patterns; Figure-8; Go-around circuits"}
      ],
      totalFlights:"Approx. 2"
    },
    {
      id:"ep_rc_new",
      name:"EP Course · RC Model",
      phaseId:"ep_rc", platformId:"rc_model", trainingKind:"new", dayNight:"day",
      source:"EP Course – R.C Model stage (Edition E)",
      theoryRequirement:"Grade 80 or above in the RC theoretical phase exam.",
      completion:"Pass final check flight with grade 7 or higher.",
      theory:[
        {no:1,name:"Aviation Introduction",type:"Presentation",duration:"0:45 H"},
        {no:2,name:"UAV World",type:"Presentation",duration:"0:45 H"},
        {no:3,name:"Physics & Intro to Aerodynamics",type:"Presentation",duration:"1:00 H"},
        {no:4,name:"General Aircraft Structure",type:"Presentation",duration:"1:00 H"},
        {no:5,name:"The Compass Rose",type:"Presentation",duration:"0:45 H"},
        {no:6,name:"Circuit Structure & Basic Concepts",type:"Presentation",duration:"1:30 H"},
        {no:7,name:"Considerations for Take Off Direction",type:"Presentation",duration:"0:45 H"},
        {no:8,name:"Briefing Debriefing Part 1",type:"Presentation",duration:"1:30 H"},
        {no:9,name:"Briefing Debriefing Part 2",type:"Presentation",duration:"1:30 H"},
        {no:10,name:"Flight Positions",type:"Presentation",duration:"1:00 H"},
        {no:11,name:"De-crab & Skid",type:"Presentation",duration:"0:45 H"},
        {no:12,name:"Basic Aerodynamics",type:"Presentation",duration:"1:30 H"},
        {no:13,name:"Flight Controls",type:"Presentation",duration:"1:30 H"},
        {no:14,name:"Advanced Aerodynamics",type:"Presentation",duration:"1:00 H"},
        {no:15,name:"Relative Velocity",type:"Presentation",duration:"1:30 H"},
        {no:16,name:"Stall",type:"Presentation",duration:"0:30 H"},
        {no:17,name:"RC Model Components & Engine",type:"Presentation",duration:"1:30 H"},
        {no:18,name:"Aircraft Structure",type:"RC model overview",duration:"0:45 H"},
        {no:19,name:"Meteorology",type:"Presentation",duration:"1:30 H"},
        {no:20,name:"Potential Management",type:"Presentation",duration:"1:30 H"},
        {no:21,name:"Engine Cuts",type:"Presentation",duration:"1:30 H"},
        {no:22,name:"Complex Emergencies",type:"Presentation",duration:"1:30 H"}
      ],
      syllabi:[
        {id:"rc_basics_a",name:"Basics A",minimum:2,mode:"INSTRUCTED",topics:"Correct turns; maintain altitude during S&L flight and turns"},
        {id:"rc_basics_b",name:"Basics B",minimum:2,mode:"INSTRUCTED",topics:"Taxi; flight position & transitions; maintain and recognize altitude"},
        {id:"rc_basics_c",name:"Basics C",minimum:2,mode:"INSTRUCTED",topics:"Figure-8s; parallel Downwind & Upwind flight"},
        {id:"rc_basics_d",name:"Basics D",minimum:2,mode:"INSTRUCTED",topics:"Trimming; recognize high and low IAS"},
        {id:"rc_basics_e",name:"Basics E",minimum:1,mode:"INSTRUCTED",topics:"Stall"},
        {id:"rc_sim_a",name:"Simulator A",minimum:null,mode:"SIMULATOR",optional:true,topics:"Taxi; ground-roll takeoff practice; trimming; low/high IAS; stall"},
        {id:"rc_circuits_a",name:"Circuits A",minimum:1,mode:"INSTRUCTED",topics:"Takeoff; high-altitude circuits; go-arounds; Touch-and-Go"},
        {id:"rc_sim_b",name:"Simulator B",minimum:null,mode:"SIMULATOR",optional:true,topics:"Final with headwind/crosswind/gusty crosswind; break of descent; de-crab"},
        {id:"rc_circuits_b",name:"Circuits B",minimum:14,mode:"INSTRUCTED",topics:"Takeoff; Touch-and-Go; de-crab as weather permits; full-stop landing"},
        {id:"rc_circuits_c",name:"Circuits C",minimum:8,mode:"INSTRUCTED",topics:"Takeoff; Touch-and-Go; basic engine cuts for solo certification; full-stop landing"},
        {id:"rc_solo_prep",name:"Check Flight Preparation · Solo Certification",minimum:1,mode:"INSTRUCTED",topics:"Review previous topics; trainee weak areas"},
        {id:"rc_solo_check",name:"Solo Certification Check Flight",minimum:1,mode:"INSTRUCTED",topics:"All program topics"},
        {id:"rc_solo_circuits",name:"Solo Circuits",minimum:21,mode:"SOLO",thirdFlightInstructed:true,topics:"Takeoff; Touch-and-Go; full-stop landing",remarks:"Every 3rd flight is instructed"},
        {id:"rc_basic_eng_a",name:"Basic Engine Emergencies A",minimum:12,mode:"INSTRUCTED",topics:"Engine cut from Downwind; Crosswind; After Takeoff"},
        {id:"rc_sim_c",name:"Simulator C",minimum:null,mode:"SIMULATOR",optional:true,topics:"Inverted flight; loop; roll; 4-point roll; knife edge; stall turn; rolling circle; heli hover; 3D flight"},
        {id:"rc_basic_eng_b",name:"Basic Engine Emergencies B",minimum:12,mode:"INSTRUCTED",topics:"Engine cut from high altitude; high-altitude Base; non-familiar point"},
        {id:"rc_solo_basic_eng",name:"Solo Basic Engine Emergencies",minimum:15,mode:"SOLO",thirdFlightInstructed:true,topics:"All basic engine emergencies",remarks:"Every 3rd flight is instructed"},
        {id:"rc_sim_d",name:"Simulator D",minimum:null,mode:"SIMULATOR",optional:true,topics:"Complex engine emergencies; complex system emergencies"},
        {id:"rc_complex_engine",name:"Complex Engine Emergencies",minimum:10,mode:"INSTRUCTED",topics:"High Idle RPM; stuck throttle S&L/climb/descent; Low Max RPM; RPM drops; Fading RPM; High/Low Engine Temp; Propeller detachment"},
        {id:"rc_complex_system",name:"Complex Emergencies",minimum:14,mode:"INSTRUCTED",topics:"Flight box malfunction; IAS indicator malfunction; BAT; GEN; NO RPT; flat tire/no fuel/low clouds; stuck flaps"},
        {id:"rc_solo_complex",name:"Solo Complex Emergencies",minimum:14,mode:"SOLO",thirdFlightInstructed:true,topics:"All complex engine and system emergencies",remarks:"Every 3rd flight is instructed"},
        {id:"rc_final_prep",name:"Check Flight Preparation · Final",minimum:2,mode:"INSTRUCTED",topics:"All topics; focus on trainee weaknesses"},
        {id:"rc_final_check",name:"Check Flight",minimum:1,mode:"INSTRUCTED",topics:"All topics"},
        {id:"rc_aerobatics",name:"Aerobatics",minimum:null,mode:"INSTRUCTED",optional:true,topics:"Loop; roll; 4-point roll; knife edge; stall turn; rolling circle",remarks:"Maneuvers selected by instructor"}
      ],
      totalFlights:"Approx. 135"
    },
    {
      id:"ep_half_new",
      name:"EP Course · Half Scale",
      phaseId:"ep_half", platformId:"half_scale", trainingKind:"new", dayNight:"day",
      source:"EP Course – Half Scale stage (Edition F)",
      theoryRequirement:"Complete the Half-Scale theoretical phase.",
      completion:"Pass check flight with grade 7 or higher.",
      theory:[
        {no:1,name:"Regulations and Limitations",type:"Presentation",duration:"1:00 H"},
        {no:2,name:"Half-Scale read & sign",type:"Presentation",duration:"1:00 H"},
        {no:3,name:"Half-scale procedure",type:"Presentation",duration:"1:00 H"},
        {no:4,name:"Half-Scale complex emergencies",type:"Presentation",duration:"0:45 H"},
        {no:5,name:"Theoretical phase summary",type:"Exam",duration:"1:00 H"}
      ],
      syllabi:[
        {id:"half_basics",name:"Basics",minimum:4,mode:"INSTRUCTED",topics:"PF checks; logbook & flight execution; Figure-8s; flight positions & transitions; high-altitude circuits",briefing:"Pre-flight & flight execution; logbook; circuit pattern"},
        {id:"half_circuits_a",name:"Circuits A",minimum:11,mode:"INSTRUCTED",topics:"Go-around circuits; Touch-and-Go",briefing:"Go around on time"},
        {id:"half_circuits_b",name:"Circuits B",minimum:10,mode:"INSTRUCTED",topics:"Touch-and-Go; takeoff & full-stop landing",briefing:"Full-stop landing engine procedure"},
        {id:"half_engine_a",name:"Basic Engine Cuts A",minimum:6,mode:"INSTRUCTED",topics:"Downwind; Base; Upwind; Crosswind engine cuts",briefing:"Lose/preserve potential"},
        {id:"half_solo_circuits",name:"Solo Circuits",minimum:9,mode:"SOLO",topics:"Touch-and-Go; takeoff & full-stop landing"},
        {id:"half_engine_b",name:"Basic Engine Cuts B",minimum:9,mode:"INSTRUCTED",topics:"Crosswind; high-altitude; high-altitude Base; non-familiar places"},
        {id:"half_solo_engine",name:"Solo Engine Cuts",minimum:8,mode:"SOLO",topics:"Various engine cuts in circuit"},
        {id:"half_complex_engine",name:"Complex Engine Emergencies",minimum:7,mode:"INSTRUCTED",topics:"High Idle RPM; stuck throttle; Low Max RPM; RPM drops; Fading RPM; High/Low Engine Temp; Propeller detachment",briefing:"Emergency procedures; correct diagnosis; planning ahead"},
        {id:"half_complex_system",name:"Complex Emergencies",minimum:6,mode:"INSTRUCTED",topics:"IAS indicator; BAT; GEN; NO Report; flaps; intercom; flat tire/no fuel/low clouds"},
        {id:"half_check_prep",name:"Check Flight Preparation",minimum:1,mode:"INSTRUCTED",topics:"All topics; focus on trainee weaknesses"},
        {id:"half_check",name:"Check Flight",minimum:1,mode:"INSTRUCTED",topics:"All topics"}
      ],
      totalFlights:"Approx. 72"
    },
    {
      id:"ep_full_day_new",
      name:"EP Course · Full Scale Day · Aerostar",
      phaseId:"ep_full", platformId:"aerostar", trainingKind:"new", dayNight:"day",
      source:"EP Course – Full scale stage (Edition F) – Instructor",
      theoryRequirement:"Theoretical Phase Exam ≥80; Regulations & Limitations Exam ≥85.",
      completion:"Complete the day syllabus and pass the check flight.",
      sourceNote:"Instructor edition lists approx. 51 flights; trainee edition lists approx. 50.",
      theory:[
        {no:1,name:"UAV Description",type:"Presentation",duration:"1:00 H"},
        {no:2,name:"Avionics",type:"Presentation",duration:"1:00 H"},
        {no:3,name:"Propulsion",type:"Presentation",duration:"1:30 H"},
        {no:4,name:"UAV Power Supply",type:"Presentation",duration:"1:30 H"},
        {no:5,name:"GSE Description",type:"Presentation",duration:"1:00 H"},
        {no:6,name:"GCS Description",type:"Presentation",duration:"1:00 H"},
        {no:7,name:"GCS Power Supply",type:"Presentation",duration:"1:00 H"},
        {no:8,name:"Communication System",type:"Presentation",duration:"2:00 H"},
        {no:9,name:"Flight Control",type:"Presentation",duration:"2:30 H"},
        {no:10,name:"System Logics",type:"Presentation",duration:"1:30 H"},
        {no:11,name:"GMS Application",type:"Presentation",duration:"2:30 H"},
        {no:12,name:"Intercom System",type:"Presentation",duration:"0:45 H"},
        {no:13,name:"System Limitations & Regulations",type:"Procedure review",duration:"2:30 H"},
        {no:14,name:"System Limitations & Regulations Exam",type:"Exam",duration:"0:45 H"},
        {no:15,name:"Theoretical Phase Exam",type:"Exam",duration:"2:00 H"}
      ],
      syllabi:[
        {id:"full_preflight",name:"Preflight",minimum:1,mode:"INSTRUCTED",topics:"Pre-flight checks; EP stand checks; engine startup; steering checks",briefing:"EP procedures; regulations & limitations",remarks:"2 repetitions per trainee"},
        {id:"full_intro",name:"Introduction",minimum:3,mode:"INSTRUCTED",topics:"Figure-8s; high-altitude circuits",briefing:"Circuit pattern; work method; EP–IP teamwork"},
        {id:"full_positions_a",name:"Basic Flight Positions A",minimum:1,mode:"INSTRUCTED",topics:"Safe-altitude S&L circuits; climb to 2000 ft; descent to 1000 ft with FLT flaps",briefing:"Lose/preserve potential"},
        {id:"full_positions_b",name:"Basic Flight Positions B",minimum:2,mode:"INSTRUCTED",topics:"Safe-altitude S&L circuits; climb to 2000 ft; descent to 1000 ft with LND flaps"},
        {id:"full_go_around",name:"Go-Around Circuits",minimum:3,mode:"INSTRUCTED",topics:"Circuit patterns; go-around circuits without touchdown",briefing:"Go around in time"},
        {id:"full_tg_a",name:"Touch & Go Circuits A",minimum:1,mode:"INSTRUCTED",topics:"Go-arounds without touchdown; Touch-and-Go"},
        {id:"full_tg_b",name:"Touch & Go Circuits B",minimum:7,mode:"INSTRUCTED",topics:"Touch-and-Go circuits"},
        {id:"full_tg_c",name:"Touch & Go Circuits C",minimum:4,mode:"INSTRUCTED",topics:"Touch-and-Go; undershoot touchdowns / ground roll practice"},
        {id:"full_tg_landing",name:"Touch & Go Circuits · Landing",minimum:1,mode:"INSTRUCTED",topics:"Touch-and-Go; full-stop landing",briefing:"Full-stop landing"},
        {id:"full_tg_rto",name:"Touch & Go Circuits · RTO",minimum:1,mode:"INSTRUCTED",topics:"Takeoff; Touch-and-Go; full-stop landing",briefing:"Rejected Takeoff"},
        {id:"full_takeoff",name:"Touch & Go Circuits · Takeoff",minimum:1,mode:"INSTRUCTED",topics:"Takeoff; Touch-and-Go; full-stop landing"},
        {id:"full_takeoff_landing",name:"Takeoff and Landing",minimum:2,mode:"INSTRUCTED",topics:"Takeoff; handover to IP; full-stop landing"},
        {id:"full_basic_engine",name:"Basic Engine Emergencies",minimum:8,mode:"INSTRUCTED",topics:"Engine cuts: Mid Downwind 500 ft; Downwind 800 ft; High Base/Final 800 ft; high altitude 1500–2000 ft; takeoff/T&G/full-stop",briefing:"Engine-cut procedure; circuit parameter; energy management"},
        {id:"full_complex_eng_a",name:"Complex Engine Emergencies A",minimum:1,mode:"INSTRUCTED",topics:"Low Max RPM; stuck throttle S&L; Low CHT"},
        {id:"full_complex_eng_b",name:"Complex Engine Emergencies B",minimum:1,mode:"INSTRUCTED",topics:"Stuck throttle descending; High CHT; Fading RPM"},
        {id:"full_complex_eng_c",name:"Complex Engine Emergencies C",minimum:1,mode:"INSTRUCTED",topics:"RPM drops; High Idle RPM; Propeller detachment"},
        {id:"full_complex_eng_d",name:"Complex Engine Emergencies D",minimum:4,mode:"INSTRUCTED",topics:"Various engine emergencies from syllabus"},
        {id:"full_system_a",name:"Complex System Emergencies A",minimum:1,mode:"INSTRUCTED",topics:"NO RPT; GEN failure high voltage; flaps servo malfunction",briefing:"Relevant emergency procedures"},
        {id:"full_system_b",name:"Complex System Emergencies B",minimum:1,mode:"INSTRUCTED",topics:"IAS indicator malfunction; GEN failure low voltage / BAT; intercom malfunction",briefing:"Relevant emergency procedures"},
        {id:"full_system_c",name:"Complex System Emergencies C",minimum:4,mode:"INSTRUCTED",topics:"Various system emergencies from syllabus"},
        {id:"full_check_prep",name:"Check Flight Preparation",minimum:2,mode:"INSTRUCTED",topics:"Takeoff; Touch-and-Go; various engine/system emergencies; full-stop landing"},
        {id:"full_check",name:"Check Flight",minimum:1,mode:"INSTRUCTED",topics:"Takeoff; Touch-and-Go; various engine/system emergencies; full-stop landing"}
      ],
      totalFlights:"Approx. 51"
    },
    {
      id:"ep_full_night_new",
      name:"EP Course · Full Scale Night · Aerostar",
      phaseId:"ep_full", platformId:"aerostar", trainingKind:"new", dayNight:"night",
      source:"EP Course – Full scale stage (Edition F)",
      prerequisite:"Completion of the Full-Scale Day prerequisite stated in the source syllabus.",
      completion:"Complete night syllabus and pass night check flight.",
      theory:[],
      syllabi:[
        {id:"night_day_into_night",name:"Day into Night",minimum:1,mode:"INSTRUCTED",topics:"Day takeoff; day Touch-and-Go with NAV lights; night orientation / Figure-8 at 1000 ft",briefing:"UAV orientation at night"},
        {id:"night_orientation",name:"Orientation",minimum:1,mode:"INSTRUCTED",topics:"Circuits/Figure-8s at 1000 ft; climbs/descents 2000–1000 ft",remarks:"Instructor demonstrates all positions and transitions"},
        {id:"night_go_around",name:"Go-Around Circuits",minimum:2,mode:"INSTRUCTED",topics:"Go-around circuits without touchdown"},
        {id:"night_tg",name:"Touch-and-Go Circuits",minimum:4,mode:"INSTRUCTED",topics:"Touch-and-Go circuits"},
        {id:"night_full_stop",name:"Full-Stop Landing",minimum:3,mode:"INSTRUCTED",topics:"Touch-and-Go; full-stop landing"},
        {id:"night_takeoff",name:"Takeoff",minimum:3,mode:"INSTRUCTED",topics:"Takeoff; Touch-and-Go; full-stop landing"},
        {id:"night_emergencies",name:"Emergencies",minimum:3,mode:"INSTRUCTED",topics:"NO RPT; simulated engine cut Mid Downwind 500 ft; high altitude 1500 ft; No Xenon light; takeoff/T&G/full-stop",remarks:"Performed only after required day full-stop landings"},
        {id:"night_check_prep",name:"Check Flight Preparation",minimum:1,mode:"INSTRUCTED",topics:"All exercises in night syllabus"},
        {id:"night_check",name:"Check Flight",minimum:1,mode:"INSTRUCTED",topics:"All exercises in night syllabus"}
      ],
      totalFlights:"Approx. 19"
    },
    {
      id:"ep_full_refresh",
      name:"EP Refreshment · Full Scale · Aerostar",
      phaseId:"ep_full", platformId:"aerostar", trainingKind:"refreshment", dayNight:"day",
      source:"EP Refreshment – Full scale stage (Edition A)",
      theory:[
        {no:1,name:"Flight Control",type:"Presentation",duration:"2:30 H"},
        {no:2,name:"System Logics",type:"Presentation",duration:"1:30 H"},
        {no:3,name:"System Limitations & Regulations",type:"Procedure review",duration:"2:30 H"},
        {no:4,name:"Emergencies Procedure",type:"Procedure review",duration:"1:30 H"}
      ],
      syllabi:[
        {id:"refresh_tg",name:"Touch-and-Go Circuits",minimum:1,mode:"INSTRUCTED",topics:"Takeoff; Touch-and-Go; full-stop landing",remarks:"Takeoff & full-stop only if applicable"},
        {id:"refresh_emg",name:"Emergencies",minimum:1,mode:"INSTRUCTED",topics:"Engine cuts Mid Downwind 500 ft; Downwind 800 ft; High Base/Final 800 ft; high altitude 1500–2000 ft; flaps servo malfunction; NO RPT; full-stop",briefing:"Emergency procedure; engine-cut parameters; energy management"}
      ],
      totalFlights:"2"
    },
    {
      id:"ep_full_rtc",
      name:"EP Return to Currency · Full Scale · Aerostar",
      phaseId:"ep_full", platformId:"aerostar", trainingKind:"return_currency", dayNight:"mixed",
      source:"EP Return to Currency – Full scale stage (Edition B)",
      theory:[
        {no:1,name:"UAV Description",type:"Presentation",duration:"1:00 H"},
        {no:2,name:"Avionics",type:"Presentation",duration:"1:00 H"},
        {no:3,name:"Propulsion",type:"Presentation",duration:"1:30 H"},
        {no:4,name:"UAV Power Supply",type:"Presentation",duration:"1:30 H"},
        {no:5,name:"GSE Description",type:"Presentation",duration:"1:00 H"},
        {no:6,name:"GCS Description",type:"Presentation",duration:"1:00 H"},
        {no:7,name:"GCS Power Supply",type:"Presentation",duration:"1:00 H"},
        {no:8,name:"Communication System",type:"Presentation",duration:"2:00 H"},
        {no:9,name:"Flight Control",type:"Presentation",duration:"2:30 H"},
        {no:10,name:"System Logics",type:"Presentation",duration:"1:30 H"},
        {no:11,name:"GMS Application",type:"Presentation",duration:"2:30 H"},
        {no:12,name:"Intercom System",type:"Presentation",duration:"0:45 H"},
        {no:13,name:"System Limitations & Regulations",type:"Procedure review",duration:"2:30 H"},
        {no:14,name:"System Limitations & Regulations Exam",type:"Exam",duration:"0:45 H"},
        {no:15,name:"Theoretical Phase Exam",type:"Exam",duration:"2:00 H"}
      ],
      syllabi:[
        {id:"rtc_tg",name:"Touch & Go Circuits",minimum:1,mode:"INSTRUCTED",topics:"Takeoff by instructor; Touch-and-Go; full-stop landing",remarks:"Full-stop according to trainee level"},
        {id:"rtc_emg",name:"Emergencies",minimum:1,mode:"INSTRUCTED",topics:"Takeoff; Touch-and-Go; Low Max RPM; stuck throttle; engine cuts; NO RPT; full-stop landing"},
        {id:"rtc_night",name:"Night Flight Review",minimum:1,mode:"INSTRUCTED",topics:"Takeoff; Touch-and-Go; engine cuts; NO RPT; full-stop landing"}
      ],
      totalFlights:"Approx. 3"
    }
  ],
  emergencyCatalogs: {
    rc_model: [
      ["Engine Cut · Downwind","Propulsion / Engine"],["Engine Cut · Crosswind","Propulsion / Engine"],["Engine Cut · After Takeoff","Propulsion / Engine"],["Engine Cut · High Altitude","Propulsion / Engine"],["Engine Cut · High-Altitude Base","Propulsion / Engine"],["Engine Cut · Non-Familiar Point","Propulsion / Engine"],
      ["High Idle RPM","Propulsion / Engine"],["Stuck Throttle · S&L","Propulsion / Engine"],["Stuck Throttle · Climb","Propulsion / Engine"],["Stuck Throttle · Descent","Propulsion / Engine"],["Low Max RPM","Propulsion / Engine"],["RPM Drops","Propulsion / Engine"],["Fading RPM","Propulsion / Engine"],["High Engine Temperature","Propulsion / Engine"],["Low Engine Temperature","Propulsion / Engine"],["Propeller Detachment","Propulsion / Engine"],
      ["Flight Box Malfunction","Flight Controls"],["IAS Indicator Malfunction","Communications / Avionics"],["BAT Malfunction","Electrical"],["GEN Malfunction","Electrical"],["NO RPT","Communications / Avionics"],["Flat Tire / No Fuel / Low Clouds","General / Operational"],["Stuck Flaps","Flight Controls"]
    ].map((x,i)=>({id:"rc_em_"+(i+1),name:x[0],category:x[1]})),
    half_scale: [
      ["Engine Cut · Downwind","Propulsion / Engine"],["Engine Cut · Base","Propulsion / Engine"],["Engine Cut · Upwind","Propulsion / Engine"],["Engine Cut · Crosswind","Propulsion / Engine"],["Engine Cut · High Altitude","Propulsion / Engine"],["Engine Cut · High-Altitude Base","Propulsion / Engine"],["Engine Cut · Non-Familiar Point","Propulsion / Engine"],
      ["High Idle RPM","Propulsion / Engine"],["Stuck Throttle","Propulsion / Engine"],["Low Max RPM","Propulsion / Engine"],["RPM Drops","Propulsion / Engine"],["Fading RPM","Propulsion / Engine"],["High / Low Engine Temp","Propulsion / Engine"],["Propeller Detachment","Propulsion / Engine"],
      ["IAS Indicator Malfunction","Communications / Avionics"],["BAT Malfunction","Electrical"],["GEN Malfunction","Electrical"],["NO Report","Communications / Avionics"],["Flaps Malfunction","Flight Controls"],["Intercom Malfunction","Communications / Avionics"],["Flat Tire / No Fuel / Low Clouds","General / Operational"]
    ].map((x,i)=>({id:"half_em_"+(i+1),name:x[0],category:x[1]})),
    aerostar: [
      ["Emergencies during Takeoff","General / Operational"],["Kangaroo","General / Operational"],["Engine Does Not Shut Down during Landing","Propulsion / Engine"],["Arresting Cable Run-Through","General / Operational"],["Nose Wheel Servo Malfunction","Flight Controls"],["Flat Tire","General / Operational"],["Main Landing Gear Asymmetry","General / Operational"],["Veering Off Runway","General / Operational"],["Spin Recovery","Flight Controls"],["Stall Recovery","Flight Controls"],["Intercom Malfunction","Communications / Avionics"],["Flight Box Malfunction","Flight Controls"],["Vertigo","General / Operational"],["INS Fail","Communications / Avionics"],["IAS Indicator Malfunction","Communications / Avionics"],["No Report","Communications / Avionics"],["Flaps Malfunction","Flight Controls"],["Engine Cut","Propulsion / Engine"],["Stuck Throttle","Propulsion / Engine"],["RPM Drops","Propulsion / Engine"],["Fading RPM","Propulsion / Engine"],["High CHT","Propulsion / Engine"],["Low CHT","Propulsion / Engine"],["High Idle RPM","Propulsion / Engine"],["Prop Detachment / Damage","Propulsion / Engine"],["GEN Fail","Electrical"],["Poor Visibility Conditions","General / Operational"],["Landing with Winds Out of Limitations","General / Operational"]
    ].map((x,i)=>({id:"aero_em_"+(i+1),name:x[0],category:x[1],source:"Aerostar EP Flight Manual · Emergency Procedures"})),
    orbiter3mp: [
      ["Flight Control","Flight Controls"],["Engine Failure","Propulsion / Engine"],["Low Battery Power","Electrical"],["GPS Malfunction","Communications / Avionics"],["Communication Failure","Communications / Avionics"],["Parachute Door Failure","General / Operational"],["Payload Malfunction","General / Operational"],["Severe Weather Conditions","General / Operational"],["Software Failure","Communications / Avionics"]
    ].map((x,i)=>({id:"orb_em_"+(i+1),name:x[0],category:x[1],source:"Orbiter 3MP Flight Manual · Emergency Procedures"}))
  }
};

window.epCatalogHelpers = {
  platformsForPhase(phaseId){
    return (window.EP_CATALOG.platforms||[]).filter(p=>(p.phaseIds||[]).includes(phaseId));
  },
  programsFor(sel){
    const s=sel||{};
    return (window.EP_CATALOG.programs||[]).filter(p=>
      (!s.phaseId||p.phaseId===s.phaseId) &&
      (!s.platformId||p.platformId===s.platformId) &&
      (!s.trainingKind||p.trainingKind===s.trainingKind) &&
      (!s.dayNight||p.dayNight===s.dayNight)
    );
  },
  resolve(sel){
    return this.programsFor(sel)[0]||null;
  },
  emergenciesForPlatform(platformId){
    return (window.EP_CATALOG.emergencyCatalogs||{})[platformId]||[];
  }
};
