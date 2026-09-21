let agent=null;
let currentUser=null;
let testHistory=[];
let settingsState={tone:'friendly',response_length:'balanced'};
let salesState={sales_tone:'friendly',recommendation_style:'balanced'};
let restrictions={};

const WEBSITE_PAGE_SIZE=30;
const WEBSITE_PREVIEW_CHARS=600;
let websiteLimit=WEBSITE_PAGE_SIZE;

const $=id=>document.getElementById(id);

const esc=v=>
  String(v??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

function toggle(id){
  $(id).classList.toggle('open');
}

function toast(id){
  $(id).classList.add('show');
  setTimeout(()=>$(id).classList.remove('show'),1800);
}

function setSource(name,ready,text){
  const dot=$('dot-'+name);
  const status=$('status-'+name);

  if(dot){
    dot.className='dot '+(ready?'ready':'');
  }

  if(status){
    status.textContent=text||(ready?'Available':'Not added yet');
  }
}


/* ============================================================
   NAVIGATION
============================================================ */

document.querySelectorAll('.nav button').forEach(button=>{

  button.onclick=()=>{

    document.querySelectorAll('.nav button')
      .forEach(x=>x.classList.remove('active'));

    button.classList.add('active');

    document.querySelectorAll('.panel')
      .forEach(x=>x.classList.remove('active'));

    const panel=$(button.dataset.panel);

    if(panel){
      panel.classList.add('active');
    }

    if(button.dataset.panel==='overview'){
      loadWebsiteKnowledge();
    }

    /* keep the tapped tab visible in the scrolling tab bar */
    try{
      button.scrollIntoView({inline:'center',block:'nearest'});
    }catch(error){}

    window.scrollTo(0,0);
  };

});


/* ============================================================
   BUSINESS INFORMATION
============================================================ */

async function loadBusinessInfo(){

  const {data,error}=await sb
    .from('business_information')
    .select('*')
    .eq('agent_id',agent.id)
    .maybeSingle();

  if(error){
    console.error(error);
    return;
  }

  if(!data) return;

  biName.value=data.business_name||'';
  biDescription.value=data.description||'';
  biSells.value=data.sells||'';
  biTarget.value=data.target_customers||'';
  biLocation.value=data.location||'';
  biHours.value=data.opening_hours||'';
  biContact.value=data.contact_info||'';
}

async function saveBusinessInfo(){

  const {error}=await sb
    .from('business_information')
    .upsert(
      {
        agent_id:agent.id,
        business_name:biName.value.trim()||null,
        description:biDescription.value.trim()||null,
        sells:biSells.value.trim()||null,
        target_customers:biTarget.value.trim()||null,
        location:biLocation.value.trim()||null,
        opening_hours:biHours.value.trim()||null,
        contact_info:biContact.value.trim()||null,
        updated_at:new Date().toISOString()
      },
      {onConflict:'agent_id'}
    );

  if(error){
    alert(error.message);
    return;
  }

  toast('biToast');
  refreshReadiness();
}


/* ============================================================
   PRODUCTS
============================================================ */

async function loadProducts(){

  const {data,error}=await sb
    .from('products')
    .select('*')
    .eq('agent_id',agent.id)
    .order('created_at',{ascending:false});

  if(error){
    console.error(error);
    return;
  }

  $('productsList').innerHTML=
    !data?.length
      ? '<div class="empty">No products yet.</div>'
      :
      '<div class="pgrid">'+
      data.map(p=>`
        <div class="product">

          ${p.image_url?`<img src="${esc(p.image_url)}" alt="" loading="lazy">`:''}

          <div class="productbody">

            <div class="row">
              <b>${esc(p.name)}</b>
              <button class="delete" onclick="deleteRow('products','${p.id}',loadProducts)">Delete</button>
            </div>

            <p style="color:var(--soft)">${esc(p.description||'')}</p>

            <b>${esc(p.price||'')}</b>

          </div>

        </div>
      `).join('')+
      '</div>';
}

async function saveProduct(){

  if(!pName.value.trim()){
    alert('Product name is required.');
    return;
  }

  const {error}=await sb
    .from('products')
    .insert({
      agent_id:agent.id,
      name:pName.value.trim(),
      description:pDescription.value.trim()||null,
      price:pPrice.value.trim()||null,
      category:pCategory.value.trim()||null,
      availability:pAvailability.value,
      product_url:pUrl.value.trim()||null,
      image_url:pImageUrl.value.trim()||null,
      additional_info:pExtra.value.trim()||null
    });

  if(error){
    alert(error.message);
    return;
  }

  ['pName','pDescription','pPrice','pCategory','pUrl','pImageUrl','pExtra']
    .forEach(x=>$(x).value='');

  toggle('productForm');
  loadProducts();
  refreshReadiness();
}

csvInput.onchange=async e=>{

  const f=e.target.files[0];

  if(!f) return;

  const text=await f.text();

  const lines=text.split(/\r?\n/).filter(Boolean);

  if(!lines.length){
    alert('No valid products found.');
    return;
  }

  const h=lines.shift().split(',').map(x=>x.trim().toLowerCase());

  const rows=lines
    .map(line=>{

      const c=line.split(',');

      const o={agent_id:agent.id};

      h.forEach((k,i)=>{

        if([
          'name',
          'description',
          'price',
          'category',
          'availability',
          'product_url',
          'additional_info'
        ].includes(k)){
          o[k]=c[i]?.trim()||null;
        }

      });

      if(!o.availability){
        o.availability='in_stock';
      }

      return o;

    })
    .filter(x=>x.name);

  if(!rows.length){
    alert('No valid products found.');
    return;
  }

  const {error}=await sb.from('products').insert(rows);

  if(error){

    alert(error.message);

  }else{

    loadProducts();
    refreshReadiness();

  }

};


/* ============================================================
   FAQS
============================================================ */

async function loadFaqs(){

  const {data,error}=await sb
    .from('faqs')
    .select('*')
    .eq('agent_id',agent.id)
    .order('created_at',{ascending:false});

  if(error){
    console.error(error);
    return;
  }

  $('faqsList').innerHTML=
    !data?.length
      ? '<div class="empty">No FAQs yet.</div>'
      :
      data.map(f=>`

        <div class="item">

          <div class="row">
            <b>${esc(f.question)}</b>
            <button class="delete" onclick="deleteRow('faqs','${f.id}',loadFaqs)">Delete</button>
          </div>

          <p style="color:var(--soft)">${esc(f.answer)}</p>

        </div>

      `).join('');
}

async function saveFaq(){

  if(!faqQ.value.trim()||!faqA.value.trim()){
    return;
  }

  const {error}=await sb
    .from('faqs')
    .insert({
      agent_id:agent.id,
      question:faqQ.value.trim(),
      answer:faqA.value.trim()
    });

  if(error){
    alert(error.message);
    return;
  }

  faqQ.value='';
  faqA.value='';

  toggle('faqForm');

  loadFaqs();
  refreshReadiness();
}


/* ============================================================
   POLICIES
============================================================ */

async function loadPolicies(){

  const {data,error}=await sb
    .from('policies')
    .select('*')
    .eq('agent_id',agent.id);

  if(error){
    console.error(error);
    return;
  }

  const m={};

  (data||[]).forEach(x=>m[x.policy_type]=x.content);

  polDelivery.value=m.delivery||'';
  polReturns.value=m.returns||'';
  polPayments.value=m.payments||'';
  polWarranty.value=m.warranty||'';
  polCancellation.value=m.cancellation||'';
}

async function savePolicies(){

  const rows=[
    ['delivery',polDelivery.value],
    ['returns',polReturns.value],
    ['payments',polPayments.value],
    ['warranty',polWarranty.value],
    ['cancellation',polCancellation.value]
  ]
  .map(([policy_type,content])=>({
    agent_id:agent.id,
    policy_type,
    content:content.trim()||null,
    updated_at:new Date().toISOString()
  }));

  const {error}=await sb
    .from('policies')
    .upsert(rows,{onConflict:'agent_id,policy_type'});

  if(error){
    alert(error.message);
    return;
  }

  toast('polToast');
  refreshReadiness();
}


/* ============================================================
   CUSTOM KNOWLEDGE
============================================================ */

async function loadCustomKnowledge(){

  const {data,error}=await sb
    .from('custom_knowledge')
    .select('*')
    .eq('agent_id',agent.id)
    .order('created_at',{ascending:false});

  if(error){
    console.error(error);
    return;
  }

  $('customList').innerHTML=
    !data?.length
      ? '<div class="empty">No custom knowledge yet.</div>'
      :
      data.map(x=>`

        <div class="item">

          <div class="row">
            <span>${esc(x.content)}</span>
            <button class="delete" onclick="deleteRow('custom_knowledge','${x.id}',loadCustomKnowledge)">Delete</button>
          </div>

        </div>

      `).join('');
}

async function saveCustomKnowledge(){

  if(!customContent.value.trim()){
    return;
  }

  const {error}=await sb
    .from('custom_knowledge')
    .insert({
      agent_id:agent.id,
      content:customContent.value.trim()
    });

  if(error){
    alert(error.message);
    return;
  }

  customContent.value='';

  toggle('customForm');

  loadCustomKnowledge();
  refreshReadiness();
}


/* ============================================================
   AI INSTRUCTIONS
============================================================ */

function pills(row,state,key){

  document.querySelectorAll('#'+row+' .pill').forEach(p=>{

    p.onclick=()=>{

      state[key]=p.dataset.v;

      document.querySelectorAll('#'+row+' .pill')
        .forEach(x=>x.classList.toggle('selected',x===p));

    };

  });
}

async function loadInstructions(){

  const {data,error}=await sb
    .from('ai_settings')
    .select('*')
    .eq('agent_id',agent.id)
    .maybeSingle();

  if(error){
    console.error(error);
  }

  if(data){

    settingsState.tone=data.tone||'friendly';
    settingsState.response_length=data.response_length||'balanced';
    customInstructions.value=data.custom_instructions||'';
    restrictions=data.restrictions||{};

  }

  pills('toneRow',settingsState,'tone');
  pills('lengthRow',settingsState,'response_length');

  document.querySelectorAll('#toneRow .pill')
    .forEach(x=>x.classList.toggle('selected',x.dataset.v===settingsState.tone));

  document.querySelectorAll('#lengthRow .pill')
    .forEach(x=>x.classList.toggle('selected',x.dataset.v===settingsState.response_length));

  renderRestrictions();
}

async function saveInstructions(){

  const {error}=await sb
    .from('ai_settings')
    .update({
      tone:settingsState.tone,
      response_length:settingsState.response_length,
      custom_instructions:customInstructions.value.trim()||null,
      updated_at:new Date().toISOString()
    })
    .eq('agent_id',agent.id);

  if(error){
    alert(error.message);
    return;
  }

  toast('instrToast');
  refreshReadiness();
}

function renderRestrictions(){

  const names={
    no_invent_info:'Do not invent product information',
    no_invent_prices:'Do not invent prices',
    no_false_availability:'Do not claim unavailable products are available',
    no_refund_promises:'Do not make refund promises',
    stay_within_knowledge:'Stay within the AI knowledge',
    escalate_complex:'Escalate complex questions to a human'
  };

  $('restrictionRows').innerHTML=
    Object.entries(names).map(([k,v])=>`

      <div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)">

        <b style="font-size:13px">${v}</b>

        <label class="switch">
          <input type="checkbox" id="r_${k}" ${restrictions[k]?'checked':''}>
          <span class="slider"></span>
        </label>

      </div>

    `).join('');
}

async function saveRestrictions(){

  const keys=[
    'no_invent_info',
    'no_invent_prices',
    'no_false_availability',
    'no_refund_promises',
    'stay_within_knowledge',
    'escalate_complex'
  ];

  const r={};

  keys.forEach(k=>r[k]=$('r_'+k).checked);

  const {error}=await sb
    .from('ai_settings')
    .update({
      restrictions:r,
      updated_at:new Date().toISOString()
    })
    .eq('agent_id',agent.id);

  if(error){
    alert(error.message);
  }else{
    restrictions=r;
  }
}


/* ============================================================
   SALES ASSISTANT
============================================================ */

async function loadSalesSettings(){

  const {data,error}=await sb
    .from('sales_assistant_settings')
    .select('*')
    .eq('agent_id',agent.id)
    .maybeSingle();

  if(error){
    console.error(error);
  }

  if(!data) return;

  saEnabled.checked=!!data.enabled;
  saUpsell.checked=data.allow_upsell??true;
  saCrossSell.checked=data.allow_cross_sell??true;
  saMaxProducts.value=data.max_products_shown||3;
  saInstructions.value=data.custom_sales_instructions||'';
  saRules.value=data.sales_rules||'';

  salesState.sales_tone=data.sales_tone||'friendly';
  salesState.recommendation_style=data.recommendation_style||'balanced';

  pills('saToneRow',salesState,'sales_tone');
  pills('saStyleRow',salesState,'recommendation_style');

  document.querySelectorAll('#saToneRow .pill')
    .forEach(x=>x.classList.toggle('selected',x.dataset.v===salesState.sales_tone));

  document.querySelectorAll('#saStyleRow .pill')
    .forEach(x=>x.classList.toggle('selected',x.dataset.v===salesState.recommendation_style));
}

async function saveSalesSettings(){

  const payload={
    agent_id:agent.id,
    enabled:saEnabled.checked,
    allow_upsell:saUpsell.checked,
    allow_cross_sell:saCrossSell.checked,
    max_products_shown:+saMaxProducts.value,
    sales_tone:salesState.sales_tone,
    recommendation_style:salesState.recommendation_style,
    custom_sales_instructions:saInstructions.value.trim()||null,
    sales_rules:saRules.value.trim()||null,
    updated_at:new Date().toISOString()
  };

  const {error}=await sb
    .from('sales_assistant_settings')
    .upsert(payload,{onConflict:'agent_id'});

  if(error){
    alert(error.message);
  }else{
    toast('saToast');
  }
}


/* ============================================================
   WEBSITE KNOWLEDGE  (read only - crawling happens in account.html)
   Loads the newest pages first, 30 at a time, and shows a short
   preview so the list stays fast on a phone.
============================================================ */

async function loadWebsiteKnowledge(){

  if(!agent){
    return;
  }

  const {data,error,count}=await sb
    .from('ai_knowledge')
    .select(
      'id,source_type,source_url,title,content,description,metadata,crawl_id,crawled_at,created_at,status',
      {count:'exact'}
    )
    .eq('agent_id',agent.id)
    .eq('source_type','website')
    .order('created_at',{ascending:false})
    .limit(websiteLimit);

  if(error){

    setSource('website',false,'Error');

    $('websiteKnowledgeList').innerHTML=
      '<div class="empty">Could not load website knowledge: '+esc(error.message)+'</div>';

    return;
  }

  const rows=data||[];
  const total=typeof count==='number'?count:rows.length;

  window.websiteKnowledge=rows;

  setSource(
    'website',
    total>0,
    total
      ? total+' page'+(total===1?'':'s')+' available'
      : 'Not crawled yet'
  );

  if(!rows.length){

    $('websiteKnowledgeList').innerHTML=
      '<div class="empty">No website knowledge yet. Run a website crawl from your Auvii dashboard.</div>';

    return;
  }

  $('websiteKnowledgeList').innerHTML=
    rows.map(x=>{

      const content=x.content||'';
      const long=content.length>WEBSITE_PREVIEW_CHARS;

      return `

        <div class="website-card">

          <div class="row">

            <div>
              <b>${esc(x.title||'Website page')}</b>
              <div class="website-url">${esc(x.source_url||'')}</div>
            </div>

            <span class="badge">${esc(x.status||'active')}</span>

          </div>

          <div class="website-content" id="wc-${esc(x.id)}">${esc(
            content
              ? (long?content.slice(0,WEBSITE_PREVIEW_CHARS)+'…':content)
              : 'No content stored.'
          )}</div>

          <div style="font-size:11px;color:var(--soft);margin-top:8px">

            ${content.length.toLocaleString()} characters
            ${x.crawled_at?' · '+esc(new Date(x.crawled_at).toLocaleString()):''}

          </div>

          <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">

            ${long?`<button class="btn ghost small" id="wb-${esc(x.id)}" onclick="toggleWebsiteContent('${esc(x.id)}')">Show full text</button>`:''}

            <button class="delete" onclick="deleteWebsite('${esc(x.id)}')">Delete</button>

          </div>

        </div>

      `;

    }).join('')+

    (total>rows.length
      ? `<div style="text-align:center;margin-top:12px"><button class="btn ghost small" onclick="showMoreWebsite()">Show more (${rows.length} of ${total})</button></div>`
      : '');
}

function showMoreWebsite(){
  websiteLimit+=WEBSITE_PAGE_SIZE;
  loadWebsiteKnowledge();
}

function toggleWebsiteContent(id){

  const row=(window.websiteKnowledge||[]).find(x=>String(x.id)===String(id));
  const box=$('wc-'+id);
  const button=$('wb-'+id);

  if(!row||!box) return;

  const full=box.dataset.full==='1';
  const content=row.content||'';

  box.dataset.full=full?'0':'1';

  box.textContent=full
    ? content.slice(0,WEBSITE_PREVIEW_CHARS)+'…'
    : content;

  if(button){
    button.textContent=full?'Show full text':'Show less';
  }
}

/* Deletes every crawled page whose address contains one of the words you
   type (separate several with commas, for example: example.com).
   Nothing else (products, FAQs...) is touched. */
async function deleteWebsiteByText(){

  if(!agent){
    return;
  }

  const terms=(
    prompt(
      'Delete every crawled page whose address contains one of these words.\nSeparate several with commas, for example: example.com',
      ''
    )||''
  )
    .split(',')
    .map(t=>t.replace(/[%_\\(),*]/g,'').trim())
    .filter(t=>t.length>=3);

  if(!terms.length){
    return;
  }

  const filter=terms.map(t=>'source_url.ilike.%'+t+'%').join(',');

  const {count,error:countError}=await sb
    .from('ai_knowledge')
    .select('id',{count:'exact',head:true})
    .eq('agent_id',agent.id)
    .eq('source_type','website')
    .or(filter);

  if(countError){
    alert(countError.message);
    return;
  }

  if(!count){
    alert('No crawled pages have "'+terms.join('" or "')+'" in their address.');
    return;
  }

  if(!confirm('Delete '+count+' crawled page'+(count===1?'':'s')+' whose address contains "'+terms.join('" or "')+'"?')){
    return;
  }

  const {error}=await sb
    .from('ai_knowledge')
    .delete()
    .eq('agent_id',agent.id)
    .eq('source_type','website')
    .or(filter);

  if(error){
    alert(error.message);
    return;
  }

  await loadWebsiteKnowledge();
  refreshReadiness();
}

async function deleteWebsite(id){

  if(!confirm('Delete this website knowledge?')){
    return;
  }

  const {error}=await sb
    .from('ai_knowledge')
    .delete()
    .eq('id',id);

  if(error){

    alert(error.message);

  }else{

    await loadWebsiteKnowledge();
    refreshReadiness();

  }
}


/* ============================================================
   READINESS
============================================================ */

async function refreshReadiness(){

  if(!agent){
    return;
  }

  const [
    {data:bi},
    {count:pc},
    {count:fc},
    {data:pol},
    {count:cc},
    {data:ins},
    {count:wc}
  ]=await Promise.all([

    sb.from('business_information').select('*').eq('agent_id',agent.id).maybeSingle(),

    sb.from('products').select('id',{count:'exact',head:true}).eq('agent_id',agent.id),

    sb.from('faqs').select('id',{count:'exact',head:true}).eq('agent_id',agent.id),

    sb.from('policies').select('*').eq('agent_id',agent.id),

    sb.from('custom_knowledge').select('id',{count:'exact',head:true}).eq('agent_id',agent.id),

    sb.from('ai_settings').select('custom_instructions').eq('agent_id',agent.id).maybeSingle(),

    sb.from('ai_knowledge')
      .select('id',{count:'exact',head:true})
      .eq('agent_id',agent.id)
      .eq('source_type','website')
      .eq('status','active')

  ]);

  const flags=[
    !!(bi?.description||bi?.sells),
    (pc||0)>0,
    (fc||0)>0,
    (pol||[]).some(x=>x.content),
    (cc||0)>0,
    !!ins?.custom_instructions,
    (wc||0)>0
  ];

  const pct=Math.round(flags.filter(Boolean).length/flags.length*100);

  readinessPct.textContent=pct+'%';
  readinessFill.style.width=pct+'%';

  setSource('business',flags[0]);

  setSource('products',flags[1],(pc||0)+' product'+((pc||0)===1?'':'s'));

  setSource('faqs',flags[2],(fc||0)+' FAQ'+((fc||0)===1?'':'s'));

  setSource('policies',flags[3]);

  setSource('custom',flags[4],(cc||0)+' entr'+((cc||0)===1?'y':'ies'));

  setSource('instructions',flags[5]);

  setSource(
    'website',
    flags[6],
    flags[6]
      ? (wc||0)+' page'+((wc||0)===1?'':'s')+' available'
      : 'Not crawled yet'
  );

  readinessNote.textContent=
    flags.every(Boolean)
      ? 'Your knowledge base has content in every section.'
      : 'Add more information to improve knowledge completeness.';
}


/* ============================================================
   TEST YOUR AI  (Edge Function: chat_ai)
============================================================ */

async function callAI(q){

  if(!agent||!agent.id){
    throw new Error('AI agent is not loaded.');
  }

  if(!SUPABASE_URL){
    throw new Error('Supabase URL is missing.');
  }

  if(!SUPABASE_ANON_KEY){
    throw new Error('Supabase anon key is missing.');
  }

  const payload={
    agent_id:agent.id,
    message:q,
    history:testHistory
  };

  let response;

  try{

    response=await fetch(
      `${SUPABASE_URL}/functions/v1/chat_ai`,
      {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':`Bearer ${SUPABASE_ANON_KEY}`,
          'apikey':SUPABASE_ANON_KEY
        },
        body:JSON.stringify(payload)
      }
    );

  }catch(networkError){

    console.error('Auvii Test AI network error:',networkError);

    throw new Error('Could not connect to the AI service. Check your internet connection.');
  }

  const raw=await response.text();

  let data={};

  try{

    data=raw?JSON.parse(raw):{};

  }catch(parseError){

    console.error('Auvii Test AI JSON parse error:',parseError);

    throw new Error(`AI returned an invalid response (${response.status}).`);
  }

  if(!response.ok){

    throw new Error(
      data.error||
      data.details||
      data.message||
      `AI request failed (${response.status})`
    );
  }

  if(data.error){
    throw new Error(data.error);
  }

  const reply=data.reply||data.answer||data.message;

  if(!reply){
    throw new Error('The AI returned an empty response.');
  }

  return reply;
}


function addBubble(text,type){

  const container=$('messages');

  if(!container){
    return;
  }

  const bubble=document.createElement('div');

  bubble.className='bubble '+type;
  bubble.textContent=String(text||'');

  container.appendChild(bubble);

  container.scrollTop=container.scrollHeight;
}


function showTestError(message){

  const box=$('testError');

  if(!box){
    return;
  }

  box.textContent=message||'Unknown error';
  box.style.display='block';
}


function hideTestError(){

  const box=$('testError');

  if(!box){
    return;
  }

  box.textContent='';
  box.style.display='none';
}


function clearChat(){

  const container=$('messages');

  if(container){
    container.innerHTML='';
  }

  testHistory=[];

  hideTestError();

  if(agent){

    addBubble(`Hi! I'm ${agent.agent_name}. Ask me anything about the store.`,'bot');

  }else{

    addBubble('Hi! Ask me anything about the store.','bot');

  }
}


async function askTest(){

  const input=$('testInput');

  if(!input){
    return;
  }

  const q=input.value.trim();

  if(!q){
    return;
  }

  const button=$('testSendButton');

  hideTestError();

  input.value='';

  addBubble(q,'user');

  testHistory.push({role:'user',content:q});

  if(button){
    button.disabled=true;
    button.textContent='Thinking…';
  }

  try{

    const reply=await callAI(q);

    addBubble(reply,'bot');

    testHistory.push({role:'assistant',content:reply});

  }catch(error){

    console.error('Auvii Test AI failed:',error);

    const message=error?.message||'Unknown AI error.';

    addBubble('Could not reach the AI: '+message,'bot');

    showTestError(message);

    /* remove the failed user message so a temporary failure
       does not pollute the next request */
    if(
      testHistory.length&&
      testHistory[testHistory.length-1]?.role==='user'
    ){
      testHistory.pop();
    }

  }finally{

    if(button){
      button.disabled=false;
      button.textContent='Send';
    }

    input.focus();
  }
}


/* ============================================================
   DELETE ROW
============================================================ */

async function deleteRow(table,id,reload){

  if(!confirm('Delete this item?')){
    return;
  }

  const {error}=await sb
    .from(table)
    .delete()
    .eq('id',id);

  if(error){

    alert(error.message);

    return;
  }

  await reload();
  refreshReadiness();
}


/* ============================================================
   INITIALISE TRAINING CENTER
============================================================ */

async function initialiseTraining(){

  try{

    const {data:{session},error:sessionError}=await sb.auth.getSession();

    if(sessionError){
      throw sessionError;
    }

    if(!session){

      location.href='auth.html';

      return;
    }

    currentUser=session.user;

    const {data:agents,error}=await sb
      .from('ai_agents')
      .select('*')
      .eq('user_id',session.user.id)
      .order('created_at',{ascending:false})
      .limit(1);

    if(error){
      throw error;
    }

    agent=agents&&agents.length?agents[0]:null;

    if(!agent){

      document.querySelector('main').innerHTML=`

        <section class="panel active">

          <div class="card" style="text-align:center;padding:35px 20px">

            <h2>Create your AI first</h2>

            <p class="sub">Create your Auvii AI agent before adding training data.</p>

            <a class="btn primary" href="create-agent.html">Create AI Agent</a>

          </div>

        </section>

      `;

      return;
    }

    await Promise.allSettled([
      loadBusinessInfo(),
      loadProducts(),
      loadFaqs(),
      loadPolicies(),
      loadCustomKnowledge(),
      loadInstructions(),
      loadSalesSettings(),
      loadWebsiteKnowledge(),
      refreshReadiness()
    ]);

    clearChat();

  }catch(error){

    console.error('Training Center initialization failed:',error);

    alert('Could not load your Training Center. Please refresh and try again.');

  }

}


/* ============================================================
   START
============================================================ */

document.addEventListener('DOMContentLoaded',initialiseTraining);

window.__trainingReady=true;
