import { BLOCK_01A_RAW } from "./vocab/block-01a.js";
import { BLOCK_01B_RAW } from "./vocab/block-01b.js";
import { BLOCK_02_RAW } from "./vocab/block-02.js";
import { BLOCK_03_RAW } from "./vocab/block-03.js";
import { BLOCK_04_RAW } from "./vocab/block-04.js";
import { BLOCK_05_RAW } from "./vocab/block-05.js";
import { BLOCK_06_RAW } from "./vocab/block-06.js";
import { BLOCK_07A_RAW } from "./vocab/block-07a.js";
import { BLOCK_07B_RAW } from "./vocab/block-07b.js";
import { BLOCK_08A_RAW } from "./vocab/block-08a.js";
import { BLOCK_08B_RAW } from "./vocab/block-08b.js";

const tone = ["#eef8dc","#edf5ff","#fff1e9","#f8edff","#e9f8f4","#fff6db"];

const specs = [
  ["Saludos, cortesía y expresiones","👋",15],
  ["Identidad y datos personales","🪪",22],
  ["Personas, familia y relaciones · Parte 1","👨‍👩‍👧",22],
  ["Personas, familia y relaciones · Parte 2","👨‍👩‍👧",22],
  ["Casa y vivienda · Parte 1","🏠",17],
  ["Casa y vivienda · Parte 2","🏠",17],
  ["Casa y vivienda · Parte 3","🏠",16],
  ["Comida, bebida y restaurante · Parte 1","🍽️",19],
  ["Comida, bebida y restaurante · Parte 2","🍽️",19],
  ["Comida, bebida y restaurante · Parte 3","🍽️",18],
  ["Compras, ropa y dinero","🛍️",14],
  ["Números, cantidades y medidas · Parte 1","🔢",17],
  ["Números, cantidades y medidas · Parte 2","🔢",17],
  ["Números, cantidades y medidas · Parte 3","🔢",16],
  ["Tiempo, fechas y calendario · Parte 1","📅",16],
  ["Tiempo, fechas y calendario · Parte 2","📅",15],
  ["Tiempo, fechas y calendario · Parte 3","📅",15],
  ["Direcciones y orientación","🧭",4],
  ["Transporte y movilidad · Parte 1","🚆",19],
  ["Transporte y movilidad · Parte 2","🚆",18],
  ["Viajes y alojamiento","🧳",17],
  ["Servicios, correo, banco y trámites · Parte 1","🏛️",10],
  ["Servicios, correo, banco y trámites · Parte 2","🏛️",9],
  ["Tecnología y comunicación","📱",7],
  ["Estudio, idioma y examen · Parte 1","📚",17],
  ["Estudio, idioma y examen · Parte 2","📚",17],
  ["Estudio, idioma y examen · Parte 3","📚",17],
  ["Trabajo y profesión","💼",15],
  ["Cuerpo y salud","🩺",14],
  ["Comunicación y vida social · Parte 1","💬",13],
  ["Comunicación y vida social · Parte 2","💬",13],
  ["Ocio, cultura y deporte · Parte 1","⚽",13],
  ["Ocio, cultura y deporte · Parte 2","⚽",12],
  ["Naturaleza, entorno y clima","🌦️",11],
  ["Descripciones, estados y adverbios · Parte 1","🎨",22],
  ["Descripciones, estados y adverbios · Parte 2","🎨",22],
  ["Descripciones, estados y adverbios · Parte 3","🎨",22],
  ["Descripciones, estados y adverbios · Parte 4","🎨",22],
  ["Descripciones, estados y adverbios · Parte 5","🎨",21],
  ["Verbos y acciones esenciales · Parte 1","🏃",21],
  ["Verbos y acciones esenciales · Parte 2","🏃",20],
  ["Verbos y acciones esenciales · Parte 3","🏃",20],
  ["Pronombres, conectores y preposiciones · Parte 1","🧩",20],
  ["Pronombres, conectores y preposiciones · Parte 2","🧩",20],
  ["Pronombres, conectores y preposiciones · Parte 3","🧩",19],
  ["Pronombres, conectores y preposiciones · Parte 4","🧩",19],
  ["Objetos y nombres generales · Parte 1","📦",15],
  ["Objetos y nombres generales · Parte 2","📦",14]
];

export const THEMES = specs.map(([name,icon,count], index) => ({
  id: `act-${String(index + 1).padStart(2,"0")}`,
  name,
  base: name.replace(/ · Parte \d+$/,""),
  icon,
  tone: tone[index % tone.length],
  description: `${count} tarjetas de ${name.replace(/ · Parte \d+$/,"").toLocaleLowerCase("es")}.`
}));

function parseBlock(raw) {
  return raw.trim().split("\n").filter(Boolean).map(line => {
    const [id, themeId, german, spanish, article, plural, example, icon] = line.split("|");
    return {
      id,
      themeId,
      german,
      spanish,
      article: article || null,
      plural: plural || null,
      example: example || null,
      icon: icon || "📝"
    };
  });
}

const raws = [
  BLOCK_01A_RAW,BLOCK_01B_RAW,BLOCK_02_RAW,BLOCK_03_RAW,BLOCK_04_RAW,
  BLOCK_05_RAW,BLOCK_06_RAW,BLOCK_07A_RAW,BLOCK_07B_RAW,BLOCK_08A_RAW,BLOCK_08B_RAW
];

const parsedWords = raws.flatMap(parseBlock);

function distributeEvenly(words, sourceThemeIds, targetThemeIds) {
  const source = new Set(sourceThemeIds);
  const pool = words.filter(word => source.has(word.themeId));
  const base = Math.floor(pool.length / targetThemeIds.length);
  const remainder = pool.length % targetThemeIds.length;
  let position = 0;

  targetThemeIds.forEach((themeId, index) => {
    const size = base + (index < remainder ? 1 : 0);
    for (let i = 0; i < size; i += 1) {
      pool[position++].themeId = themeId;
    }
  });
}

function buildBalancedCurriculum(input) {
  const words = input.map(word => ({ ...word }));

  const groups = [
    [["act-05","act-06","act-07"],["act-05","act-06","act-07"]],
    [["act-08","act-09","act-10"],["act-08","act-09","act-10"]],
    [["act-12","act-13","act-14"],["act-12","act-13","act-14"]],
    [["act-15","act-16","act-17"],["act-15","act-16","act-17"]],
    [["act-19","act-20"],["act-19","act-20"]],
    [["act-25","act-26","act-27"],["act-25","act-26","act-27"]],
    [["act-30","act-31"],["act-30","act-31"]],
    [["act-32","act-33"],["act-32","act-33"]],
    [["act-40","act-41","act-42"],["act-40","act-41","act-42"]],
    [["act-43","act-44","act-45","act-46"],["act-43","act-44","act-45","act-46"]],
    [["act-47","act-48"],["act-47","act-48"]]
  ];
  groups.forEach(([source,target]) => distributeEvenly(words, source, target));

  // The original source groups telephone/digital terms under services.
  // For learning, keep them together in the dedicated technology activity.
  const serviceIds = new Set(["act-22","act-23","act-24"]);
  const servicePool = words.filter(word => serviceIds.has(word.themeId));
  const techTerms = new Set(["Anruf","Anrufbeantworter","E-Mail","Fax","Internet","Telefon","Handy"]);
  const technology = servicePool.filter(word => techTerms.has(word.german));
  const services = servicePool.filter(word => !techTerms.has(word.german));

  technology.forEach(word => { word.themeId = "act-24"; });
  services.forEach((word,index) => {
    word.themeId = index < Math.ceil(services.length / 2) ? "act-22" : "act-23";
  });

  return words;
}

export const WORDS = buildBalancedCurriculum(parsedWords);

export const byTheme = themeId => WORDS.filter(word => word.themeId === themeId);
export const wordById = id => WORDS.find(word => word.id === id);
export const themeById = id => THEMES.find(theme => theme.id === id);
