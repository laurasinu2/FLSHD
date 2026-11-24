export const THEMES = [
  {id:"saludos",name:"Saludos y frases",icon:"👋",tone:"#eef8dc",description:"Empieza por palabras que usarás desde el primer día."},
  {id:"familia",name:"Familia y personas",icon:"👨‍👩‍👧",tone:"#edf5ff",description:"Personas, relaciones y datos personales."},
  {id:"casa",name:"Casa",icon:"🏡",tone:"#fff1e9",description:"Los objetos y espacios que ves cada día."},
  {id:"cocina",name:"Cocina",icon:"🍳",tone:"#f8edff",description:"Vocabulario visual perfecto para tus propias fotos."},
  {id:"comida",name:"Comida y bebida",icon:"🍎",tone:"#eef8dc",description:"Alimentos y bebidas frecuentes."},
  {id:"ropa",name:"Ropa y compras",icon:"👕",tone:"#edf5ff",description:"Ropa, tiendas, precios y compras."},
  {id:"transporte",name:"Transporte",icon:"🚆",tone:"#fff1e9",description:"Moverte por la ciudad y viajar."},
  {id:"trabajo",name:"Trabajo",icon:"💼",tone:"#f8edff",description:"Palabras importantes para tu objetivo profesional."},
  {id:"estudio",name:"Estudio e idioma",icon:"📚",tone:"#eef8dc",description:"Aprender, estudiar y comunicarte en clase."},
  {id:"tiempo",name:"Tiempo y fechas",icon:"⏰",tone:"#edf5ff",description:"Días, horas y organización del tiempo."},
  {id:"naturaleza",name:"Naturaleza y clima",icon:"🌳",tone:"#fff1e9",description:"Entorno, animales y tiempo atmosférico."},
  {id:"ocio",name:"Ocio y deporte",icon:"⚽",tone:"#f8edff",description:"Actividades, intereses y tiempo libre."},
  {id:"salud",name:"Salud y cuerpo",icon:"🩺",tone:"#eef8dc",description:"Cuerpo, síntomas y asistencia médica."},
  {id:"ciudad",name:"Ciudad y servicios",icon:"🏙️",tone:"#edf5ff",description:"Orientarte y desenvolverte fuera de casa."},
  {id:"comunicacion",name:"Comunicación",icon:"📱",tone:"#fff1e9",description:"Teléfono, mensajes y datos de contacto."},
  {id:"verbos",name:"Verbos esenciales",icon:"🏃",tone:"#f8edff",description:"Acciones que te permiten construir frases."}
];

const W = (themeId, id, german, spanish, article, icon) => ({
  id, themeId, german, spanish, article: article || null, icon
});

export const WORDS = [
  W("saludos","saludos-hallo","hallo","hola",null,"👋"),
  W("saludos","saludos-danke","danke","gracias",null,"🙏"),
  W("saludos","saludos-bitte","bitte","por favor / de nada",null,"🙂"),
  W("saludos","saludos-tschuess","tschüss","adiós",null,"👋"),
  W("saludos","saludos-guten-morgen","Guten Morgen","buenos días",null,"☀️"),

  W("familia","familia-mutter","Mutter","madre","die","👩"),
  W("familia","familia-vater","Vater","padre","der","👨"),
  W("familia","familia-kind","Kind","niño/a","das","🧒"),
  W("familia","familia-bruder","Bruder","hermano","der","👦"),
  W("familia","familia-schwester","Schwester","hermana","die","👧"),

  W("casa","casa-haus","Haus","casa","das","🏠"),
  W("casa","casa-wohnung","Wohnung","piso / vivienda","die","🏢"),
  W("casa","casa-tuer","Tür","puerta","die","🚪"),
  W("casa","casa-fenster","Fenster","ventana","das","🪟"),
  W("casa","casa-schluessel","Schlüssel","llave","der","🗝️"),

  W("cocina","cocina-kueche","Küche","cocina","die","🍳"),
  W("cocina","cocina-kuehlschrank","Kühlschrank","nevera","der","🧊"),
  W("cocina","cocina-glas","Glas","vaso","das","🥛"),
  W("cocina","cocina-brot","Brot","pan","das","🍞"),
  W("cocina","cocina-milch","Milch","leche","die","🥛"),

  W("comida","comida-apfel","Apfel","manzana","der","🍎"),
  W("comida","comida-banane","Banane","plátano","die","🍌"),
  W("comida","comida-ei","Ei","huevo","das","🥚"),
  W("comida","comida-fisch","Fisch","pescado","der","🐟"),
  W("comida","comida-kartoffel","Kartoffel","patata","die","🥔"),

  W("ropa","ropa-jacke","Jacke","chaqueta","die","🧥"),
  W("ropa","ropa-schuh","Schuh","zapato","der","👟"),
  W("ropa","ropa-kleidung","Kleidung","ropa","die","👕"),
  W("ropa","ropa-tasche","Tasche","bolso / bolsa","die","👜"),
  W("ropa","ropa-preis","Preis","precio","der","🏷️"),

  W("transporte","transporte-bahnhof","Bahnhof","estación de tren","der","🚉"),
  W("transporte","transporte-zug","Zug","tren","der","🚆"),
  W("transporte","transporte-bus","Bus","autobús","der","🚌"),
  W("transporte","transporte-fahrrad","Fahrrad","bicicleta","das","🚲"),
  W("transporte","transporte-auto","Auto","coche","das","🚗"),

  W("trabajo","trabajo-arbeit","Arbeit","trabajo","die","💼"),
  W("trabajo","trabajo-beruf","Beruf","profesión","der","🧑‍💼"),
  W("trabajo","trabajo-chef","Chef","jefe","der","👔"),
  W("trabajo","trabajo-kollege","Kollege","compañero de trabajo","der","🤝"),
  W("trabajo","trabajo-firma","Firma","empresa","die","🏢"),

  W("estudio","estudio-buch","Buch","libro","das","📖"),
  W("estudio","estudio-schule","Schule","escuela","die","🏫"),
  W("estudio","estudio-lehrer","Lehrer","profesor","der","👨‍🏫"),
  W("estudio","estudio-frage","Frage","pregunta","die","❓"),
  W("estudio","estudio-antwort","Antwort","respuesta","die","💬"),

  W("tiempo","tiempo-tag","Tag","día","der","☀️"),
  W("tiempo","tiempo-woche","Woche","semana","die","📅"),
  W("tiempo","tiempo-monat","Monat","mes","der","🗓️"),
  W("tiempo","tiempo-jahr","Jahr","año","das","🎉"),
  W("tiempo","tiempo-stunde","Stunde","hora","die","🕒"),

  W("naturaleza","naturaleza-sonne","Sonne","sol","die","☀️"),
  W("naturaleza","naturaleza-regen","Regen","lluvia","der","🌧️"),
  W("naturaleza","naturaleza-baum","Baum","árbol","der","🌳"),
  W("naturaleza","naturaleza-blume","Blume","flor","die","🌸"),
  W("naturaleza","naturaleza-hund","Hund","perro","der","🐕"),

  W("ocio","ocio-sport","Sport","deporte","der","🏅"),
  W("ocio","ocio-fussball","Fußball","fútbol","der","⚽"),
  W("ocio","ocio-film","Film","película","der","🎬"),
  W("ocio","ocio-musik","Musik","música","die","🎵"),
  W("ocio","ocio-hobby","Hobby","afición","das","🎨"),

  W("salud","salud-arzt","Arzt","médico","der","🩺"),
  W("salud","salud-kopf","Kopf","cabeza","der","🧑"),
  W("salud","salud-hand","Hand","mano","die","✋"),
  W("salud","salud-arm","Arm","brazo","der","💪"),
  W("salud","salud-fieber","Fieber","fiebre","das","🌡️"),

  W("ciudad","ciudad-stadt","Stadt","ciudad","die","🏙️"),
  W("ciudad","ciudad-strasse","Straße","calle","die","🛣️"),
  W("ciudad","ciudad-hotel","Hotel","hotel","das","🏨"),
  W("ciudad","ciudad-restaurant","Restaurant","restaurante","das","🍽️"),
  W("ciudad","ciudad-bank","Bank","banco","die","🏦"),

  W("comunicacion","comunicacion-telefon","Telefon","teléfono","das","📱"),
  W("comunicacion","comunicacion-brief","Brief","carta","der","✉️"),
  W("comunicacion","comunicacion-email","E-Mail","correo electrónico","die","📧"),
  W("comunicacion","comunicacion-adresse","Adresse","dirección","die","📍"),
  W("comunicacion","comunicacion-internet","Internet","internet","das","🌐"),

  W("verbos","verbos-lernen","lernen","aprender",null,"📚"),
  W("verbos","verbos-sprechen","sprechen","hablar",null,"🗣️"),
  W("verbos","verbos-arbeiten","arbeiten","trabajar",null,"💼"),
  W("verbos","verbos-gehen","gehen","ir / caminar",null,"🚶"),
  W("verbos","verbos-essen","essen","comer",null,"🍽️")
];

export const byTheme = (themeId) => WORDS.filter(word => word.themeId === themeId);
export const wordById = (id) => WORDS.find(word => word.id === id);
export const themeById = (id) => THEMES.find(theme => theme.id === id);
