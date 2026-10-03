(()=>{
  /* MineD Web Demo v5 · 2026-10-03 (v4 + 시작 화면 연결)
     ※ 아래 값은 발표용 합성 데이터입니다. */
  const GRADE_TEXT={
    held:'그 뒤 4주는 평소 범위였습니다',
    returned:'돌아왔지만 그 뒤는 확인되지 않았습니다',
    broken:'돌아왔지만 다시 벗어났습니다',
    open:'이 주 뒤는 아직 확인되지 않았습니다',
    insufficient:'기록이 비어 판정할 수 없습니다'
  };
  const strata=[
    {year:2026,floor:0,depth:'B1 · -18 m',layer:'B1 · 2024–2026',mineral:'호박',axis:'걸음 · 많음',period:'2026. 01. 12–01. 18',grade:'open',
     summary:'걸음 수가 평소 범위 위로 벗어난 주입니다.',
     evidence:[['걸음 수','직전 52주 대비 상위 4%'],['교차 출처','건강 기록 1종']],source:'건강 기록',
     asset:'../MineD_video_assets_v1/261003_MineD_C01_BEER_START_16x9_v2.png',scene:'노을 아래에서 차가운 맥주 한 모금'},
    {year:2022,floor:1,depth:'B2 · -42 m',layer:'B2 · 2020–2023',mineral:'형석',axis:'기록 · 적음 + 걸음 · 적음',period:'2022. 12. 26–2023. 01. 01',grade:'broken',
     summary:'메모 길이와 걸음 수가 함께 평소 범위 아래로 벗어났습니다. 서로 다른 두 출처가 같은 주를 가리킵니다.',
     evidence:[['메모 길이','직전 52주 대비 하위 3%'],['걸음 수','직전 52주 대비 하위 6%']],source:'메모 · 건강 기록 (2종 교차)',
     asset:'../MineD_video_assets_v1/261003_MineD_C04_END_C05_START_16x9_v1.png',scene:'오래된 방갈로 안에서 기록과 머무르기'},
    {year:2021,floor:1,depth:'B2 · -48 m',layer:'B2 · 2020–2023',mineral:'자수정',axis:'화면 · 많음',period:'2021. 11. 22–11. 28',grade:'returned',
     summary:'영상 시청 시간이 평소 범위 위로 벗어난 주입니다.',
     evidence:[['영상 시청','직전 52주 대비 상위 3%'],['교차 출처','유튜브 기록 1종']],source:'유튜브 기록',
     asset:'../MineD_video_assets_v1/261003_MineD_C06_END_C07_START_16x9_v1.png',scene:'문을 열고 바다와 요트를 향해 나가기'},
    {year:2016,floor:2,depth:'B3 · -73 m',layer:'B3 · 2011–2019',mineral:'황철석',axis:'걸음 · 적음',period:'2016. 11. 21–11. 27',grade:'held',
     summary:'걸음 수가 평소 범위 아래로 벗어난 주입니다. 오래된 기록이라 빈 날이 섞여 있습니다.',
     evidence:[['걸음 수','직전 52주 대비 하위 4%'],['기록 빈 날','7일 중 2일']],source:'건강 기록',
     asset:'../MineD_video_assets_v1/261003_MineD_C09_END_16x9_v1.png',scene:'다양한 어종과 함께 물속에서 유영하기'},
    {year:2015,floor:2,depth:'B3 · -79 m',layer:'B3 · 2011–2019',mineral:'흑요석',axis:'기록 · 많음',period:'2015. 10. 19–10. 25',grade:'held',
     summary:'메모 작성량이 평소 범위 위로 벗어난 주입니다. 다른 출처의 기록은 없어 교차 확인은 되지 않았습니다.',
     evidence:[['메모 작성','직전 52주 대비 상위 2%'],['교차 출처','메모 1종 · 교차 없음']],source:'메모 단일 기록',
     asset:'../MineD_video_assets_v1/261003_MineD_C10_END_16x9_v1.png',scene:'조개를 건네받은 가시복어와 교감하기'}
  ];
  let selected=strata[0],hits=0,moving=false;
  const $=s=>document.querySelector(s);
  const launch=$('#sxLaunch'),app=$('#sxApp'),years=$('#sxYears'),cabin=$('#sxCabin'),tunnel=$('#sxTunnel'),mineral=$('#sxMineral'),hammer=$('#sxHammer'),bar=$('#sxProgress i');
  const topFor=f=>[5.5,39,72.5][f];
  const floorName=f=>['B1','B2','B3'][f];
  function neutralLabels(){
    const labels=['B1 · 2024–2026','B2 · 2020–2023','B3 · 2011–2019'];
    document.querySelectorAll('.sx-layer[data-floor]').forEach(el=>{const f=+el.dataset.floor;if(labels[f])el.setAttribute('data-label',labels[f]);});
    const lg=$('.sx-legend');
    if(lg)lg.innerHTML='깊을수록 오래된 기록입니다.<br>광석 = 직전 52주와 비교해 평소 범위를 벗어난 주.<br>광석 이름은 가장 크게 벗어난 축과 방향이 정합니다. 두 출처 이상이 같은 주를 가리키면 형석입니다.';
  }
  function renderYears(){years.innerHTML=strata.map((x,i)=>`<button class="sx-year${x===selected?' on':''}" data-i="${i}"><b>${x.year}</b><span>${floorName(x.floor)} · ${x.mineral}</span></button>`).join('');years.querySelectorAll('button').forEach(b=>b.onclick=()=>travel(strata[+b.dataset.i]));}
  function travel(item){if(moving)return;selected=item;hits=0;moving=true;renderYears();$('#sxDepth').textContent=`이동 중 · ${item.year}`;cabin.classList.add('moving');cabin.classList.remove('arrived');cabin.style.top=topFor(item.floor)+'%';tunnel.style.top=(item.floor*33.333+8)+'%';bar.style.width='0';mineral.className='sx-mineral';lockDetail();setTimeout(()=>{moving=false;cabin.classList.remove('moving');cabin.classList.add('arrived');$('#sxDepth').textContent=item.depth;$('#sxCabinLabel').textContent=item.year+' 정차';$('#sxMineralLabel').textContent=item.mineral+' · 눌러 채굴';},1500)}
  function lockDetail(){$('#sxDetailBody').innerHTML=`<div class="sx-lock"><strong>${selected.year}년 지층에 정차했습니다</strong>왼쪽 광석을 세 번 눌러 직접 캐면<br>근거 자료와 Mine D 장면이 열립니다.</div>`;$('#sxXrBtn').disabled=true;}
  function mine(){if(moving||hits>=3)return;hits++;hammer.classList.remove('swing');void hammer.offsetWidth;hammer.classList.add('swing');mineral.classList.add('hit');setTimeout(()=>mineral.classList.remove('hit'),220);bar.style.width=(hits/3*100)+'%';if(hits===3){mineral.classList.add('cracked');setTimeout(reveal,350)}}
  function reveal(){
    const e=selected.evidence.map(x=>`<div><strong>${x[0]}</strong>${x[1]}</div>`).join('');
    $('#sxDetailBody').innerHTML=`<div class="sx-state">MINERAL OPEN · 근거 확인</div>
<h2 class="sx-title">${selected.year} · ${selected.mineral}</h2>
<div class="sx-period">${selected.period} · ${selected.layer}</div>
<div class="sx-card"><b>기록이 보여준 것</b><p>${selected.summary}</p><div class="sx-evidence">${e}</div><p style="color:#8f8d87;margin-top:8px">광석을 정한 축 · ${selected.axis}</p></div>
<div class="sx-card"><b>그 뒤의 기록</b><p>${GRADE_TEXT[selected.grade]}</p></div>
<div class="sx-card"><b>원본 자료 위치</b><p>${selected.source}<br><span style="color:#777">원본은 기기 안에 두고 특징값과 출처만 연결합니다.</span></p></div>
<div class="sx-asset"><img src="${selected.asset}" alt="${selected.scene}"><span>실제 Mine D 에셋</span></div>
<div class="sx-card"><b>이 광석에서 열 수 있는 섬 장면</b><p>${selected.scene}</p><p style="color:#8f8d87">장면은 기록이 정하지 않습니다. 민디와의 대화에서 사용자가 고른 바람으로 열립니다.</p></div>`;
    $('#sxXrBtn').disabled=false;
    $('#sxLog').textContent=`evidence → feature → ${selected.mineral} → island instruction → XR asset`;
    try{localStorage.setItem('mineD.lastMined',JSON.stringify({year:selected.year,mineral:selected.mineral,period:selected.period,grade:selected.grade,asset:selected.asset,scene:selected.scene}));}catch(_){}
  }
  function sendXR(){const payload={schema:'mine-d-xr/1.0',year:selected.year,floor:selected.floor,depth:selected.depth,mineral:selected.mineral,axis:selected.axis,grade:selected.grade,asset:selected.asset,scene:selected.scene,evidence:selected.evidence,raw_records_exported:false};try{localStorage.setItem('mineD.xrPayload',JSON.stringify(payload));}catch(_){}$('#sxLog').textContent='✓ XR Blocks 전달 완료 · 원본 데이터 제외 · 에셋/연도/광석만 전송';const a=document.createElement('a');a.href='../MineD_XRBlocks_v2/index.html?year='+selected.year;a.target='_blank';a.click();}
  launch.onclick=()=>{app.classList.add('show');neutralLabels();const d=$('#sxDiscovery');d.classList.remove('gone');requestAnimationFrame(()=>d.classList.add('reveal'))};
  $('#sxEnter').onclick=()=>{$('#sxDiscovery').classList.add('gone');travel(selected)};
  $('#sxClose').onclick=()=>app.classList.remove('show');
  mineral.onclick=mine;$('#sxMineBtn').onclick=mine;$('#sxXrBtn').onclick=sendXR;
  document.addEventListener('keydown',e=>{if(e.key==='Escape')app.classList.remove('show')});
  neutralLabels();renderYears();lockDetail();
})();
/* v5 — 시작 화면(start.html)의 민디 선택 버튼과 연결 */
window.addEventListener('message',e=>{const d=e.data||{};
  if(d.type==='mined-explore'){const b=document.getElementById('sxLaunch');if(b)b.click();}
  if(d.type==='mined-ask'){const b=document.getElementById('askBtn');if(b)b.click();}
});
