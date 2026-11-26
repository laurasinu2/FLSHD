// Only word-specific visual hints are used in lessons. Topic emojis are
// decorative and must never be treated as evidence of a correct answer.
const photoHints = {
  Ausweis:"🪪", Pass:"🛂", "Papiere (pl.)":"📄",
  Apartment:"🏢", Aufzug:"🛗", Bad:"🛁", Balkon:"🏢", Bett:"🛏️", Dusche:"🚿", Eingang:"🚪",
  Haus:"🏠", Herd:"🍳", Küche:"🍳", Kühlschrank:"🧊", Licht:"💡", Maschine:"⚙️",
  "Möbel (pl.)":"🪑", Raum:"🚪", Schlüssel:"🔑", Schrank:"🗄️", Sofa:"🛋️", Tisch:"🪑",
  Toilette:"🚽", Treppe:"🪜", Wohnung:"🏠", Zimmer:"🛏️",
  Apfel:"🍎", Bäckerei:"🥖", Banane:"🍌", Bier:"🍺", Birne:"🍐", Brot:"🍞",
  Brötchen:"🥖", Butter:"🧈", Café:"☕", Ei:"🥚", Essen:"🍽️", Flasche:"🍾", Fleisch:"🥩",
  Frühstück:"🥐", Getränk:"🥤", Glas:"🥛", Hähnchen:"🍗", Kaffee:"☕", Kartoffel:"🥔",
  "Lebensmittel (pl.)":"🛒", Milch:"🥛", Obst:"🍇", Öl:"🫗", "Pommes frites (pl.)":"🍟",
  Reis:"🍚", Restaurant:"🍽️", Saft:"🧃", Salat:"🥗", Salz:"🧂", Schinken:"🥓",
  Speisekarte:"📋", Tee:"🍵", Tomate:"🍅", Wasser:"💧", Wein:"🍷", Fisch:"🐟",
  Gemüse:"🥦", Kuchen:"🍰", Geld:"💶", Geschäft:"🏪", Jacke:"🧥", Karte:"💳",
  "(Kredit)-Karte":"💳", Kasse:"🧾", Kleidung:"👕", Laden:"🏪", Schuh:"👟", Tasche:"👜", Uhr:"🕒",
  Auto:"🚗", Autobahn:"🛣️", Automat:"🎫", Bahn:"🚆", Bahnhof:"🚉", Bahnsteig:"🚉",
  Bus:"🚌", Fahrkarte:"🎫", Fahrrad:"🚲", Flughafen:"🛫", Flugzeug:"✈️", Gepäck:"🧳",
  Gleis:"🛤️", Haltestelle:"🚏", Koffer:"🧳", Lkw:"🚚", "S-Bahn":"🚆", Straßenbahn:"🚊",
  Taxi:"🚕", Ticket:"🎟️", Zug:"🚆", Doppelzimmer:"🛏️", Dorf:"🏘️", Einzelzimmer:"🛏️",
  Hotel:"🏨", Meer:"🌊", Rezeption:"🛎️", See:"🏞️", Stadt:"🏙️", Brief:"✉️",
  Briefmarke:"📮", Prospekt:"📄", Rechnung:"🧾", Schild:"🪧", Telefon:"☎️", Handy:"📱",
  Anrufbeantworter:"☎️", Fax:"📠", Bleistift:"✏️", Buch:"📖", Computer:"💻", Drucker:"🖨️",
  Formular:"📋", Kugelschreiber:"🖊️", Papier:"📄", Schule:"🏫", Arbeitsplatz:"🖥️",
  Arm:"💪", Auge:"👁️", Bauch:"🧍", Bein:"🦵", Fuß:"🦶", Haar:"💇", Hand:"✋", Kopf:"🧑", Mund:"👄",
  Bild:"🖼️", CD:"💿", Fußball:"⚽", Kino:"🎬", Schwimmbad:"🏊", Zeitung:"📰",
  Baum:"🌳", Blume:"🌷", Feuer:"🔥", Garten:"🌻", Hund:"🐕", Regen:"🌧️", Sonne:"☀️",
  Ausgang:"🚪", Foto:"📷", Geschenk:"🎁", Halle:"🏢", Kindergarten:"🏫", Kiosk:"🏪",
  Plan:"🗺️", Straße:"🛣️", Zigarette:"🚬"
};
const iconHints = {
  Achtung:"⚠️", Vorsicht:"⚠️", hallo:"👋", tschüss:"👋", Wiederhören:"📞",
  Wiedersehen:"👋", danke:"🙏", Dank:"🙏", Glückwunsch:"🎉", willkommen:"🤝",
  Appetit:"🍽️", Geburtstag:"🎂", Hochzeit:"💍", Baby:"👶", Familie:"👨‍👩‍👧",
  Mutter:"👩", Vater:"👨", Kind:"🧒", Junge:"👦", Mädchen:"👧",
  Bruder:"👦", Schwester:"👧", Großmutter:"👵", Großvater:"👴", Oma:"👵", Opa:"👴",
  Arzt:"🩺", Doktor:"🩺", Lehrer:"👨‍🏫", Fahrer:"🚘", Polizei:"👮",
  arbeiten:"💼", essen:"🍽️", trinken:"🥤", schlafen:"😴", aufstehen:"🛏️",
  gehen:"🚶", laufen:"🏃", fahren:"🚗", fliegen:"✈️", reisen:"🧳",
  kochen:"🍳", frühstücken:"🥐", grillen:"🍖", einkaufen:"🛒", kaufen:"🛒",
  lesen:"📖", schreiben:"✍️", lernen:"📚", hören:"👂", sehen:"👀", sprechen:"🗣️",
  telefonieren:"📞", anrufen:"📞", lachen:"😄", tanzen:"💃", schwimmen:"🏊",
  wandern:"🥾", "Rad fahren":"🚲", fernsehen:"📺", feiern:"🎉", rauchen:"🚬",
  baden:"🛁", "(sich) duschen":"🚿", "(sich) waschen":"🧼", "(sich) anziehen":"👕",
  regnen:"🌧️", scheinen:"☀️", drucken:"🖨️", suchen:"🔍", unterschreiben:"✍️",
  links:"⬅️", rechts:"➡️", oben:"⬆️", unten:"⬇️", geradeaus:"⬆️",
  Norden:"⬆️", Süden:"⬇️", Westen:"⬅️", Osten:"➡️",
  schwarz:"⚫", weiß:"⚪", rot:"🔴", blau:"🔵", grün:"🟢", gelb:"🟡", braun:"🟤", grau:"🩶",
  Frühling:"🌷", Frühjahr:"🌷", Sommer:"☀️", Herbst:"🍂", Winter:"❄️",
  Morgen:"🌅", Nacht:"🌙", Abend:"🌆", müde:"😴", glücklich:"😊", krank:"🤒",
  Fieber:"🌡️", Durst:"🥤", Hunger:"🍽️", verboten:"🚫"
};
export function visualFor(word) {
  if (Object.hasOwn(photoHints,word.german)) return {visualType:"photo",visualHint:photoHints[word.german]};
  if (Object.hasOwn(iconHints,word.german)) return {visualType:"icon",visualHint:iconHints[word.german]};
  return {visualType:"text",visualHint:null};
}
