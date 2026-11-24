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
  ["Casa y vivienda · Parte 1","🏠",22],
  ["Casa y vivienda · Parte 2","🏠",22],
  ["Casa y vivienda · Parte 3","🏠",7],
  ["Comida, bebida y restaurante · Parte 1","🍽️",22],
  ["Comida, bebida y restaurante · Parte 2","🍽️",22],
  ["Comida, bebida y restaurante · Parte 3","🍽️",12],
  ["Compras, ropa y dinero","🛍️",14],
  ["Números, cantidades y medidas · Parte 1","🔢",22],
  ["Números, cantidades y medidas · Parte 2","🔢",22],
  ["Números, cantidades y medidas · Parte 3","🔢",6],
  ["Tiempo, fechas y calendario · Parte 1","📅",22],
  ["Tiempo, fechas y calendario · Parte 2","📅",22],
  ["Tiempo, fechas y calendario · Parte 3","📅",2],
  ["Direcciones y orientación","🧭",4],
  ["Transporte y movilidad · Parte 1","🚆",22],
  ["Transporte y movilidad · Parte 2","🚆",15],
  ["Viajes y alojamiento","🧳",17],
  ["Servicios, correo, banco y trámites · Parte 1","🏛️",22],
  ["Servicios, correo, banco y trámites · Parte 2","🏛️",3],
  ["Tecnología y comunicación","📱",1],
  ["Estudio, idioma y examen · Parte 1","📚",22],
  ["Estudio, idioma y examen · Parte 2","📚",22],
  ["Estudio, idioma y examen · Parte 3","📚",7],
  ["Trabajo y profesión","💼",15],
  ["Cuerpo y salud","🩺",14],
  ["Comunicación y vida social · Parte 1","💬",22],
  ["Comunicación y vida social · Parte 2","💬",4],
  ["Ocio, cultura y deporte · Parte 1","⚽",22],
  ["Ocio, cultura y deporte · Parte 2","⚽",3],
  ["Naturaleza, entorno y clima","🌦️",11],
  ["Descripciones, estados y adverbios · Parte 1","🎨",22],
  ["Descripciones, estados y adverbios · Parte 2","🎨",22],
  ["Descripciones, estados y adverbios · Parte 3","🎨",22],
  ["Descripciones, estados y adverbios · Parte 4","🎨",22],
  ["Descripciones, estados y adverbios · Parte 5","🎨",21],
  ["Verbos y acciones esenciales · Parte 1","🏃",22],
  ["Verbos y acciones esenciales · Parte 2","🏃",22],
  ["Verbos y acciones esenciales · Parte 3","🏃",18],
  ["Pronombres, conectores y preposiciones · Parte 1","🧩",22],
  ["Pronombres, conectores y preposiciones · Parte 2","🧩",22],
  ["Pronombres, conectores y preposiciones · Parte 3","🧩",22],
  ["Pronombres, conectores y preposiciones · Parte 4","🧩",12],
  ["Objetos y nombres generales · Parte 1","📦",22],
  ["Objetos y nombres generales · Parte 2","📦",7]
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

export const WORDS = raws.flatMap(parseBlock);

export const byTheme = themeId => WORDS.filter(word => word.themeId === themeId);
export const wordById = id => WORDS.find(word => word.id === id);
export const themeById = id => THEMES.find(theme => theme.id === id);
