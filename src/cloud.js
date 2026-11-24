import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";
import { pendingCloudRows, acknowledgeCloudRow, applyCloudRow } from "./db.js";

const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
export const cloudConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
let client;
let activeUser;
let chain = Promise.resolve();
let timer;
let report = () => {};

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
  await loadSdk();
  if (!window.supabase?.createClient) throw new Error("Supabase no está disponible");
  client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
    global:{fetch:(url,options)=>fetch(url,{...options,cache:"no-store"})}
  });
  const {data,error}=await client.auth.getSession();
  if(error) throw error;
  activeUser=data.session?.user||null;
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
  // Do not discard the authenticated session before pending changes upload.
  await synchronize(false);
  const {error}=await client.auth.signOut({scope:"local"});
  if(error) throw error;
  location.reload();
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
