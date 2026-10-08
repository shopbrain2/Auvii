/* Auvii plan settings - shared by account.html (router), basic.html, standard.html and premium.html.
   Change a limit or flip the launch switch HERE and every page follows. */

/* MASTER SWITCH. false = everything is open to everyone, no trial countdown, no locks, no payments.
   Set to true only when plans, payments and tier limits are ready to launch. */
const AUVII_BILLING_LIVE = false;

/* Trials went live on 4 Oct 2026. Accounts older than that get a full 7 days from launch day. */
const AUVII_TRIAL_LAUNCH_MS = Date.parse('2026-10-04T00:00:00Z');

/* Which dashboard page each plan opens. The Free Trial uses the Premium dashboard. */
const AUVII_PAGE_FOR = { free:'premium', basic:'basic', standard:'standard', premium:'premium', expired:'basic' };

/* What each plan's dashboard includes */
const AUVII_ENT = {
  free:     { name:'Free Trial', crawls:1,  pages:25,  per:'trial', analytics:'Advanced', sales:true,  advSales:true,  widget:{size:true,  custom:true,  effects:true},  fullCustom:true  },
  basic:    { name:'Basic',      crawls:1,  pages:25,  per:'month', analytics:'Basic',    sales:false, advSales:false, widget:{size:false, custom:false, effects:false}, fullCustom:false },
  standard: { name:'Standard',   crawls:5,  pages:50,  per:'month', analytics:'Standard', sales:true,  advSales:false, widget:{size:true,  custom:true,  effects:true},  fullCustom:false },
  premium:  { name:'Premium',    crawls:10, pages:100, per:'month', analytics:'Advanced', sales:true,  advSales:true,  widget:{size:true,  custom:true,  effects:true},  fullCustom:true  }
};

/* While building (billing off) you can look at any plan from the "Build mode" bar. */
function auviiPreviewPlan(){
  try{
    var v = localStorage.getItem('auviiPreviewPlan');
    return ['free','basic','standard','premium'].indexOf(v) !== -1 ? v : 'free';
  }catch(e){ return 'free'; }
}

/* Plan of a signed-in user, from their subscription row (used by the router before a dashboard loads). */
function auviiPlanKeyFromRow(sub, userCreatedAt){
  if(!AUVII_BILLING_LIVE) return auviiPreviewPlan();
  var key = String((sub && sub.plan_key) || 'free').toLowerCase();
  if(sub && ['basic','standard','premium'].indexOf(key) !== -1){
    var end = sub.current_period_end ? new Date(sub.current_period_end).getTime() : 0;
    if(end && end > Date.now()) return key;
    if(!end && sub.status === 'active') return key;
    return 'expired';
  }
  var base = (sub && key === 'free' && sub.trial_ends_at) ? new Date(sub.trial_ends_at).getTime()
           : (userCreatedAt ? new Date(userCreatedAt).getTime() + 7*86400000 : 0);
  if(!base) return 'free';
  base = Math.max(base, AUVII_TRIAL_LAUNCH_MS + 7*86400000);
  return base > Date.now() ? 'free' : 'expired';
}
