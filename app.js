/* v3.1 script - see analysis, includes fixes and i18n */
(function(){
  'use strict';
  const I18N = {
    ru:{title:"EA FC26 Tracker",add_match:"+ Матч",export_json:"Экспорт JSON",csv_matches:"CSV Матчи",csv_players:"CSV Игроки",import:"Импорт",
      tab_matches:"Матчи",tab_players:"Игроки",tab_competitions:"Соревнования",
      label_mode:"Режим:",mode_all:"Все",search_ph:"Поиск: соперник/заметки/соревнование",
      form20:"Форма (последние 20)",streaks:"Рекорды серий",
      th_date:"Дата",th_mode_stage:"Режим / Стадия",th_comp:"Соревнование",th_score:"Счёт",th_result:"Исход",th_goals:"Голы",th_assists:"Ассисты",th_notes:"Заметки",th_stage:"Стадия",
      section:"Раздел:",players_overall:"Общая статистика",players_by_mode:"По режимам",
      position:"Позиция:",modeView:"Режим:",player:"Игрок",matches:"Матчи",goals:"Голы",assists:"Ассисты",mode:"Режим",
      comp_overall_title:"Соревновательные режимы — общая",
      by_modes_title:"По режимам (Rivals / Champions / Tournaments / Live Events / Gauntlets)",
      tournaments_title:"Турниры/ивенты (агрегировано)",pick_tournament:"Выбор турнира:",tournament:"Турнир/ивент",last_stage:"Последняя стадия",matches_of_pick:"Матчи выбранного турнира/ивента",
      match:"Матч",save:"Сохранить",
      confirmDelete:"Удалить матч? Это действие необратимо.",confirmImport:"Импорт перезапишет текущие данные. Создать бэкап и продолжить?",
      win:"Победы",draw:"Ничьи",loss:"Поражения",gf:"Забито",ga:"Пропущено",avg:"в ср.",maxWin:"Рекорд побед подряд",maxLoss:"Рекорд поражений подряд",
      mvp:"MVP",goals_l:"Голы",assists_l:"Ассисты",lineup:"Состав",date:"Дата/Время",platform:"Платформа",mode_label:"Режим",stage:"Стадия",competition:"Соревнование (название)",opponent:"Соперник",
      result_label:"Исход",scoreFor:"Забито (For)",scoreAg:"Пропущено (Against)",extraTime:"Доп. время",penalties:"Пенальти",notes:"Заметки",pensWon:"Победа по пенальти?",pensScore:"Счёт в серии пенальти",
      newPlayer:"+ Новый игрок",name:"Имя",rating:"Рейтинг",version:"Версия",evolution:"Эволюция"},
    en:{title:"EA FC26 Tracker",add_match:"+ Match",export_json:"Export JSON",csv_matches:"CSV Matches",csv_players:"CSV Players",import:"Import",
      tab_matches:"Matches",tab_players:"Players",tab_competitions:"Competitions",
      label_mode:"Mode:",mode_all:"All",search_ph:"Search: opponent/notes/event",
      form20:"Form (last 20)",streaks:"Streak records",
      th_date:"Date",th_mode_stage:"Mode / Stage",th_comp:"Competition",th_score:"Score",th_result:"Result",th_goals:"Goals",th_assists:"Assists",th_notes:"Notes",th_stage:"Stage",
      section:"Section:",players_overall:"Overall",players_by_mode:"By mode",
      position:"Position:",modeView:"Mode:",player:"Player",matches:"Matches",goals:"Goals",assists:"Assists",mode:"Mode",
      comp_overall_title:"Competitive modes — Overall",
      by_modes_title:"By mode (Rivals / Champions / Tournaments / Live Events / Gauntlets)",
      tournaments_title:"Tournaments/Events (aggregated)",pick_tournament:"Pick tournament:",tournament:"Tournament/Event",last_stage:"Last stage",matches_of_pick:"Matches of selected event",
      match:"Match",save:"Save",
      confirmDelete:"Delete match? This cannot be undone.",confirmImport:"Import will overwrite current data. Backup and continue?",
      win:"Wins",draw:"Draws",loss:"Losses",gf:"GF",ga:"GA",avg:"avg",maxWin:"Max Wins Streak",maxLoss:"Max Losses Streak",
      mvp:"MVP",goals_l:"Goals",assists_l:"Assists",lineup:"Lineup",date:"Date/Time",platform:"Platform",mode_label:"Mode",stage:"Stage",competition:"Competition (name)",opponent:"Opponent",
      result_label:"Result",scoreFor:"Goals For",scoreAg:"Goals Against",extraTime:"Extra Time",penalties:"Penalties",notes:"Notes",pensWon:"Penalty shootout won?",pensScore:"Penalty shootout score",
      newPlayer:"+ New player",name:"Name",rating:"Rating",version:"Version",evolution:"Evolution"}
  };
  let lang = localStorage.getItem('eafc.lang') || 'ru';
  const t=(k)=> (I18N[lang]&&I18N[lang][k])||k;
  const $=(id)=>document.getElementById(id);
  const dom=(s,r=document)=>r.querySelector(s);
  const domAll=(s,r=document)=>Array.from(r.querySelectorAll(s));
  function applyI18N(){
    domAll('[data-i18n]').forEach(el=>{ const key=el.getAttribute('data-i18n'); el.textContent=t(key); });
    domAll('[data-i18n-placeholder]').forEach(el=>{ const key=el.getAttribute('data-i18n-placeholder'); el.setAttribute('placeholder', t(key)); });
    updateMatchCounter();
  }

  const LS_KEY='eafc.v2';
  function nowISO(){ return new Date().toISOString(); }
  function uuid(){ return (crypto.randomUUID?crypto.randomUUID():'id-'+Math.random().toString(36).slice(2)); }
  function defaultState(){ return {version:2,createdAt:nowISO(),updatedAt:nowISO(),matches:[],players:{}}; }
  function normalizeMode(s){
    if(!s) return 'RIVALS'; s=String(s).toUpperCase();
    if(s.includes('RIVAL')) return 'RIVALS';
    if(s.includes('CHAMP')||s.includes('WL')||s.includes('WEEKEND')) return 'CHAMPIONS';
    if(s.includes('TOURN')) return 'TOURNAMENTS';
    if(s.includes('LIVE')) return 'LIVE_EVENTS';
    if(s.includes('GAUNT')) return 'GAUNTLETS';
    if(s.includes('RUSH')) return 'RUSH';
    return ['RIVALS','CHAMPIONS','TOURNAMENTS','LIVE_EVENTS','GAUNTLETS','RUSH'].includes(s)?s:'RIVALS';
  }
  function deriveResult(m){
    if(m.penalties){ if(m.pensWon===true) return 'W'; if(m.pensWon===false) return 'L'; }
    const f=Number(m.score?.for??0), a=Number(m.score?.against??0);
    if(f>a) return 'W'; if(f<a) return 'L'; return 'D';
  }
  function migrateIfNeeded(){
    let s; try{s=JSON.parse(localStorage.getItem(LS_KEY));}catch(e){s=null;}
    if(!s){ s=defaultState(); localStorage.setItem(LS_KEY, JSON.stringify(s)); }
    for(const m of (s.matches||[])){
      if(!('competition' in m)) m.competition=null;
      if(!('pensWon' in m)) m.pensWon=null;
      if(!('pensScore' in m)) m.pensScore=null;
      m.mode=normalizeMode(m.mode); m.result=deriveResult(m);
    }
    return s;
  }
  let state=migrateIfNeeded();
  function saveState(){ state.updatedAt=nowISO(); localStorage.setItem(LS_KEY, JSON.stringify(state)); }

  function computeSummary(matches){
    let w=0,d=0,l=0,gf=0,ga=0,etW=0,etL=0,pens=0,pensW=0,pensL=0;
    for(const m of matches){
      const r=deriveResult(m);
      if(r==='W') w++; else if(r==='D') d++; else l++;
      gf+=Number(m.score?.for||0); ga+=Number(m.score?.against||0);
      if(m.penalties){ pens++; if(m.pensWon===true) pensW++; else if(m.pensWon===false) pensL++; }
      else if(m.extraTime && (m.score?.for!==m.score?.against)){ if(r==='W') etW++; else if(r==='L') etL++; }
    }
    const n=matches.length, denom=n||1;
    return {n,w,d,l,winPct:n?+((w/n)*100).toFixed(1):0,gf,ga,avgGF:+(gf/denom).toFixed(2),avgGA:+(ga/denom).toFixed(2),etW,etL,pens,pensW,pensL};
  }
  function computeLastNForm(matches,n=20){ const arr=[...matches].sort((a,b)=>(a.date>b.date?-1:1)).slice(0,n); return computeSummary(arr); }
  function computeStreaks(matches){
    const arr=[...matches].sort((a,b)=>(a.date>b.date?1:-1)); let maxW=0,maxL=0,curW=0,curL=0;
    for(const m of arr){ const r=deriveResult(m);
      if(r==='W'){ curW++; maxW=Math.max(maxW,curW); curL=0; }
      else if(r==='L'){ curL++; maxL=Math.max(maxL,curL); curW=0; }
      else { curW=0; curL=0; }
    }
    return {maxW,maxL};
  }

  function getPlayerProfile(id){ return state.players[id]; }
  function upsertPlayerProfile(p){
    if(!p.id) p.id=uuid();
    state.players[p.id]={id:p.id,name:p.name,rating:Number(p.rating||0),position:p.position||'',version:p.version||null,evolution:p.evolution||null};
    saveState(); return state.players[p.id];
  }
  function ensurePlayerRefFromProfile(id){ const prof=getPlayerProfile(id); if(!prof) return null; return {playerId:id,name:prof.name,rating:prof.rating,position:prof.position,version:prof.version,evolution:prof.evolution}; }
  function formatPlayerLabel(obj){ if(!obj) return ''; const name=obj.name??'', rating=obj.rating!=null?String(obj.rating):'', pos=obj.position??'', ver=obj.version||'', evo=obj.evolution||''; let base=`${name}-${rating}--${pos}`; if(ver) base+=`-${ver}`; if(evo) base+=`-${evo}`; return base; }

  const COMP_MODES=new Set(['RIVALS','CHAMPIONS','TOURNAMENTS','LIVE_EVENTS','GAUNTLETS']);
  const GROUP_MODES=new Set(['CHAMPIONS','TOURNAMENTS','LIVE_EVENTS','GAUNTLETS','RIVALS']);
  function competitiveMatches(all){ return all.filter(m=>COMP_MODES.has(m.mode)); }
  function groupByMode(matches){ const map=new Map(); for(const m of matches){ const arr=map.get(m.mode)||[]; arr.push(m); map.set(m.mode,arr);} return map; }
  function groupByCompOrMode(matches){ const tm=new Map(); for(const m of matches){ if(!GROUP_MODES.has(m.mode)) continue; const key=(m.competition&&m.competition.trim())||m.mode; const arr=tm.get(key)||[]; arr.push(m); tm.set(key,arr);} return tm; }

  const modeFilterEl=$('modeFilter'), searchEl=$('searchInput'), langSwitcher=$('langSwitcher'), matchCountTag=$('matchCountTag');
  const matchesTableBody=dom('#matchesTable tbody'), playersTableBody=dom('#playersTable tbody');
  const compOverallEl=$('compOverall'), modesTableBody=dom('#modesTable tbody'), tournamentsTableBody=dom('#tournamentsTable tbody'), tournamentPicker=$('tournamentPicker'), tournamentMatchesBody=dom('#tournamentMatches tbody');
  const btnCloseModal=$('btnCloseModal'), btnSaveModal=$('btnSaveModal'), modalBody=$('modalBody'), modalBackdrop=$('modalBackdrop');

  function getFilteredMatches(){
    const mode=modeFilterEl.value||'ALL', q=(searchEl.value||'').trim().toLowerCase();
    let arr=state.matches.slice(); if(mode!=='ALL') arr=arr.filter(m=>m.mode===mode);
    if(q) arr=arr.filter(m=>(m.opponent||'').toLowerCase().includes(q)||(m.notes||'').toLowerCase().includes(q)||(m.competition||'').toLowerCase().includes(q));
    arr.sort((a,b)=>(a.date>b.date?-1:1)); return arr;
  }
  function updateMatchCounter(){ const n=getFilteredMatches().length; matchCountTag.textContent=(lang==='ru')?`${n} матча`:`${n} ${t('matches')}`; }
  function pillResult(r){ const c=r==='W'?'win':(r==='L'?'lose':'draw'); const label=r==='W'?'W':(r==='L'?'L':'D'); return `<span class="pill ${c}">${label}</span>`; }

  function renderDash(){
    const matches=getFilteredMatches(), f=computeLastNForm(matches,20);
    dom('#form20').innerHTML=`
      <div class="box"><div class="muted mini">${t('win')}</div><div class="nowrap">${f.w} (${f.winPct}%)</div></div>
      <div class="box"><div class="muted mini">${t('draw')}</div><div>${f.d}</div></div>
      <div class="box"><div class="muted mini">${t('loss')}</div><div>${f.l}</div></div>
      <div class="box"><div class="muted mini">${t('gf')}</div><div>${f.gf} <span class="muted mini">(${t('avg')} ${f.avgGF})</span></div></div>
      <div class="box"><div class="muted mini">${t('ga')}</div><div>${f.ga} <span class="muted mini">(${t('avg')} ${f.avgGA})</span></div></div>
      <div class="box"><div class="muted mini">N</div><div>${matches.length}</div></div>`;
    const s=computeStreaks(matches);
    dom('#streaks').innerHTML=`
      <div class="box"><div class="muted mini">${t('maxWin')}</div><div>${s.maxW}</div></div>
      <div class="box"><div class="muted mini">${t('maxLoss')}</div><div>${s.maxL}</div></div>`;
  }

  function playerRefShort(ref){ return ref?formatPlayerLabel(ref):''; }
  function renderMatches(){
    const arr=getFilteredMatches();
    const rows=arr.map(m=>{
      const dt=m.date?m.date.replace('T',' '):'', modeStage=m.mode+(m.stage?(' / '+m.stage):''), sc=`${m.score?.for??0}:${m.score?.against??0}`;
      const et=m.extraTime?'ET':'', pens=m.penalties?(m.pensScore?('✓ '+escapeHtml(m.pensScore)):'✓'):'';
      const mvp=m.mvp?playerRefShort(m.mvp):'';
      const goals=(m.goals||[]).map(g=>`<span class="tag mini">${playerRefShort(g)}</span>`).join(' ');
      const assists=(m.assists||[]).map(a=>`<span class="tag mini">${playerRefShort(a)}</span>`).join(' ');
      const notes=m.notes?`<span class="muted">${escapeHtml(m.notes)}</span>`:'', comp=m.competition?`<span class="muted">${escapeHtml(m.competition)}</span>`:'';
      return `<tr data-id="${m.id}">
        <td class="nowrap">${dt}</td><td>${modeStage}</td><td>${comp}</td><td>${sc}</td><td>${pillResult(deriveResult(m))}</td>
        <td>${et}</td><td>${pens}</td><td>${mvp}</td><td><div class="list-badges">${goals}</div></td><td><div class="list-badges">${assists}</div></td><td>${notes}</td>
        <td class="nowrap"><button class="mini" data-act="edit">Edit</button> <button class="mini" data-act="delete">Del</button></td></tr>`;
    }).join('');
    matchesTableBody.innerHTML=rows||`<tr><td colspan="12" class="muted">${lang==='ru'?'Нет матчей':'No matches'}</td></tr>`;
    domAll('#matchesTable tbody tr button').forEach(btn=>{
      btn.addEventListener('click',e=>{
        const tr=e.target.closest('tr'); const id=tr.getAttribute('data-id'); const act=e.target.getAttribute('data-act');
        if(act==='edit') openMatchModal(id); if(act==='delete') deleteMatch(id);
      });
    });
  }

  function aggregatePlayers(matches){
    const overall=new Map(), byMode=new Map();
    function touch(container,id,profile){ if(!container.has(id)){ container.set(id,{id,profile,matches:0,goals:0,assists:0,mvp:0}); } return container.get(id); }
    function reg(m,ref,type){ if(!ref||!ref.playerId) return; const prof=getPlayerProfile(ref.playerId)||ref; const o=touch(overall,ref.playerId,prof);
      if(type==='match') o.matches++; if(type==='goal') o.goals++; if(type==='assist') o.assists++; if(type==='mvp') o.mvp++;
      const mp=byMode.get(m.mode)||new Map(); byMode.set(m.mode,mp); const om=touch(mp,ref.playerId,prof);
      if(type==='match') om.matches++; if(type==='goal') om.goals++; if(type==='assist') om.assists++; if(type==='mvp') om.mvp++; }
    for(const m of matches){
      if(Array.isArray(m.lineup)){ const ids=new Set(); for(const r of m.lineup){ if(r&&r.playerId) ids.add(r.playerId);} for(const id of ids){ reg(m,{playerId:id},'match'); } }
      else{ const inv=new Set(); if(m.mvp&&m.mvp.playerId) inv.add(m.mvp.playerId); for(const g of (m.goals||[])){ if(g&&g.playerId) inv.add(g.playerId);} for(const a of (m.assists||[])){ if(a&&a.playerId) inv.add(a.playerId);} for(const id of inv){ reg(m,{playerId:id},'match'); } }
      if(m.mvp) reg(m,m.mvp,'mvp'); for(const g of (m.goals||[])) reg(m,g,'goal'); for(const a of (m.assists||[])) reg(m,a,'assist');
    }
    const overallArr=Array.from(overall.values()).map(s=>({...s,ga:s.goals+s.assists,gapm:s.matches?+((s.goals+s.assists)/s.matches).toFixed(3):0,mode:'ALL'}));
    const byModeArr=[]; for(const [mode,mmap] of byMode.entries()){ for(const s of mmap.values()){ byModeArr.push({...s,ga:s.goals+s.assists,gapm:s.matches?+((s.goals+s.assists)/s.matches).toFixed(3):0,mode}); } }
    return {overall:overallArr,byMode:byModeArr};
  }
  function aggregatePlayersForView(){
    const view=$('playersView').value, mode=$('playersMode').value||'ALL';
    const base=(mode==='ALL')?state.matches:state.matches.filter(m=>m.mode===mode);
    const ag=aggregatePlayers(base);
    return (view==='ALL') ? ((mode==='ALL')?aggregatePlayers(state.matches).overall:ag.byMode) : ((mode==='ALL')?aggregatePlayers(state.matches).byMode:ag.byMode);
  }
  function renderPlayers(){
    const pos=$('positionFilter').value||''; let data=aggregatePlayersForView(); if(pos) data=data.filter(r=>(r.profile?.position||'')===pos);
    data.sort((a,b)=>(b.ga-a.ga));
    const rows=data.map(r=>{ const label=formatPlayerLabel(r.profile||{}); return `<tr><td>${escapeHtml(label)}</td><td>${r.matches}</td><td>${r.goals}</td><td>${r.assists}</td><td>${r.mvp}</td><td>${r.ga}</td><td>${r.gapm}</td><td>${r.mode||'ALL'}</td></tr>`; }).join('');
    playersTableBody.innerHTML=rows||`<tr><td colspan="8" class="muted">${lang==='ru'?'Нет данных':'No data'}</td></tr>`;
  }

  function renderCompetitions(){
    const comp=competitiveMatches(state.matches), s=computeSummary(comp);
    $('compOverall').innerHTML=`
      <div class="box"><div class="muted mini">${t('matches')}</div><div>${s.n}</div></div>
      <div class="box"><div class="muted mini">W</div><div>${s.w}</div></div>
      <div class="box"><div class="muted mini">D</div><div>${s.d}</div></div>
      <div class="box"><div class="muted mini">L</div><div>${s.l}</div></div>
      <div class="box"><div class="muted mini">Win%</div><div>${s.winPct}%</div></div>
      <div class="box"><div class="muted mini">GF</div><div>${s.gf} <span class="muted mini">(${t('avg')} ${s.avgGF})</span></div></div>
      <div class="box"><div class="muted mini">GA</div><div>${s.ga} <span class="muted mini">(${t('avg')} ${s.avgGA})</span></div></div>
      <div class="box"><div class="muted mini">ET W/L</div><div>${s.etW}/${s.etL}</div></div>
      <div class="box"><div class="muted mini">Pens W/L</div><div>${s.pensW}/${s.pensL} (${s.pens})</div></div>`;

    const modes=['RIVALS','CHAMPIONS','TOURNAMENTS','LIVE_EVENTS','GAUNTLETS'];
    const gm=groupByMode(comp);
    $('modesTable').querySelector('tbody').innerHTML = modes.map(mode=>{
      const arr=gm.get(mode)||[]; const r=computeSummary(arr);
      return `<tr><td>${mode}</td><td>${r.n}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.winPct}%</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.avgGF}</td><td>${r.avgGA}</td><td>${r.etW}</td><td>${r.etL}</td><td>${r.pens}</td><td>${r.pensW}</td><td>${r.pensL}</td></tr>`;
    }).join('');

    const gm2=groupByCompOrMode(comp);
    const names=Array.from(gm2.keys()).sort((a,b)=>a.localeCompare(b));
    tournamentPicker.innerHTML = `<option value="">—</option>` + names.map(n=>`<option>${escapeHtml(n)}</option>`).join('');
    $('tournamentsTable').querySelector('tbody').innerHTML = names.map(name=>{
      const arr=gm2.get(name)||[]; const r=computeSummary(arr);
      const last=[...arr].sort((a,b)=>(a.date>b.date?-1:1))[0]; const lastStage=last?.stage||'';
      return `<tr class="clickable" data-name="${escapeHtml(name)}"><td>${escapeHtml(name)}</td><td>${r.n}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.winPct}%</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.avgGF}</td><td>${r.avgGA}</td><td>${r.etW}</td><td>${r.etL}</td><td>${r.pens}</td><td>${r.pensW}</td><td>${r.pensL}</td><td>${escapeHtml(lastStage)}</td></tr>`;
    }).join('') || `<tr><td colspan="16" class="muted">${lang==='ru'?'Нет турниров/ивентов':'No tournaments/events'}</td></tr>`;

    domAll('#tournamentsTable tbody tr.clickable').forEach(tr=>{
      tr.addEventListener('click', ()=>{ const name=tr.getAttribute('data-name'); tournamentPicker.value=name; renderTournamentMatches(name); });
    });
    tournamentPicker.onchange=()=> renderTournamentMatches(tournamentPicker.value);
    renderTournamentMatches(tournamentPicker.value||'');
  }

  function renderTournamentMatches(name){
    const comp=competitiveMatches(state.matches);
    if(!name){ tournamentMatchesBody.innerHTML=`<tr><td colspan="10" class="muted">${lang==='ru'?'Выберите турнир/ивент':'Pick an event'}</td></tr>`; return; }
    const list=comp.filter(m=> (m.competition && m.competition===name) || (!m.competition && m.mode===name));
    list.sort((a,b)=>(a.date>b.date?-1:1));
    const rows=list.map(m=>{
      const dt=(m.date||'').replace('T',' '), sc=`${m.score?.for??0}:${m.score?.against??0}`;
      const et=m.extraTime?'✓':'', pens=m.penalties?'✓':'', mvp=m.mvp?formatPlayerLabel(m.mvp):'';
      const goals=(m.goals||[]).map(g=>`<span class="tag mini">${formatPlayerLabel(g)}</span>`).join(' ');
      const assists=(m.assists||[]).map(a=>`<span class="tag mini">${formatPlayerLabel(a)}</span>`).join(' ');
      return `<tr><td class="nowrap">${dt}</td><td>${escapeHtml(m.stage||'')}</td><td>${sc}</td><td>${pillResult(deriveResult(m))}</td><td>${et}</td><td>${pens}</td><td>${escapeHtml(m.pensScore||'')}</td><td>${escapeHtml(mvp)}</td><td>${goals}</td><td>${assists}</td></tr>`;
    }).join('');
    tournamentMatchesBody.innerHTML = rows || `<tr><td colspan="10" class="muted">${lang==='ru'?'Нет матчей':'No matches'}</td></tr>`;
  }

  function renderAll(){ applyI18N(); renderDash(); renderMatches(); renderPlayers(); renderCompetitions(); }

  function openMatchModal(id){
    const editing=!!id; const m=editing?state.matches.find(x=>x.id===id):null;
    $('modalBody').innerHTML = renderMatchForm(); $('modalBackdrop').style.display='flex';
    // handlers
    dom('#btnAddGoal').addEventListener('click',()=>addEventRow('goals'));
    dom('#btnAddAssist').addEventListener('click',()=>addEventRow('assists'));
    dom('#btnAddLineup').addEventListener('click',()=>addEventRow('lineup'));
    dom('#btnAddMvpNew').addEventListener('click',()=>openPlayerQuickAdd('mvp'));
    dom('#btnAddGoalNew').addEventListener('click',()=>openPlayerQuickAdd('goals'));
    dom('#btnAddAssistNew').addEventListener('click',()=>openPlayerQuickAdd('assists'));
    dom('#btnAddLineupNew').addEventListener('click',()=>openPlayerQuickAdd('lineup'));
    const modeSel=$('f_mode');
    function toggleCompetitionField(){
      const compRow=$('compRow'), val=modeSel.value;
      if(['CHAMPIONS','GAUNTLETS','TOURNAMENTS','LIVE_EVENTS'].includes(val)) compRow.classList.remove('hidden'); else compRow.classList.add('hidden');
    }
    modeSel.addEventListener('change', toggleCompetitionField);

    populatePlayerSelect($('sel_mvp'));

    if(m){
      $('f_date').value=(m.date||'').slice(0,16);
      $('f_platform').value=m.platform||'PS5'; $('f_mode').value=m.mode||'RIVALS';
      $('f_stage').value=m.stage||''; $('f_comp').value=m.competition||'';
      $('f_for').value=m.score?.for??0; $('f_against').value=m.score?.against??0;
      $('f_et').checked=!!m.extraTime; $('f_pens').checked=!!m.penalties;
      $('f_pensWon').value=(m.penalties?(m.pensWon===true?'W':(m.pensWon===false?'L':'')):'');
      $('f_pensScore').value=m.pensScore||''; $('f_opp').value=m.opponent||''; $('f_notes').value=m.notes||'';
      if(m.mvp && m.mvp.playerId) $('sel_mvp').value=m.mvp.playerId;
      const goalsWrap=$('wrap_goals'); goalsWrap.innerHTML=''; (m.goals||[]).forEach(g=>addEventRow('goals', g.playerId));
      const assistsWrap=$('wrap_assists'); assistsWrap.innerHTML=''; (m.assists||[]).forEach(a=>addEventRow('assists', a.playerId));
      const lineupWrap=$('wrap_lineup'); lineupWrap.innerHTML=''; (m.lineup||[]).forEach(p=>addEventRow('lineup', p.playerId));
    }
    toggleCompetitionField();

    $('btnSaveModal').onclick=()=>{
      const payload=readMatchForm(); if(editing){ const idx=state.matches.findIndex(x=>x.id===id); if(idx>=0) state.matches[idx]={...payload,id}; }
      else { payload.id=uuid(); state.matches.unshift(payload); }
      saveState(); $('modalBackdrop').style.display='none'; renderAll();
    };
    $('btnCloseModal').onclick=()=>{$('modalBackdrop').style.display='none';};
  }

  function renderMatchForm(){ return `
    <div class="grid cols-3">
      <div class="section">
        <div class="grid">
          <label class="mini">${t('date')}<br><input id="f_date" type="datetime-local"></label>
          <label class="mini">${t('platform')}<br><select id="f_platform"><option>PS5</option><option>XBOX</option><option>PC</option><option>Other</option></select></label>
          <label class="mini">${t('mode_label')}<br><select id="f_mode">
            <option value="RIVALS">Rivals</option><option value="CHAMPIONS">Champions</option><option value="TOURNAMENTS">Tournaments</option>
            <option value="LIVE_EVENTS">Live Events</option><option value="GAUNTLETS">Gauntlets</option><option value="RUSH">Rush</option></select></label>
          <label id="compRow" class="mini hidden">${t('competition')}<br><input id="f_comp" placeholder="Cup name / Event name"></label>
          <label class="mini">${t('stage')}<br><input id="f_stage" placeholder="Quarterfinal / Group A / ..."></label>
          <div class="grid cols-3">
            <label class="mini">${t('scoreFor')}<br><input id="f_for" type="number" min="0" value="0"></label>
            <label class="mini">${t('scoreAg')}<br><input id="f_against" type="number" min="0" value="0"></label>
            <label class="mini">${t('result_label')}<br><input id="f_result" disabled placeholder="auto"></label>
          </div>
          <div class="grid cols-3">
            <label><input id="f_et" type="checkbox"> ${t('extraTime')}</label>
            <label><input id="f_pens" type="checkbox"> ${t('penalties')}</label>
            <label class=""><span class="mini">${t('pensWon')}</span><br>
              <select id="f_pensWon"><option value="">—</option><option value="W">W</option><option value="L">L</option></select>
            </label>
          </div>
          <label class="mini">${t('pensScore')}<br><input id="f_pensScore" placeholder="4-3"></label>
          <label class="mini">${t('opponent')}<br><input id="f_opp"></label>
          <label class="mini">${t('notes')}<br><textarea id="f_notes" rows="3"></textarea></label>
        </div>
      </div>

      <div class="section">
        <div class="row" style="justify-content:space-between;align-items:center">
          <div class="mini">${t('mvp')}</div><div class="row"><button id="btnAddMvpNew" class="mini">${t('newPlayer')}</button></div>
        </div>
        <select id="sel_mvp"><option value="">—</option></select>
        <div class="row" style="justify-content:space-between;align-items:center;margin-top:8px">
          <div class="mini">${t('goals_l')}</div><div class="row"><button id="btnAddGoal" class="mini">+1</button><button id="btnAddGoalNew" class="mini">${t('newPlayer')}</button></div>
        </div>
        <div id="wrap_goals" class="grid"></div>
        <div class="row" style="justify-content:space-between;align-items:center;margin-top:8px">
          <div class="mini">${t('assists_l')}</div><div class="row"><button id="btnAddAssist" class="mini">+1</button><button id="btnAddAssistNew" class="mini">${t('newPlayer')}</button></div>
        </div>
        <div id="wrap_assists" class="grid"></div>
      </div>

      <div class="section">
        <div class="row" style="justify-content:space-between;align-items:center">
          <div class="mini">${t('lineup')}</div><div class="row"><button id="btnAddLineup" class="mini">+1</button><button id="btnAddLineupNew" class="mini">${t('newPlayer')}</button></div>
        </div>
        <div id="wrap_lineup" class="grid"></div>
      </div>
    </div>`; }

  function addEventRow(kind, pre){ const wrap=$('wrap_'+kind); const row=document.createElement('div'); row.className='row'; row.style.gap='6px'; row.style.alignItems='center';
    row.innerHTML=`<select class="sel-player"></select> <button class="mini">✕</button>`; wrap.appendChild(row);
    const sel=row.querySelector('.sel-player'); populatePlayerSelect(sel); if(pre) sel.value=pre; row.querySelector('button').addEventListener('click',()=>row.remove()); }
  function populatePlayerSelect(selectEl){ selectEl.innerHTML=`<option value="">—</option>`+Object.values(state.players).map(p=>`<option value="${p.id}">${escapeHtml(formatPlayerLabel(p))}</option>`).join(''); }
  function openPlayerQuickAdd(target){ const box=document.createElement('div'); box.className='section'; box.innerHTML=`
    <div class="grid cols-3">
      <label class="mini">${t('name')}<br><input id="qp_name"></label>
      <label class="mini">${t('rating')}<br><input id="qp_rating" type="number" min="1" max="99"></label>
      <label class="mini">${t('position')}<br><input id="qp_pos" placeholder="ST/CAM/CB/..."></label>
      <label class="mini">${t('version')}<br><input id="qp_ver" placeholder="Gold/IF/..."></label>
      <label class="mini">${t('evolution')}<br><input id="qp_evo" placeholder="EVO1/..."></label>
    </div>
    <div class="row right" style="margin-top:6px"><button id="qp_save" class="mini">${t('save')}</button></div>`;
    const mount=(target==='mvp')?$('sel_mvp').parentElement:$('wrap_'+target); mount.parentElement.insertBefore(box,mount);
    box.querySelector('#qp_save').addEventListener('click',()=>{
      const p={name:box.querySelector('#qp_name').value.trim(),rating:Number(box.querySelector('#qp_rating').value||0),position:box.querySelector('#qp_pos').value.trim(),
        version:box.querySelector('#qp_ver').value.trim()||null,evolution:box.querySelector('#qp_evo').value.trim()||null};
      if(!p.name||!p.rating||!p.position){ box.remove(); return; }
      const prof=upsertPlayerProfile(p); domAll('select.sel-player').forEach(populatePlayerSelect); populatePlayerSelect($('sel_mvp')); if(target==='mvp') $('sel_mvp').value=prof.id; box.remove();
    },{once:true});
  }

  function readMatchForm(){
    const date=$('f_date').value||new Date().toISOString().slice(0,16);
    const platform=$('f_platform').value, mode=$('f_mode').value, competition=$('f_comp').value.trim()||null, stage=$('f_stage').value.trim()||null;
    const forN=Number($('f_for').value||0), agN=Number($('f_against').value||0);
    const et=$('f_et').checked, pens=$('f_pens').checked, pensWonSel=$('f_pensWon').value;
    const pensWon=pens?(pensWonSel==='W'?true:(pensWonSel==='L'?false:null)):null;
    const pensScore=(pens && $('f_pensScore').value.trim())?$('f_pensScore').value.trim():null;
    const opp=$('f_opp').value.trim()||null, notes=$('f_notes').value.trim()||null;
    const mvpId=$('sel_mvp').value||null; const mvp=mvpId?ensurePlayerRefFromProfile(mvpId):null;
    function collect(kind){ const sels=Array.from($('wrap_'+kind).querySelectorAll('select.sel-player')); const arr=[]; for(const s of sels){ const id=s.value; if(id){ const ref=ensurePlayerRefFromProfile(id); if(ref) arr.push(ref); } } return arr; }
    const goals=collect('goals'), assists=collect('assists'), lineup=collect('lineup');
    const base={date,platform,mode,competition,stage,score:{for:forN,against:agN},extraTime:et,penalties:pens,pensWon,pensScore,opponent:opp,notes,mvp,goals,assists,lineup:lineup.length?lineup:null};
    base.result=deriveResult(base); return base;
  }

  function showModal(){ $('modalBackdrop').style.display='flex'; }
  function hideModal(){ $('modalBackdrop').style.display='none'; }
  function deleteMatch(id){ if(!confirm(t('confirmDelete'))) return; const idx=state.matches.findIndex(m=>m.id===id); if(idx>=0){ state.matches.splice(idx,1); saveState(); renderAll(); } }

  $('btnAddMatch').addEventListener('click',()=>openMatchModal(null));
  modeFilterEl.addEventListener('change',()=>renderAll());
  searchEl.addEventListener('input',()=>renderAll());
  $('playersView').addEventListener('change',renderPlayers);
  $('positionFilter').addEventListener('change',renderPlayers);
  $('playersMode').addEventListener('change',renderPlayers);

  $('btnExportJson').addEventListener('click',()=>{ const json=JSON.stringify(state,null,2); downloadText(json,'eafc_state_'+tsFile()+'.json','application/json'); });
  $('btnExportCsvMatches').addEventListener('click',()=>{ const csv=buildCsvMatches(state.matches); downloadText(csv,'eafc_matches_'+tsFile()+'.csv','text/csv'); });
  $('btnExportCsvPlayers').addEventListener('click',()=>{ const ag=aggregatePlayers(state.matches); const csv1=buildCsvPlayers(ag.overall,false); const csv2=buildCsvPlayers(ag.byMode,true);
    downloadText(csv1,'eafc_players_overall_'+tsFile()+'.csv','text/csv'); downloadText(csv2,'eafc_players_by_mode_'+tsFile()+'.csv','text/csv'); });
  $('btnImport').addEventListener('click',()=>$('fileInput').click());
  $('fileInput').addEventListener('change',e=>{
    const file=e.target.files[0]; if(!file) return;
    if(!confirm(t('confirmImport'))) { e.target.value=''; return; }
    const reader=new FileReader(); reader.onload=function(){ try{
      const data=JSON.parse(reader.result);
      if(data.version===2){ for(const m of (data.matches||[])){ if(!('competition'in m)) m.competition=null; if(!('pensWon'in m)) m.pensWon=null; if(!('pensScore'in m)) m.pensScore=null; m.mode=normalizeMode(m.mode); m.result=deriveResult(m);} state=data; }
      else{ const init=defaultState(); init.matches=Array.isArray(data.matches)?data.matches:[]; init.players=(data.players&&typeof data.players==='object')?data.players:{};
        for(const m of init.matches){ if(!('competition'in m)) m.competition=null; if(!('pensWon'in m)) m.pensWon=null; if(!('pensScore'in m)) m.pensScore=null; m.mode=normalizeMode(m.mode); m.result=deriveResult(m);} state=init; }
      saveState(); renderAll();
    }catch(err){ alert('Import failed: '+err.message); } finally { e.target.value=''; } }; reader.readAsText(file);
  });

  function buildCsvMatches(matches){
    const head=['id','date','platform','mode','competition','stage','result','for','against','extraTime','penalties','pensWon','pensScore','opponent','mvp','goals','assists','notes'];
    const lines=[head.join(',')];
    for(const m of matches){
      const mvp=m.mvp?formatPlayerLabel(m.mvp):''; const goals=(m.goals||[]).map(formatPlayerLabel).join(';'); const assists=(m.assists||[]).map(formatPlayerLabel).join(';');
      const row=[m.id,m.date,m.platform,m.mode,safe(m.competition),safe(m.stage),deriveResult(m),m.score?.for??0,m.score?.against??0,m.extraTime?1:0,m.penalties?1:0,(m.pensWon===true?'W':(m.pensWon===false?'L':'')),safe(m.pensScore),safe(m.opponent),mvp,goals,assists,safe(m.notes)].map(csvCell).join(',');
      lines.push(row);
    } return lines.join('\n');
  }
  function buildCsvPlayers(rows,withMode){
    const head=['name','rating','position','version','evolution','matches','goals','assists','mvp','ga','ga_per_match']+(withMode?['mode']:[]);
    const lines=[head.join(',')];
    for(const r of rows){ const p=r.profile||{}; const row=[p.name||'',p.rating||'',p.position||'',p.version||'',p.evolution||'',r.matches||0,r.goals||0,r.assists||0,r.mvp||0,r.go||0,r.gapm||0]; if(withMode) row.push(r.mode||'ALL'); lines.push(row.map(csvCell).join(',')); }
    return lines.join('\n');
  }
  function csvCell(x){ if(x==null) x=''; x=String(x); if(/[",\n]/.test(x)) return '"'+x.replace(/"/g,'""')+'"'; return x; }
  function safe(x){ return x==null?'':String(x); }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function downloadText(text,filename,type){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=filename; a.click(); URL.revokeObjectURL(a.href); }
  function tsFile(){ const d=new Date(); const pad=n=>String(n).padStart(2,'0'); return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'_'+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds()); }

  $('langSwitcher').value=lang; $('langSwitcher').addEventListener('change',e=>{ lang=e.target.value; localStorage.setItem('eafc.lang',lang); renderAll(); });

  const dashCards=$('dashCards');
  domAll('.tab').forEach(tab=>{ tab.addEventListener('click',()=>{ domAll('.tab').forEach(t=>t.classList.remove('active')); tab.classList.add('active');
    const key=tab.getAttribute('data-tab'); const panels={matches:'tabMatches',players:'tabPlayers',competitions:'tabCompetitions'}; Object.entries(panels).forEach(([k,id])=>$(id).classList.toggle('hidden',k!==key));
    dashCards.classList.toggle('hidden', key!=='matches'); }); });

  function renderAll(){ applyI18N(); renderDash(); renderMatches(); renderPlayers(); renderCompetitions(); }
  renderAll();

})();