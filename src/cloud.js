import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";
import { pendingCloudRows, acknowledgeCloudRow, applyCloudRow } from "./db.js";

const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
export const cloudConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
let client;
let activeUser;
let chain = Promise.resolve();
let timer;
let report = () => {};
const AUTH_STORAGE_KEY = "flshd-private-session-v1";

// Never revive the old persistent login. Only remove this project's auth
// credentials; the user's learning data and unsynced photos remain intact.
function preparePrivateSession() {
  const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
  const oldKey = "sb-" + projectRef + "-auth-token";
  try {
    localStorage.removeItem(oldKey);
    localStorage.removeItem(oldKey + "-code-verifier");
  } catch {}
  const url = new URL(location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const sensitive = ["access_token","refresh_token","provider_token","provider_refresh_token","token_hash","code","error","error_code","error_description"];
  let modified = false;
  if (sensitive.some(key=>fragment.has(key))) {
    url.hash = "";
    modified = true;
  }
  for(const key of sensitive){
    if(url.searchParams.has(key)){url.searchParams.delete(key);modified=true;}
  }
  if(modified) history.replaceState(history.state,"",url.pathname+url.search+url.hash);
}

function clearPrivateSession() {
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY+"-code-verifier");
  } catch {}
}


function loadSdk() {
  if (window.supabase?.createClient) return Promise.resolve();
  return new Promise((resolve,reject) => {
    const script=document.createElement("script");
    const timeout=setTimeout(()=>{script.remove();reject(new Error("No se pudo cargar Supabase"));},12000);
    script.src=SDK_URL;
    script.onload=()=>{clearTimeout(timeout);resolve();};
    script.onerror=()=>{clearTimeout(timeout);reject(new Error("No se pudo cargar Supabase"));};
    document.head.appendChild(script);
  });
}

export async function initializeCloud(onStatus) {
  report=onStatus;
  if (!cloudConfigured) return null;
  preparePrivateSession();
  await loadSdk();
  if (!window.supabase?.createClient) throw new Error("Supabase no está disponible");
  client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
    auth:{persistSession:true,storage:window.sessionStorage,storageKey:AUTH_STORAGE_KEY,autoRefreshToken:true,detectSessionInUrl:false},
    global:{fetch:(url,options)=>fetch(url,{...options,cache:"no-store"})}
  });
  const {data,error}=await client.auth.getSession();
  if(error) throw error;
  activeUser=null;
  if(data.session) {
    // The local session object alone is not proof of identity.
    // Only open the account's private IndexedDB after server verification.
    const verified=await client.auth.getUser();
    if(verified.error || !verified.data?.user || verified.data.user.id!==data.session.user?.id) {
      clearPrivateSession();
      try { await client.auth.signOut({scope:"local"}); } catch {}
      throw new Error("No se pudo verificar tu sesión. Inicia sesión de nuevo.");
    }
    activeUser=verified.data.user;
  }
  client.auth.onAuthStateChange((event,session)=>{
    if(event==="INITIAL_SESSION") return;
    const id=session?.user?.id||null;
    if(id!==(activeUser?.id||null)) {
      // Reload before using a different account's IndexedDB namespace.
      setTimeout(()=>location.reload(),0);
    }
  });
  return activeUser;
}
export const cloudReady = () => Boolean(client);
export async function signIn(email,password) {
  if(!client) throw new Error("Supabase no está disponible");
  const {error}=await client.auth.signInWithPassword({email,password});
  if(error) throw error;
  location.reload();
}
export async function signUp(email,password) {
  if(!client) throw new Error("Supabase no está disponible");
  const redirect=new URL("./",location.href);
  const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:redirect.href}});
  if(error) throw error;
  if(data.session) location.reload();
  return Boolean(data.session);
}
export async function signOut() {
  if(!client) return;
  // Try to save changes, but never trap a user in a session on a shared device.
  clearTimeout(timer);
  try { await synchronize(false); }
  catch {
    if(!window.confirm("Hay cambios pendientes de sincronizar. Se conservarán en este navegador para tu próximo inicio de sesión. ¿Cerrar sesión igualmente?")) return;
  }
  activeUser=null;
  try { await client.auth.signOut({scope:"local"}); }
  finally { clearPrivateSession(); location.reload(); }
}
async function push() {
  const pending=await pendingCloudRows();
  for(const row of pending){
    const {error}=await client.rpc("flshd_put_record",{
      p_user_id:activeUser.id,p_kind:row.kind,p_record_id:row.record_id,p_payload:row.payload,p_changed_at:row.changed_at
    });
    if(error) throw error;
    await acknowledgeCloudRow(row);
  }
}
async function pull() {
  // Bounded pages prevent the default API row cap and large image responses.
  for(let offset=0;;offset+=30){
    const {data,error}=await client.from("flshd_records")
      .select("kind,record_id,payload,changed_at")
      .eq("user_id",activeUser.id).order("kind").order("record_id").range(offset,offset+29);
    if(error) throw error;
    for(const row of data||[]) await applyCloudRow(row);
    if((data||[]).length<30) break;
  }
}
export function synchronize(download=true) {
  if(!client || !activeUser) return Promise.resolve();
  const run=async()=>{
    report("syncing");
    try{
      await push();
      if(download) await pull();
      report("synced");
    }catch(error){
      report("pending",error);
      throw error;
    }
  };
  const result=chain.catch(()=>{}).then(run);
  chain=result;
  return result;
}
export function queueCloudSync() {
  if(!activeUser) return;
  report("pending");
  clearTimeout(timer);
  timer=setTimeout(()=>synchronize(false).catch(()=>{}),700);
}
window.addEventListener("online",()=>synchronize(false).catch(()=>{}));
