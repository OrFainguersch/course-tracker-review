(function(){
  const src=(name,revision,section)=>({document:name,documentType:"Course Syllabus",revision,profession:"IP",phase:"Full Scale",platform:"Aerostar",section});
  const lesson=(id,name,minimum,platform,topics,extra={})=>({id,name,minimum,mode:extra.mode||"INSTRUCTED",platform,topics,optional:!!extra.optional,track:extra.track||"shared",source:extra.source});
  const baseSource="Aerostar IP Course Syllabus GCS-D (Edition J)";
  const syllabi=[
    lesson("ip_basic_power_a","GCS Power Up and Shutdown A",1,"UAV on ground","Demonstration of GCS power up, GDT ground calibration and shutdown"),
    lesson("ip_basic_power_b","GCS Power Up and Shutdown B",1,"UAV on ground","Trainee GCS power up and shutdown"),
    lesson("ip_basic_knobs","Knobs Mode",1,"Simulator","Briefing, working method, flight routine and knobs mode"),
    lesson("ip_basic_auto","Autonomous Modes",1,"Simulator","Hold, Nav-To, Program, Return Home and Camera Guide"),
    lesson("ip_basic_combined","Combined Mode",1,"Simulator","Combined mode and flaps operation"),
    lesson("ip_basic_sticks","Sticks Mode",1,"Simulator","Manual sticks mode"),
    lesson("ip_basic_disco","Sticks and DISCO Mode",1,"Simulator","Sticks and autopilot-disconnected mode"),
    lesson("ip_basic_prep","Basic Series Exam Preparation",1,"Simulator / real flight","All basic-series topics"),
    lesson("ip_basic_relay","Relay",1,"Real flight + second UAV on ground","Establish and terminate UAV relay",{optional:true}),
    lesson("ip_basic_exam","Basic Series Exam",1,"Simulator / real flight","All basic-series topics except DISCO",{mode:"CHECK"}),
    lesson("ip_tol_preflight_a","Preflight A",1,"UAV on ground","Demonstration of preflight and startup"),
    lesson("ip_tol_preflight_b","Preflight B",1,"UAV on ground","Preflight, startup, power-up and control handover"),
    lesson("ip_tol_acquaintance","Takeoff and Landing Acquaintance",1,"Playback / simulator","Takeoff, departure, approach and landing demonstration"),
    lesson("ip_tol_departure_sim","Takeoff and Departure Practice",1,"Playback / simulator","Practice takeoff and CTR departure 2–3 times"),
    lesson("ip_tol_landing_sim","Approach and Landing Practice",1,"Playback / simulator","Practice CTR approach and landing 2–3 times"),
    lesson("ip_tol_departure_real","Takeoff and Departure",2,"Real flight","Preflight, takeoff and CTR departure"),
    lesson("ip_tol_landing_real","Approach and Landing",2,"Real flight","CTR approach, landing and GCS shutdown"),
    lesson("ip_tol_circuits","Circuits",1,"Real flight","Circuit patterns and IP–EP teamwork"),
    lesson("ip_tol_exam","Takeoff and Landing Exam",1,"Real flight","Independent preflight, takeoff, departure, approach, landing and shutdown",{mode:"CHECK"}),
    lesson("ip_payload_basics_a","Payload Basics A",1,"UAV on ground","PCP, joystick, video annotations and EO payload"),
    lesson("ip_payload_basics_b","Payload Basics B",1,"Ground / recording","Payload preflight and calibrations"),
    lesson("ip_payload_methods","Payload Working Methods",1,"Real flight","Program parameters, north finding, teamwork and GDT aerial calibration"),
    lesson("ip_payload_relation","UAV–Target Relations",1,"Real flight","Target relations and optional laser operation"),
    lesson("ip_payload_acquisition","Target Acquisition",1,"Real flight","Map usage, north finding and Point-To"),
    ...[
      ["work","Emergency Working Method","Working-method demonstration"],["power_a","UAV Power Supply A","Generator fail, fast approach and regulator high voltage"],["power_b","UAV Power Supply B","Regulator low/over-voltage and 12V failure"],
      ["engine_a","UAV Engine A","Engine cut in glide range, WOT jam and fuel leakage"],["engine_b","UAV Engine B","Engine cut out of range, idle jam, piston and low fuel pressure"],["engine_c","UAV Engine C","High fuel pressure, fading RPM, TPS and propeller damage"],
      ["control_a","Flight Control A","Stick-mode approach, single INS and IAS stuck"],["control_b","Flight Control B","IAS drift, altitude sensor and flap failure"],["control_c","Flight Control C","GPS, DISCO and dual INS failure"],
      ["weather","Weather Emergencies","Clouds, fuselage icing, throttle-body icing and low visibility"],["gcs_a","GCS A","External power, supply, DC/AC and PBX failure"],["gcs_b","GCS B","GMS, PCP, MOAV and KVM failure"],
      ["comm_a","Communication A","Primary uplink and pedestal no-report"],["comm_b","Communication B","Secondary/dual uplink and transmitter no-report"],["comm_c","Communication C","Interference, same-channel and relay failure"],
      ["mixed_a","Mixed Emergencies A","Random emergency families"],["mixed_b","Mixed Emergencies B","Random emergency families"],["mixed_c","Mixed Emergencies C","Random takeoff/landing emergencies"],["mixed_d","Mixed Emergencies D","Random emergency families"]
    ].map(x=>lesson("ip_em_"+x[0],x[1],1,x[0]==="mixed_c"?"Real flight":"Simulator",x[2])),
    lesson("ip_em_test","Emergency Series Test Flight",1,"Simulator","All emergency-series topics",{mode:"TEST"}),
    lesson("ip_atol_runway","ATOL Runway Create and Check",1,"GMS in station","Create, define, upload and verify runway"),
    lesson("ip_atol_intro","ATOL Acquaintance",1,"Mission playback","Automatic takeoff and landing"),
    lesson("ip_atol_circuit","ATOL Circuit",1,"Real flight","Automatic takeoff, circuit and full-stop landing"),
    lesson("ip_atol_solo","ATOL Solo",1,"Real flight","All ATOL-series topics",{mode:"CERTIFICATION"}),
    lesson("ip_final","Final Practical Exam",1,"Real flight / simulator","All course topics under independent IP control",{mode:"CERTIFICATION"})
  ].map((x,i)=>({...x,order:i+1,mandatory:!x.optional,instructorRequired:true,source:src(baseSource,"J","Practical syllabus")}));
  const theory=[
    ["Aeronautics Systems","0:45"],["Introduction to UAV World","0:45"],["Introduction to Aviation","0:20"],["Aerodynamics","2:30"],["Meteorology","0:30"],["UAV System General","0:30"],["UAV Description","1:00"],["Propulsion","2:00"],["UAV Power Supply","1:30"],["Avionics","1:00"],["GCS Description and Power Supply","2:00"],["Communication and LAN","2:00"],["INS System","2:00"],["Flight Control","2:30"],["System Logics","1:30"],["GMS / MOAV / MPCP","4:00"],["Limitations and Regulations","2:30"]
  ].map((x,i)=>({id:"ip_th_"+(i+1),no:i+1,name:x[0],type:"Presentation",duration:x[1]+" H",source:src(baseSource,"J","Theoretical phase")}));
  const exams=[
    {id:"ip_exam_limitations",name:"Limitations and Regulations Exam",pass:85,unit:"percent",gate:true},
    {id:"ip_exam_theory",name:"Theoretical Phase Summary",pass:80,unit:"percent",gate:true},
    {id:"ip_exam_immediate",name:"Immediate Actions Exam",pass:null,unit:"decision",gate:true},
    {id:"ip_exam_basic",name:"Basic Series Exam",pass:7,unit:"grade_1_10",gate:true},
    {id:"ip_exam_tol",name:"Takeoff and Landing Series Exam",pass:7,unit:"grade_1_10",gate:true},
    {id:"ip_exam_emergency",name:"Emergency Test Flight",pass:7,unit:"grade_1_10",gate:true},
    {id:"ip_exam_final",name:"Final Practical Exam",pass:7,unit:"grade_1_10",gate:true,decision:"Head instructor approval"}
  ].map(x=>({...x,source:src(baseSource,"J","Completion requirements")}));
  const counters=[
    {id:"ip_sim_sessions",name:"Simulator sessions",unit:"sessions",minimum:null},
    {id:"ip_real_flights",name:"Real flights",unit:"flights",minimum:null},
    {id:"ip_takeoffs",name:"Takeoffs",unit:"executions",minimum:null},
    {id:"ip_landings",name:"Landings",unit:"executions",minimum:null},
    {id:"ip_emergency_repetitions",name:"Emergency repetitions",unit:"repetitions",minimum:null}
  ].map(x=>({...x,profession:"IP",phaseId:"ip_full",platformIds:["aerostar"],source:src(baseSource,"J","Practical syllabus")}));
  const program={id:"ip_full_new_gcs_d",name:"IP Course · Full Scale · Aerostar · GCS-D",professionId:"IP",phaseId:"ip_full",platformId:"aerostar",trainingKind:"new",dayNight:"mixed",tracks:["day","night"],source:baseSource,sourceRevision:"J",theory,exams,syllabi,experienceCounters:counters,emergencyRequirementIds:["aero_single_ins","aero_dual_ins","aero_ias_stuck","aero_ias_drift","aero_alt_sensor","aero_flap_fail","aero_gps_fail","aero_primary_link","aero_secondary_link","aero_dual_link","aero_no_report_pedestal","aero_no_report_tx","aero_no_report_interference","aero_relay_fail","aero_gen_fail","aero_regulator_high","aero_regulator_low","aero_power_12v","aero_engine_cut","aero_throttle_jam","aero_rpm_fading","aero_prop_damage","aero_clouds","aero_fuselage_icing","aero_tb_icing","aero_low_visibility","aero_gcs_power","aero_gms","aero_pcp","aero_moav","aero_kvm"],progression:[
    {id:"ip_gate_theory",after:"theory",requiresExamIds:["ip_exam_limitations","ip_exam_theory"]},
    {id:"ip_gate_basic",after:"ip_basic_exam",requiresMinimum:true,passExamId:"ip_exam_basic"},
    {id:"ip_gate_emergency",after:"ip_em_test",prerequisite:"Basic training complete and Immediate Actions exam",passExamId:"ip_exam_emergency"},
    {id:"ip_gate_final",after:"ip_final",prerequisite:"All series complete",passExamId:"ip_exam_final",decisionRequired:"Head instructor approval"}
  ]};
  const clone=(v)=>JSON.parse(JSON.stringify(v));
  const variant=(id,name,kind,dayNight,sourceName,revision,subset,extra={})=>{const p=clone(program);Object.assign(p,{id,name,trainingKind:kind,dayNight,source:sourceName,sourceRevision:revision},extra);if(subset)p.syllabi=subset(p.syllabi);p.syllabi.forEach((x,i)=>x.order=i+1);return p};
  program.configurationId="gcs_d";
  const gcsC=variant("ip_full_new_gcs_c","IP Course · Full Scale · Aerostar · GCS-C","new","mixed","Aerostar IP Course Syllabus GCS-C (Edition I)","I",null,{configurationId:"gcs_c"});
  const supplementary=variant("ip_full_supplementary","IP Supplementary · Full Scale · Aerostar","conversion","mixed","Aerostar Internal Pilot Supplementary Course Syllabus (Edition A)","A",()=>[
    lesson("ip_sup_hmi","Human Interface",1,"Simulator","Updated GMS, MOAV and flight-box functions"),lesson("ip_sup_payload","Payload Operation",1,"Simulator","Mini-PCP and payload stick"),lesson("ip_sup_preflight","Preflight",1,"UAV on ground","Power-up, preflight, startup and shutdown"),lesson("ip_sup_routine","Flight Routine",1,"Real flight","All flight modes and flight routine"),lesson("ip_sup_comm","Communications",1,"Real flight","Ground and aerial communication"),lesson("ip_sup_relay","Relay",1,"Real flight","Relay operation and failures"),lesson("ip_sup_emergency","Emergencies",1,"Simulator","INS, primary link and GCS malfunctions")
  ],{exams:[{id:"ip_sup_theory",name:"Theoretical Phase Summary",pass:80,unit:"percent",gate:true,source:src("Aerostar Internal Pilot Supplementary Course Syllabus","A","Completion requirement")}],emergencyRequirementIds:["aero_single_ins","aero_primary_link","aero_gcs_power","aero_gms","aero_moav"]});
  const brakes=variant("ip_full_brakes","IP Brakes Qualification · Aerostar","customer_qualification","day","Aerostar IP Brakes Course Syllabus (Edition A)","A",()=>[
    lesson("ip_brakes_taxi_a","Taxi A — Standard Operation",2,"Real ground operation","Straight line, deviation correction and U-turn"),lesson("ip_brakes_taxi_b","Taxi B — Malfunctions and Weather",2,"Real ground operation","No report, asymmetric brake and crosswind handling")
  ],{theory:[{id:"ip_brakes_theory",name:"Aerostar Brakes and Hydraulic System",type:"Presentation",duration:"4:00 H"}],exams:[],experienceCounters:[{id:"ip_taxi_runs",name:"Taxi runs",unit:"executions",minimum:4,profession:"IP",phaseId:"ip_full",platformIds:["aerostar"]}],emergencyRequirementIds:["aero_no_report_taxi","aero_asymmetric_brake","aero_crosswind"]});
  const commint=variant("ip_full_commint","IP COMMINT Qualification · Aerostar","customer_qualification","mixed","Aerostar IP COMMINT Course Syllabus (Edition A)","A",()=>[
    lesson("ip_commint_ground","COMMINT Ground Practice",1,"Ground","System operation ground practice"),lesson("ip_commint_air","COMMINT Aerial Practice",1,"Real flight","System operation aerial practice")
  ],{theory:[["COMMINT General","1:45"],["COMMINT Operation Concept","2:30"],["COMMINT MMI Operation","0:45"],["COMMINT Modulation","1:30"]].map((x,i)=>({id:"ip_commint_th_"+i,name:x[0],type:"Presentation",duration:x[1]+" H"})),exams:[],experienceCounters:[{id:"ip_commint_ground_hours",name:"COMMINT ground practice",unit:"hours",minimum:7},{id:"ip_commint_air_hours",name:"COMMINT aerial practice",unit:"hours",minimum:4}],emergencyRequirementIds:[]});
  const conversion=variant("ip_full_conversion_israel","IP Conversion · Full Scale · Aerostar · Israel","conversion","mixed","Aerostar Israeli IP Conversion Syllabus (Edition C)","C",s=>s.filter(x=>["ip_basic_combined","ip_basic_sticks","ip_basic_prep","ip_basic_exam","ip_tol_acquaintance","ip_tol_departure_real","ip_tol_landing_real","ip_em_work","ip_em_power_a","ip_em_engine_a","ip_em_control_a","ip_em_comm_a","ip_em_mixed_a","ip_em_test","ip_final"].includes(x.id)),{countryIds:["israel"]});
  window.IP_CATALOG={version:"2026-09-29",profession:{id:"IP",name:"Internal Pilot"},phases:[{id:"ip_full",name:"Full Scale",description:"Aerostar operational internal-pilot qualification"}],platforms:[{id:"aerostar",name:"Aerostar",phaseIds:["ip_full"]}],criteria:[{id:"ip_system_control",name:"System control",weight:25},{id:"ip_work_method",name:"Working method",weight:20},{id:"ip_procedures",name:"Procedure discipline",weight:20},{id:"ip_emergency",name:"Emergency handling",weight:20},{id:"ip_teamwork",name:"IP–EP teamwork",weight:15}],programs:[program,gcsC,conversion,supplementary,brakes,commint],sourceDocuments:[
    {name:"Aerostar IP Course Syllabus GCS-D (Edition J)",kind:"Syllabus",revision:"J"},{name:"Aerostar IP Course Syllabus GCS-C (Edition I)",kind:"Syllabus",revision:"I"},{name:"Aerostar Israeli IP Conversion Syllabus (Edition C)",kind:"Overlay",revision:"C"},{name:"Aerostar Internal Pilot Supplementary Course Syllabus (Edition A)",kind:"Conversion",revision:"A"},{name:"Aerostar IP Brakes Course Syllabus (Edition A)",kind:"Qualification",revision:"A"},{name:"Aerostar IP COMMINT Course Syllabus (Edition A)",kind:"Qualification",revision:"A"}
  ],conflicts:[{id:"ip_gcs_variant",message:"GCS-C Edition I and GCS-D Edition J are separate platform configurations; course creation must pin the applicable configuration."}]};
})();
