const DB_NAME = "flshd-deutsch";
const DB_VERSION = 2;

let dbPromise;

export function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

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
  const value = { ...progress, updatedAt: new Date().toISOString() };
  const tx = db.transaction("progress", "readwrite");
  tx.objectStore("progress").put(value);
  await txDone(tx);
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
    updatedAt: new Date().toISOString()
  };

  const tx = db.transaction("images", "readwrite");
  tx.objectStore("images").put(image);
  await txDone(tx);
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
  tx.objectStore("meta").put({ key, value, updatedAt: new Date().toISOString() });
  await txDone(tx);
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
