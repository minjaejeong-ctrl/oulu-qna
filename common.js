// 공통 유틸 (크리에이터/관리자)
window.sb = supabase.createClient(window.SB_URL, window.SB_KEY);
const BUCKET = 'qna-images';
const MAX_IMG = 3;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); clearTimeout(t._x); t._x=setTimeout(()=>t.classList.remove('show'),2000); }
function confirmBox(title, desc, cb){ $('#cfTitle').textContent=title; $('#cfDesc').textContent=desc; $('#cfOv').classList.remove('hidden'); $('#cfYes').onclick=()=>{ $('#cfOv').classList.add('hidden'); cb(); }; }
document.addEventListener('DOMContentLoaded', ()=>{
  const no=$('#cfNo'); if(no) no.onclick=()=>$('#cfOv').classList.add('hidden');
  const lb=$('#lb'); if(lb) lb.onclick=()=>lb.classList.add('hidden');
});
document.addEventListener('click', e=>{ const im=e.target.closest('img[data-full]'); if(im){ e.stopPropagation(); e.preventDefault(); $('#lbImg').src=im.src; $('#lb').classList.remove('hidden'); } }, true);

const imgsHtml = arr => (arr && arr.length) ? `<div class="imgs">${arr.map(u=>`<img src="${esc(u)}" data-full alt="" loading="lazy">`).join('')}</div>` : '';

// 업로드 전 이미지 축소 (최대 1600px, JPEG). 실패 시 원본 사용
async function shrink(file){
  try{
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600/Math.max(bmp.width, bmp.height));
    if(scale===1 && file.size < 1.5*1024*1024 && /jpe?g|png|webp/.test(file.type)) return file;
    const c=document.createElement('canvas'); c.width=Math.round(bmp.width*scale); c.height=Math.round(bmp.height*scale);
    c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    const blob = await new Promise(r=>c.toBlob(r,'image/jpeg',0.85));
    return blob ? new File([blob], 'img.jpg', {type:'image/jpeg'}) : file;
  }catch(e){ return file; }
}
async function uploadImage(file, folder){
  const f = await shrink(file);
  const ext = (f.type.split('/')[1]||'jpg').replace('jpeg','jpg').replace(/[^a-z0-9]/g,'');
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type, upsert:false });
  if(error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// 이미지 선택 UI. items: [{url} | {file, preview}]
function makeUploader(el, items, onChange, max=MAX_IMG){
  const input = document.createElement('input'); input.type='file'; input.accept='image/*'; input.multiple=max>1; input.className='hidden';
  document.body.appendChild(input);
  function render(){
    el.innerHTML = items.map((it,i)=>`<div class="up-item"><img src="${esc(it.url||it.preview)}" data-full alt=""><button type="button" class="x" data-rm="${i}">×</button></div>`).join('')
      + (items.length<max ? `<button type="button" class="up-add" data-add><b>+</b>${items.length}/${max}</button>` : '');
  }
  el.onclick = e => {
    const rm=e.target.closest('[data-rm]'); if(rm){ items.splice(+rm.dataset.rm,1); render(); onChange&&onChange(); return; }
    if(e.target.closest('[data-add]')){ input.value=''; input.click(); }
  };
  input.onchange = () => {
    let files=[...input.files].filter(f=>f.type.startsWith('image/')||/\.(heic|heif)$/i.test(f.name));
    if(files.some(f=>f.size>10*1024*1024)){ toast('10MB 이하 이미지만 첨부할 수 있어요'); files=files.filter(f=>f.size<=10*1024*1024); }
    const room=max-items.length; if(files.length>room) toast(`이미지는 최대 ${max}장까지 첨부할 수 있어요`);
    files.slice(0,room).forEach(f=>items.push({file:f, preview:URL.createObjectURL(f)}));
    render(); onChange&&onChange();
  };
  render();
  return { render, set(arr){ items.length=0; arr.forEach(x=>items.push(x)); render(); } };
}
// items → URL 배열 (새 파일은 업로드)
async function resolveItems(items, folder){
  const out=[];
  for(const it of items){ out.push(it.url ? it.url : await uploadImage(it.file, folder)); }
  return out;
}
// 분류 (중복 선택)
function catsOfQ(q, cats, common){ const l=(q.category_ids||[]).map(id=>cats.find(c=>c.id===id)).filter(Boolean); return l.length?l:(common?[common]:[]); }
const catBadgeHtml = c => `<span class="badge ${c.is_common?'b-common':'b-cat'}">${esc(c.name)}</span>`;
