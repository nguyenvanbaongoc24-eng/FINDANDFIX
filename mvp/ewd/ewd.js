const state={data:null,system:'all',onlyBookmarks:false,current:null,zoom:1,pan:{x:0,y:0},pointers:new Map(),pinch:null};
const $=selector=>document.querySelector(selector);
const bookmarkKey='garage-atlas-ewd-bookmarks-v1';
const getBookmarks=()=>new Set(JSON.parse(localStorage.getItem(bookmarkKey)||'[]'));
const setBookmarks=items=>localStorage.setItem(bookmarkKey,JSON.stringify([...items]));

const icons={schematic:'⌁',pinout:'◉',connector:'▦',ground:'⏚',colors:'◫'};
const escapeHtml=value=>String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

async function init(){
  const response=await fetch('../data/ewd-library.json');
  if(!response.ok)throw new Error('Không nạp được EWD Library');
  state.data=await response.json();
  renderSystems();renderArtifacts();wireUi();
}

function renderSystems(){
  const tabs=$('#systems');
  tabs.innerHTML=[{id:'all',name:'Tất cả',icon:'⌘'},...state.data.systems].map(system=>`<button data-system="${system.id}" class="${system.id===state.system?'active':''}">${system.icon} ${system.name}</button>`).join('');
  tabs.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{state.system=button.dataset.system;renderSystems();renderArtifacts();}));
}

function renderArtifacts(){
  const bookmarks=getBookmarks();
  const items=state.data.artifacts.filter(item=>(state.system==='all'||item.system===state.system)&&(!state.onlyBookmarks||bookmarks.has(item.id)));
  $('#artifact-list').innerHTML=items.length?items.map(item=>`<button class="artifact" data-artifact="${item.id}"><span class="artifact-icon">${icons[item.kind]||'⌁'}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.type)} · ${escapeHtml(item.format)}</small></span><span class="pill">${item.status}</span></button>`).join(''):'<div class="empty">Chưa có sơ đồ đã lưu trong phạm vi này.</div>';
  $('#artifact-list').querySelectorAll('[data-artifact]').forEach(button=>button.addEventListener('click',()=>openArtifact(button.dataset.artifact)));
}

function artifactById(id){return state.data.artifacts.find(item=>item.id===id);}
function technicalMarkup(item){
  if(item.kind==='pinout')return `<div class="technical"><h3>ECU Pinout · ECM connector A</h3><p>Thông tin terminal minh họa. Trong môi trường production, mỗi hàng phải có artifact nguồn và trạng thái kiểm duyệt.</p><table><thead><tr><th>Pin</th><th>Signal</th><th>Màu dây</th><th>Hướng</th></tr></thead><tbody><tr><td>A12</td><td>IG1 input</td><td>R</td><td>Power</td></tr><tr><td>A18</td><td>CAN-H</td><td>L-B</td><td>Bidirectional</td></tr><tr><td>A19</td><td>Sensor ground</td><td>B</td><td>Ground</td></tr></tbody></table></div>`;
  if(item.kind==='connector')return `<div class="technical"><h3>C101 · connector face view</h3><p>Vị trí minh họa: hộp junction dưới táp-lô. Khóa connector hướng lên trên.</p><div class="connector-grid">${['1','2','3','4','5','6','7','8'].map(pin=>`<span class="pin">${pin}</span>`).join('')}</div></div>`;
  if(item.kind==='ground')return `<div class="technical"><h3>G101 · Ground location</h3><div class="ground-mark">⏚</div><p>Vị trí minh họa: phía trái khoang hành khách, gần chân A-pillar. Kiểm tra lực siết và bề mặt tiếp xúc theo tài liệu được cấp quyền.</p></div>`;
  if(item.kind==='colors')return `<div class="technical"><h3>Wire color code legend</h3>${[['#d02f35','R','Red / Đỏ'],['#1d75bc','L-B','Blue with black tracer'],['#202326','B','Black / Đen'],['#ececec','W','White / Trắng']].map(([color,code,label])=>`<div class="color-row"><span class="swatch" style="background:${color}"></span><b>${code}</b><span>${label}</span></div>`).join('')}<p>Legend chỉ là dữ liệu demo; mã màu thực tế phụ thuộc nhà sản xuất, đời xe và tài liệu nguồn.</p></div>`;
  return '';
}

function createSchematic(){return $('#schematic-template').content.cloneNode(true);}
function openArtifact(id){
  const item=artifactById(id);if(!item)return;
  state.current=item;state.zoom=1;state.pan={x:0,y:0};
  $('#viewer-title').textContent=item.title;
  $('#viewer-type').textContent=`${item.type.toUpperCase()} · ${item.format.toUpperCase()} · ${item.status}`;
  const stage=$('#stage');stage.replaceChildren();
  if(item.kind==='schematic')stage.append(createSchematic());
  else if(['connector','ground'].includes(item.kind))stage.innerHTML=`<div class="technical">${item.kind==='connector'?'<h3>Connector illustration</h3><div class="connector-grid">'+['1','2','3','4','5','6','7','8'].map(pin=>`<span class="pin">${pin}</span>`).join('')+'</div>':'<h3>Ground illustration</h3><div class="ground-mark">⏚</div>'}</div>`;
  else stage.innerHTML='<div class="technical"><h3>Metadata view</h3><p>Không có file OEM nào được render tại đây.</p></div>';
  $('#info-panel').innerHTML=technicalMarkup(item);
  const related=item.related.map(artifactById).filter(Boolean);
  $('#related-list').innerHTML=related.map(entry=>`<button data-related="${entry.id}">${icons[entry.kind]||'⌁'} ${escapeHtml(entry.title)}</button>`).join('')||'<small>Không có liên kết.</small>';
  $('#related-list').querySelectorAll('[data-related]').forEach(button=>button.addEventListener('click',()=>openArtifact(button.dataset.related)));
  updateViewer();updateSaveButton();
  if(!$('#viewer').open)$('#viewer').showModal();
}

function updateViewer(){
  $('#stage').style.transform=`translate(${state.pan.x}px,${state.pan.y}px) scale(${state.zoom})`;
  $('#zoom-label').textContent=`${Math.round(state.zoom*100)}%`;
}
function updateSaveButton(){const isSaved=getBookmarks().has(state.current?.id);$('#save-artifact').textContent=isSaved?'★ Đã lưu':'☆ Lưu';}
function toggleCurrentBookmark(){
  if(!state.current)return;const marks=getBookmarks();marks.has(state.current.id)?marks.delete(state.current.id):marks.add(state.current.id);setBookmarks(marks);updateSaveButton();renderArtifacts();
}

function pointerDistance(){const points=[...state.pointers.values()];return points.length>1?Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y):0;}
function wireStage(){
  const surface=$('.stage-wrap');
  surface.addEventListener('pointerdown',event=>{surface.setPointerCapture(event.pointerId);state.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(state.pointers.size===2)state.pinch={distance:pointerDistance(),zoom:state.zoom};});
  surface.addEventListener('pointermove',event=>{if(!state.pointers.has(event.pointerId))return;const previous=state.pointers.get(event.pointerId);state.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(state.pointers.size===2&&state.pinch){state.zoom=Math.min(3,Math.max(.65,state.pinch.zoom*(pointerDistance()/state.pinch.distance)));}else if(state.pointers.size===1){state.pan.x+=event.clientX-previous.x;state.pan.y+=event.clientY-previous.y;}updateViewer();});
  const release=event=>{state.pointers.delete(event.pointerId);if(state.pointers.size<2)state.pinch=null;};surface.addEventListener('pointerup',release);surface.addEventListener('pointercancel',release);
}

function wireUi(){
  $('#theme').addEventListener('click',()=>{document.body.classList.toggle('dark');$('#theme').textContent=document.body.classList.contains('dark')?'☼':'◐';});
  $('#bookmarks').addEventListener('click',()=>{state.onlyBookmarks=!state.onlyBookmarks;$('#bookmarks').classList.toggle('active',state.onlyBookmarks);$('#bookmarks').setAttribute('aria-pressed',String(state.onlyBookmarks));renderArtifacts();});
  $('#close-viewer').addEventListener('click',()=>$('#viewer').close());
  $('#save-artifact').addEventListener('click',toggleCurrentBookmark);
  document.querySelectorAll('[data-zoom]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.zoom;if(action==='in')state.zoom=Math.min(3,state.zoom+.2);else if(action==='out')state.zoom=Math.max(.65,state.zoom-.2);else{state.zoom=1;state.pan={x:0,y:0};}updateViewer();}));
  $('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#viewer').requestFullscreen();}catch{}});
  wireStage();
}
init().catch(error=>{$('#artifact-list').innerHTML=`<div class="empty">${escapeHtml(error.message)}</div>`;});
