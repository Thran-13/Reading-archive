'use strict';
const $=id=>document.getElementById(id), sections=['home','detail','login','editor'];
let db,books=[],session=null,isAdmin=false,current=null,editId=null,letter='全部',selectedTags=new Set(),selectedRating='all',tagCatalog=[],editingTags=new Set();
function show(id){sections.forEach(s=>$(s).classList.toggle('hidden',s!==id));window.scrollTo(0,0)}
function error(msg){$('globalError').textContent=msg||''}
function el(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=String(text);if(cls)n.className=cls;return n}
function initial(b){const c=(b.sort_title||b.title||'').trim().charAt(0).toUpperCase();return /^[A-Z]$/.test(c)?c:'#'}
function ratingStars(value){const n=value==null?null:Number(value);if(n===null||!Number.isFinite(n))return '未评分';const full=Math.floor(n),half=n-full>=0.5?1:0;return '★'.repeat(full)+(half?'½':'')+'☆'.repeat(Math.max(0,5-full-half))+'  '+n.toFixed(1)+'/5'}
function tagsOf(b){return Array.isArray(b.tags)?b.tags.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()):[]}
function tagNode(tag){return el('span','#'+tag,'tag')}
function renderTagFilters(){
 const all=[...new Set(books.flatMap(tagsOf))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
 selectedTags=new Set([...selectedTags].filter(x=>all.includes(x)));
 const root=$('tagFilters');root.replaceChildren();
 const reset=el('button','全部标签');reset.classList.toggle('active',selectedTags.size===0);
 reset.onclick=()=>{selectedTags.clear();renderTagFilters();render()};root.append(reset);
 all.forEach(tag=>{const btn=el('button','#'+tag);btn.classList.toggle('active',selectedTags.has(tag));
 btn.setAttribute('aria-pressed',String(selectedTags.has(tag)));
 btn.onclick=()=>{selectedTags.has(tag)?selectedTags.delete(tag):selectedTags.add(tag);renderTagFilters();render()};root.append(btn)});
}
function allKnownTags(){return [...new Set([...tagCatalog,...books.flatMap(tagsOf)])].sort((a,b)=>a.localeCompare(b,'zh-CN'))}
function renderTagChoices(){
 const root=$('tagChoices');root.replaceChildren();
 const all=allKnownTags();
 if(!all.length){root.append(el('span','暂无标签，请在下方创建。','muted'));return}
 all.forEach(t=>{const b=el('button','#'+t);b.type='button';b.classList.toggle('active',editingTags.has(t));b.setAttribute('aria-pressed',String(editingTags.has(t)));
 b.onclick=()=>{editingTags.has(t)?editingTags.delete(t):editingTags.add(t);renderTagChoices()};root.append(b)});
}
async function loadTagCatalog(){
 const {data,error:e}=await db.from('tag_catalog').select('name').order('name');
 if(e){error('读取标签库失败：'+e.message);return}
 tagCatalog=(data||[]).map(x=>x.name);renderTagChoices();
}
async function createTag(){
 if(!isAdmin)return;
 const input=$('newTagName'),name=input.value.trim().replace(/^#/,'');$('tagManageError').textContent='';
 if(!name){$('tagManageError').textContent='请输入标签名称';return}
 if(name.length>40||/[，,、;；\n{}"\\]/.test(name)){$('tagManageError').textContent='标签不能包含逗号、分号、换行或花括号';return}
 if(allKnownTags().includes(name)){editingTags.add(name);renderTagChoices();input.value='';return}
 const {error:e}=await db.from('tag_catalog').insert({name});
 if(e){$('tagManageError').textContent='创建失败：'+e.message;return}
 tagCatalog.push(name);editingTags.add(name);input.value='';renderTagChoices();
}
function renderRatingFilters(){
 const root=$('ratingFilters');root.replaceChildren();
 const options=[['all','全部星级'],['5','★★★★★'],['4','★★★★☆'],['3','★★★☆☆'],['2','★★☆☆☆'],['1','★☆☆☆☆'],['none','未评分']];
 options.forEach(([value,label])=>{
  const btn=el('button',label);btn.classList.toggle('active',selectedRating===value);
  btn.setAttribute('aria-pressed',String(selectedRating===value));
  btn.onclick=()=>{selectedRating=value;renderRatingFilters();render()};
  root.append(btn);
 });
}
function ratingMatches(b){
 if(selectedRating==='all')return true;
 if(selectedRating==='none')return b.rating==null||b.rating==='';
 const n=Number(b.rating);
 return b.rating!=null&&b.rating!==''&&Number.isFinite(n)&&Math.floor(n)===Number(selectedRating);
}
function render(){const q=$('search').value.trim().toLowerCase(),cat=$('category').value,st=$('status').value;const data=books.filter(b=>(letter==='全部'||initial(b)===letter)&&(!cat||b.category===cat)&&(!st||b.status===st)&&ratingMatches(b)&&(!selectedTags.size||[...selectedTags].some(t=>tagsOf(b).includes(t)))&&(!q||[b.title,b.sort_title,b.author,b.description,b.review,...tagsOf(b)].some(v=>(v||'').toLowerCase().includes(q))));$('count').textContent=`共 ${data.length} 部作品`;$('books').replaceChildren();data.forEach(b=>{const card=el('div',null,'book');card.append(el('strong',b.title),el('small',`${b.category||''} · ${b.status||''} · ${ratingStars(b.rating).replace(/\s+\d+(?:\.\d+)?\/5$/, '')}`,'muted'));if(b.author)card.append(el('small',`主角：${b.author}`,'muted'));card.querySelectorAll('small').forEach(node=>{node.style.display='block';node.style.marginTop='8px'});card.tabIndex=0;card.setAttribute('role','button');card.onclick=()=>detail(b.id);card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();detail(b.id)}};$('books').append(card)})}
function detail(id){const b=books.find(x=>x.id===id);if(!b)return;current=id;const root=$('detailContent');root.replaceChildren();root.append(el('h2',b.title));[['主角',b.author],['分类',b.category],['阅读状态',b.status],['星级',ratingStars(b.rating)],['进度',b.progress]].forEach(([k,v])=>{if(v)root.append(el('p',`${k}：${v}`))});if(tagsOf(b).length){const tags=el('div',null,'taglist');tagsOf(b).forEach(t=>tags.append(tagNode(t)));root.append(tags)}root.append(el('h3','作品简介／剧情梗概'),el('p',b.description||'暂无简介','longtext'),el('h3','我的评价'),el('p',b.review||'暂无评价','longtext'));$('detailActions').classList.toggle('hidden',!isAdmin);show('detail')}
async function load(){const {data,error:e}=await db.from('books').select('*').order('sort_title',{ascending:true});if(e){error('读取作品失败：'+e.message);return}books=data||[];renderTagFilters();renderRatingFilters();render()}
async function checkAdmin(){isAdmin=false;if(!session){adminUI();return}const {data,error:e}=await db.from('admins').select('user_id').eq('user_id',session.user.id).maybeSingle();if(e)error('检查管理员权限失败：'+e.message);isAdmin=!!data;adminUI()}
function adminUI(){$('adminBtn').textContent=isAdmin?'退出登录':'管理员登录';$('addBtn').classList.toggle('hidden',!isAdmin);$('detailActions').classList.toggle('hidden',!isAdmin)}
function edit(b){if(!isAdmin)return;editId=b?.id||null;$('editorTitle').textContent=b?'编辑作品':'添加新作品';$('bookForm').reset();['title','sort_title','author','category','description','status','rating','progress','review'].forEach(k=>{if(b&&b[k]!=null)$('bookForm').elements[k].value=b[k]});editingTags=new Set(tagsOf(b||{}));renderTagChoices();$('newTagName').value='';$('tagManageError').textContent='';setRating(b?.rating??null);$('saveError').textContent='';show('editor')}
async function init(){if(!window.SUPABASE_URL?.startsWith('https://')||!window.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')){error('请先在 config.js 中填写 Project URL 和 Publishable Key。');return}if(!window.supabase){error('Supabase JS 加载失败，请检查网络是否可以访问 jsDelivr。');return}db=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);const {data}=await db.auth.getSession();session=data.session;await checkAdmin();await load();await loadTagCatalog();db.auth.onAuthStateChange((_event,s)=>{session=s;setTimeout(()=>checkAdmin(),0)})}

function setRating(value){
 const n=value==null||value===''?null:Number(value);
 $('ratingValue').value=n==null?'':String(n);
 $('ratingText').textContent=n==null?'未评分':n.toFixed(1)+' / 5';
 Array.from($('starButtons').children).forEach((btn,i)=>{btn.classList.toggle('chosen',n!=null&&i<n);btn.setAttribute('aria-pressed',String(n!=null&&i+1===n))});
 $('clearRating').setAttribute('aria-pressed',String(n==null));
}
for(let i=1;i<=5;i++){
 const btn=el('button','★');btn.type='button';btn.title=i+'星';btn.setAttribute('aria-label',i+'星');
 btn.onclick=()=>setRating(i);$('starButtons').append(btn);
}
$('clearRating').onclick=()=>setRating(null);$('createTagBtn').onclick=createTag;
setRating(null);

const letters=['全部',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ','#'];letters.forEach(l=>{const b=el('button',l);b.onclick=()=>{letter=l;Array.from($('letters').children).forEach(x=>x.classList.toggle('active',x===b));render()};if(l==='全部')b.classList.add('active');$('letters').append(b)});
['search','category','status'].forEach(id=>$(id).addEventListener('input',render));$('back').onclick=()=>show('home');$('cancelEdit').onclick=()=>show('home');
$('addBtn').onclick=()=>edit(null);$('adminBtn').onclick=async()=>{if(isAdmin){if(confirm('确定退出管理员登录？')){await db.auth.signOut();isAdmin=false;adminUI();show('home')}}else show('login')};
$('loginForm').onsubmit=async e=>{e.preventDefault();$('loginError').textContent='';const {data,error:err}=await db.auth.signInWithPassword({email:$('email').value,password:$('password').value});if(err){$('loginError').textContent=err.message;return}session=data.session;await checkAdmin();$('password').value='';if(!isAdmin){$('loginError').textContent='该账号没有管理员权限';return}show('home');await load();await loadTagCatalog()};
$('editBtn').onclick=()=>edit(books.find(x=>x.id===current));$('deleteBtn').onclick=async()=>{if(!isAdmin||!confirm('确定永久删除这部作品？'))return;const {error:e}=await db.from('books').delete().eq('id',current);if(e){error('删除失败：'+e.message);return}await load();show('home')};
$('bookForm').onsubmit=async e=>{e.preventDefault();if(!isAdmin)return;$('saveError').textContent='';const f=new FormData(e.currentTarget),obj={};['title','sort_title','author','category','description','status','rating','progress','review'].forEach(k=>{const v=String(f.get(k)||'').trim();obj[k]=k==='rating'?(v===''?null:Number(v)):(v||null)});obj.tags=[...editingTags];
if(!obj.title||!obj.sort_title){$('saveError').textContent='请填写作品名称和排序名称';return}const result=editId?await db.from('books').update(obj).eq('id',editId):await db.from('books').insert(obj);if(result.error){$('saveError').textContent='保存失败：'+result.error.message;return}await load();show('home')};
init();
