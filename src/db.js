const DB_NAME = "flshd-deutsch";
const DB_VERSION = 2;

let dbPromise;
let accountId = null;
let notifyChange = () => {};

// Account is selected before opening IndexedDB and never switched in-place.
export function configureLocalAccount(id, onChange = () => {}) {
  if (dbPromise) throw new Error("Local database already opened");
  accountId = id || null;
  notifyChange = onChange;
}

export function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(accountId ? DB_NAME + "-" + accountId : DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("words")) {
        const words = db.createObjectStore("words", { keyPath: "id" });
        words.createIndex("themeId", "themeId", { unique: false });
      }

      if (!db.objectStoreNames.contains("images")) {
        const images = db.createObjectStore("images", { keyPath: "id" });
        images.createIndex("wordId", "wordId", { unique: true });
      }

      if (!db.objectStoreNames.contains("progress")) {
        const progress = db.createObjectStore("progress", { keyPath: "wordId" });
        progress.createIndex("nextReviewAt", "nextReviewAt", { unique: false });
      }

      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function seedWords(words) {
  const db = await openDatabase();
  const tx = db.transaction("words", "readwrite");
  const store = tx.objectStore("words");

  for (const word of words) {
    store.put(word);
  }

  await txDone(tx);
}

export function defaultProgress(wordId) {
  return {
    wordId,
    known: false,
    mastered: false,

    // Clean learning sequence: flashcard -> choice -> typing.
    learningStep: 0,
    bestLearningStep: 0,

    flashcardSeenCount: 0,
    correctCount: 0,
    totalErrorCount: 0,
    errorDates: [],

    learnedAt: null,
    lastSeenAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastReviewAt: null,
    nextReviewAt: null,
    reviewStep: 0,

    updatedAt: new Date().toISOString()
  };
}

export async function getAllProgress() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("progress", "readonly").objectStore("progress").getAll();
    request.onsuccess = () => {
      const map = new Map();
      for (const row of request.result || []) map.set(row.wordId, row);
      resolve(map);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getProgress(wordId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("progress", "readonly").objectStore("progress").get(wordId);
    request.onsuccess = () => resolve(request.result || defaultProgress(wordId));
    request.onerror = () => reject(request.error);
  });
}

export async function saveProgress(progress) {
  const db = await openDatabase();
  const value = { ...progress, updatedAt: new Date().toISOString(), _pending: Boolean(accountId) };
  const tx = db.transaction("progress", "readwrite");
  tx.objectStore("progress").put(value);
  await txDone(tx);
  if (accountId) notifyChange();
  return value;
}

export async function getAllImages() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("images", "readonly").objectStore("images").getAll();
    request.onsuccess = () => {
      const map = new Map();
      for (const row of request.result || []) map.set(row.wordId, row);
      resolve(map);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getImageForWord(wordId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("images", "readonly").objectStore("images").index("wordId").get(wordId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveWordImage(wordId, dataUrl) {
  const db = await openDatabase();
  const image = {
    id: `img-${wordId}`,
    wordId,
    dataUrl,
    _pending: Boolean(accountId),
    updatedAt: new Date().toISOString()
  };

  const tx = db.transaction("images", "readwrite");
  tx.objectStore("images").put(image);
  await txDone(tx);
  if (accountId) notifyChange();
  return image;
}

export async function removeWordImage(wordId) {
  const db = await openDatabase();
  const existing = await getImageForWord(wordId);
  if (!existing) return;

  const tx = db.transaction("images", "readwrite");
  tx.objectStore("images").delete(existing.id);
  await txDone(tx);
}


export async function getMeta(key, fallback = null) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("meta", "readonly").objectStore("meta").get(key);
    request.onsuccess = () => resolve(request.result?.value ?? fallback);
    request.onerror = () => reject(request.error);
  });
}

export async function setMeta(key, value) {
  const db = await openDatabase();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").put({ key, value, updatedAt: new Date().toISOString(), _pending: Boolean(accountId && key === "checkpoints-v3") });
  await txDone(tx);
  if (accountId && key === "checkpoints-v3") notifyChange();
  return value;
}

export async function exportUserData() {
  const [progress, images] = await Promise.all([
    getAllProgress(),
    getAllImages()
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    progress: [...progress.values()],
    images: [...images.values()]
  };
}

const storeForKind = { progress: "progress", image: "images", checkpoints: "meta" };
const keyForKind = (kind, id) => kind === "image" ? "img-" + id : id;
const requestResult = req => new Promise((resolve,reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
async function rowsFrom(db, store) {
  return requestResult(db.transaction(store, "readonly").objectStore(store).getAll());
}
function asCloud(kind, row) {
  const { _pending, ...payload } = row;
  return {
    kind,
    record_id: kind === "checkpoints" ? row.key : row.wordId,
    payload: kind === "checkpoints" ? Object.fromEntries(Object.entries(row.value || {}).filter(([,v])=>v===true)) : payload,
    changed_at: row.updatedAt || "1970-01-01T00:00:00.000Z"
  };
}
export async function pendingCloudRows() {
  const db = await openDatabase();
  const [p,i,m] = await Promise.all(["progress","images","meta"].map(s=>rowsFrom(db,s)));
  return [
    ...p.filter(r=>r._pending).map(r=>asCloud("progress",r)),
    ...i.filter(r=>r._pending).map(r=>asCloud("image",r)),
    ...m.filter(r=>r._pending && r.key==="checkpoints-v3").map(r=>asCloud("checkpoints",r))
  ];
}
export async function acknowledgeCloudRow(row) {
  const db = await openDatabase(), tx = db.transaction(storeForKind[row.kind],"readwrite");
  const done = txDone(tx), store = tx.objectStore(storeForKind[row.kind]);
  const current = await requestResult(store.get(keyForKind(row.kind,row.record_id)));
  if(current && Date.parse(current.updatedAt) === Date.parse(row.changed_at)) store.put({...current,_pending:false});
  await done;
}
export async function applyCloudRow(row) {
  if (!storeForKind[row.kind]) return;
  const db = await openDatabase(), name=storeForKind[row.kind], tx=db.transaction(name,"readwrite");
  const done=txDone(tx),store=tx.objectStore(name), key=keyForKind(row.kind,row.record_id);
  const current=await requestResult(store.get(key));
  if (row.kind === "checkpoints") {
    if(row.record_id==="checkpoints-v3") {
      const value={...(current?.value||{}),...row.payload};
      store.put({key,value,updatedAt: new Date(Math.max(Date.parse(current?.updatedAt||0)||0,Date.parse(row.changed_at))).toISOString(),_pending:Boolean(current?._pending)});
    }
  } else if (!current || (!current._pending && Date.parse(row.changed_at)>=Date.parse(current.updatedAt||0))) {
    const payload={...row.payload,wordId:row.record_id,updatedAt:row.changed_at,_pending:false};
    if (row.kind === "image") {
      if(typeof payload.dataUrl==="string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(payload.dataUrl)) store.put({...payload,id:key});
    } else store.put(payload);
  }
  await done;
}
export async function importGuestData(validIds) {
  if(!accountId) throw new Error("Inicia sesión primero");
  const guest=await new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{req.transaction.abort();};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(new Error("No hay datos locales previos disponibles"));
  });
  try {
    const target=await openDatabase();
    let count=0;
    for(const [kind,name] of [["progress","progress"],["image","images"],["checkpoints","meta"]]){
      const rows=await rowsFrom(guest,name);
      for(const row of rows){
        if(kind==="checkpoints" ? row.key!=="checkpoints-v3" : !validIds.has(row.wordId)) continue;
        const tx=target.transaction(name,"readwrite"),done=txDone(tx),store=tx.objectStore(name);
        const key=kind==="progress"?row.wordId:kind==="image"?row.id:row.key;
        const current=await requestResult(store.get(key));
        if(kind==="checkpoints"){
          const value={...(current?.value||{}),...Object.fromEntries(Object.entries(row.value||{}).filter(([,v])=>v===true))};
          store.put({key,value,updatedAt:new Date().toISOString(),_pending:true});count++;
        } else if(!current){
          store.put({...row,updatedAt:row.updatedAt||new Date().toISOString(),_pending:true});count++;
        }
        await done;
      }
    }
    notifyChange();
    return count;
  } finally {guest.close();}
}
