/*
 * Protel Hilfe – Wissensdatenbank (Datenformat 2)
 * Stand: 07.11.2026, 09:00  |  Revision: rev-beispieldaten-20261107
 *
 * Öffentlicher Stand: enthält nur als öffentlich gekennzeichnete Inhalte.
 *
 * Diese Datei gehört in den Unterordner „data“ der App und heißt „wissensdatenbank.js“.
 * Bitte nicht von Hand bearbeiten – Änderungen in der App vornehmen und erneut exportieren.
 */
window.PROTEL_HILFE_DATEN = {
 "format": "protel-hilfe-2",
 "schemaVersion": 2,
 "meta": {
  "title": "Protel Hilfe",
  "description": "Interne Wissensdatenbank der Rezeption – Prototyp mit Beispieldaten",
  "revision": "rev-beispieldaten-20261107",
  "updated": "2026-11-07T09:00:00.000Z",
  "exampleData": true,
  "searchExamples": [
   "Drucker druckt nicht",
   "Abreise",
   "Rechnug",
   "Zimmerkarte geht nicht",
   "Gast will früher kommen"
  ],
  "package": "beispiel"
 },
 "categories": [
  {
   "id": "anreise",
   "name": "Anreise & Check-in",
   "description": "Gäste empfangen, einchecken und Zimmer übergeben",
   "icon": "logIn",
   "color": "blue"
  },
  {
   "id": "abreise",
   "name": "Abreise & Check-out",
   "description": "Rechnung, Zahlung und Verabschiedung",
   "icon": "logOut",
   "color": "teal"
  },
  {
   "id": "reservierung",
   "name": "Reservierungen",
   "description": "Anfragen, Änderungen und Stornierungen",
   "icon": "calendar",
   "color": "violet"
  },
  {
   "id": "kasse",
   "name": "Kasse & Zahlungen",
   "description": "Zahlungsarten, Kartenterminal und Kasse",
   "icon": "card",
   "color": "green"
  },
  {
   "id": "gaeste",
   "name": "Gästeanliegen",
   "description": "Beschwerden, Wünsche und Fundsachen",
   "icon": "users",
   "color": "pink"
  },
  {
   "id": "technik",
   "name": "Technik & Störungen",
   "description": "Drucker, PCs, Schlüsselkarten und mehr",
   "icon": "monitor",
   "color": "red"
  },
  {
   "id": "nacht",
   "name": "Nachtdienst",
   "description": "Aufgaben in der Nacht und Tagesabschluss",
   "icon": "moon",
   "color": "slate"
  },
  {
   "id": "intern",
   "name": "Interne Abläufe & Kontakte",
   "description": "Schichtübergabe, Ansprechpersonen, Glossar",
   "icon": "phone",
   "color": "amber"
  },
  {
   "id": "app",
   "name": "Über diese Wissensdatenbank",
   "description": "Bedienung und Pflege von Protel Hilfe",
   "icon": "book",
   "color": "orange"
  }
 ],
 "synonyms": [
  [
   "Check-in",
   "Checkin",
   "Anreise",
   "einchecken",
   "Ankunft",
   "ankommen"
  ],
  [
   "Check-out",
   "Checkout",
   "Abreise",
   "auschecken",
   "abreisen"
  ],
  [
   "Rechnung",
   "Folio",
   "Gastrechnung",
   "Beleg",
   "Quittung"
  ],
  [
   "Zahlung",
   "bezahlen",
   "Bezahlung",
   "zahlen",
   "Payment"
  ],
  [
   "Kartenzahlung",
   "Kreditkarte",
   "EC-Karte",
   "Girocard",
   "Debitkarte",
   "Kartenterminal",
   "Terminal"
  ],
  [
   "Schlüsselkarte",
   "Zimmerkarte",
   "Keycard",
   "Zimmerschlüssel",
   "Transponder"
  ],
  [
   "Drucker",
   "Printer",
   "Ausdruck",
   "drucken"
  ],
  [
   "Reservierung",
   "Buchung",
   "Booking",
   "Reservation"
  ],
  [
   "Storno",
   "Stornierung",
   "stornieren",
   "absagen",
   "Cancel"
  ],
  [
   "No-Show",
   "Noshow",
   "Nichtanreise"
  ],
  [
   "Gast",
   "Gäste",
   "Kunde",
   "Guest"
  ],
  [
   "Zimmer",
   "Room",
   "Raum"
  ],
  [
   "Passwort",
   "Kennwort",
   "Login",
   "Anmeldung",
   "einloggen"
  ],
  [
   "Störung",
   "Fehler",
   "Problem",
   "defekt",
   "kaputt",
   "funktioniert nicht",
   "geht nicht"
  ],
  [
   "Nachtdienst",
   "Nachtschicht",
   "Night Audit",
   "Nachtaudit",
   "Tagesabschluss"
  ],
  [
   "Beschwerde",
   "Reklamation",
   "unzufrieden",
   "Ärger"
  ],
  [
   "Schichtübergabe",
   "Übergabe",
   "Schichtwechsel"
  ],
  [
   "Telefonnummer",
   "Durchwahl",
   "Kontakt",
   "Ansprechpartner",
   "Ansprechperson"
  ],
  [
   "Meldeschein",
   "Meldedaten",
   "Anmeldeformular",
   "Registrierung"
  ],
  [
   "Fundsache",
   "Fundsachen",
   "Fundbüro",
   "verloren",
   "vergessen"
  ],
  [
   "Screenshot",
   "Bildschirmfoto",
   "Bildschirmausschnitt"
  ]
 ],
 "articles": [
  {
   "id": "checkin-ablauf",
   "type": "guide",
   "title": "Gast einchecken – Muster-Ablauf",
   "categoryId": "anreise",
   "summary": "Vorlage für einen Standard-Check-in an der Rezeption. Die konkreten Arbeitsschritte im Hotelprogramm sind als Platzhalter markiert.",
   "tags": [
    "Check-in",
    "Anreise",
    "Meldeschein",
    "Zimmerkarte"
   ],
   "keywords": [
    "einchecken",
    "ankommen",
    "Ankunft"
   ],
   "example": true,
   "author": "Front Office (Beispiel)",
   "created": "2026-09-02T08:00:00.000Z",
   "updated": "2026-11-03T09:15:00.000Z",
   "body": "**Voraussetzungen**\n- Es liegt eine Reservierung vor (sonst siehe [Walk-in im Glossar](#/artikel/glossar-rezeption)).\n- Das Zimmer ist als bezugsfertig gemeldet. [[Wie wird der Zimmerstatus in Ihrem Haus geprüft?]]\n\n> [!HINWEIS]\n> Dieser Ablauf ist ein allgemeines Muster. Ergänzen Sie die Platzhalter mit den in Ihrem Haus gültigen Arbeitsschritten in protel.",
   "related": [
    "zimmerkarte-oeffnet-nicht",
    "early-checkin",
    "glossar-rezeption"
   ],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": [],
   "steps": [
    {
     "title": "Gast begrüßen und Reservierung aufrufen",
     "text": "Gast freundlich begrüßen und nach Namen oder Reservierungsnummer fragen.\n\nReservierung im Hotelprogramm aufrufen: [[Menüpfad bzw. Suchmaske in protel eintragen]]",
     "hint": "Bei mehreren Treffern mit gleichem Namen zusätzlich das Anreisedatum vergleichen.",
     "hintType": "tipp",
     "group": "",
     "images": [
      {
       "id": "platzhalter-checkin-ablauf-1",
       "src": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20960%20560%22%20width%3D%22960%22%20height%3D%22560%22%20font-family%3D%22Segoe%20UI%2C%20Arial%2C%20sans-serif%22%3E%3Crect%20width%3D%22960%22%20height%3D%22560%22%20fill%3D%22%23e8ecf2%22%2F%3E%3Crect%20x%3D%2224%22%20y%3D%2220%22%20width%3D%22912%22%20height%3D%22520%22%20rx%3D%2212%22%20fill%3D%22%23fff%22%20stroke%3D%22%23c6cfdc%22%2F%3E%3Cpath%20d%3D%22M36%2020h888a12%2012%200%200%201%2012%2012v28H24V32a12%2012%200%200%201%2012-12z%22%20fill%3D%22%23dfe5ee%22%2F%3E%3Ccircle%20cx%3D%2248%22%20cy%3D%2240%22%20r%3D%226%22%20fill%3D%22%23ef6a5a%22%2F%3E%3Ccircle%20cx%3D%2268%22%20cy%3D%2240%22%20r%3D%226%22%20fill%3D%22%23f4bf4f%22%2F%3E%3Ccircle%20cx%3D%2288%22%20cy%3D%2240%22%20r%3D%226%22%20fill%3D%22%2361c554%22%2F%3E%3Ctext%20x%3D%22110%22%20y%3D%2245%22%20font-size%3D%2214%22%20fill%3D%22%235b6576%22%3EBeispiel-Fenster%20%E2%80%93%20Platzhalter%3C%2Ftext%3E%3Crect%20x%3D%2224%22%20y%3D%2260%22%20width%3D%22180%22%20height%3D%22480%22%20fill%3D%22%23f3f5f9%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%2286%22%20width%3D%22140%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22122%22%20width%3D%22122%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22158%22%20width%3D%22104%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22194%22%20width%3D%22140%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22230%22%20width%3D%22122%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22266%22%20width%3D%22104%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22302%22%20width%3D%22140%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22338%22%20width%3D%22122%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22374%22%20width%3D%22104%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%2288%22%20width%3D%22440%22%20height%3D%2240%22%20rx%3D%228%22%20fill%3D%22%23fff%22%20stroke%3D%22%239fb0c8%22%20stroke-width%3D%222%22%2F%3E%3Ccircle%20cx%3D%22254%22%20cy%3D%22108%22%20r%3D%227%22%20fill%3D%22none%22%20stroke%3D%22%239fb0c8%22%20stroke-width%3D%222.5%22%2F%3E%3Crect%20x%3D%22274%22%20y%3D%22103%22%20width%3D%22150%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23cfd8e5%22%2F%3E%3Crect%20x%3D%22690%22%20y%3D%2288%22%20width%3D%22110%22%20height%3D%2240%22%20rx%3D%228%22%20fill%3D%22%23b9c7dc%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22150%22%20width%3D%22680%22%20height%3D%2234%22%20rx%3D%226%22%20fill%3D%22%23e6ebf3%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22192%22%20width%3D%22680%22%20height%3D%2234%22%20rx%3D%226%22%20fill%3D%22%23dde7fb%22%20stroke%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22248%22%20y%3D%22204%22%20width%3D%22180%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22520%22%20y%3D%22204%22%20width%3D%22120%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d3dbe6%22%2F%3E%3Crect%20x%3D%22760%22%20y%3D%22204%22%20width%3D%2290%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d3dbe6%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22232%22%20width%3D%22680%22%20height%3D%2234%22%20rx%3D%226%22%20fill%3D%22%23f6f8fb%22%20stroke%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22248%22%20y%3D%22244%22%20width%3D%22168%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22520%22%20y%3D%22244%22%20width%3D%22120%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d3dbe6%22%2F%3E%3Crect%20x%3D%22760%22%20y%3D%22244%22%20width%3D%2290%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d3dbe6%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22272%22%20width%3D%22680%22%20height%3D%2234%22%20rx%3D%226%22%20fill%3D%22%23f6f8fb%22%20stroke%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22248%22%20y%3D%22284%22%20width%3D%22156%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22520%22%20y%3D%22284%22%20width%3D%22120%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d3dbe6%22%2F%3E%3Crect%20x%3D%22760%22%20y%3D%22284%22%20width%3D%2290%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d3dbe6%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22312%22%20width%3D%22680%22%20height%3D%2234%22%20rx%3D%226%22%20fill%3D%22%23f6f8fb%22%20stroke%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22248%22%20y%3D%22324%22%20width%3D%22144%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22520%22%20y%3D%22324%22%20width%3D%22120%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d3dbe6%22%2F%3E%3Crect%20x%3D%22760%22%20y%3D%22324%22%20width%3D%2290%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d3dbe6%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22352%22%20width%3D%22680%22%20height%3D%2234%22%20rx%3D%226%22%20fill%3D%22%23f6f8fb%22%20stroke%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22248%22%20y%3D%22364%22%20width%3D%22132%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22520%22%20y%3D%22364%22%20width%3D%22120%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d3dbe6%22%2F%3E%3Crect%20x%3D%22760%22%20y%3D%22364%22%20width%3D%2290%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d3dbe6%22%2F%3E%3Cg%3E%3Crect%20x%3D%22520%22%20y%3D%22440%22%20width%3D%22396%22%20height%3D%2284%22%20rx%3D%2212%22%20fill%3D%22%23fff8e1%22%20stroke%3D%22%23d99a00%22%20stroke-width%3D%222%22%20stroke-dasharray%3D%227%205%22%2F%3E%3Ctext%20x%3D%22718%22%20y%3D%22472%22%20text-anchor%3D%22middle%22%20font-size%3D%2219%22%20font-weight%3D%22700%22%20fill%3D%22%238a5a00%22%3EBEISPIEL-SCREENSHOT%3C%2Ftext%3E%3Ctext%20x%3D%22718%22%20y%3D%22494%22%20text-anchor%3D%22middle%22%20font-size%3D%2213%22%20fill%3D%22%238a5a00%22%3EPlatzhalter%20%E2%80%93%20hier%20eigenen%20Screenshot%20einf%C3%BCgen%3C%2Ftext%3E%3Ctext%20x%3D%22718%22%20y%3D%22513%22%20text-anchor%3D%22middle%22%20font-size%3D%2212%22%20fill%3D%22%23a07a2a%22%3EReservierung%20suchen%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fsvg%3E",
       "alt": "Platzhalter: Suchmaske für Reservierungen",
       "caption": "",
       "markers": [
        {
         "x": 47.5,
         "y": 19.3,
         "label": "Suchfeld (Beispiel)"
        },
        {
         "x": 37,
         "y": 37.5,
         "label": "Treffer auswählen (Beispiel)"
        }
       ],
       "rights": "oeffentlich",
       "origin": "platzhalter",
       "captured": "",
       "pmsVersion": "",
       "capturedBy": "",
       "slot": "",
       "status": ""
      }
     ],
     "slots": []
    },
    {
     "title": "Reservierungsdaten abgleichen",
     "text": "Gemeinsam mit dem Gast prüfen:\n- Anreise- und Abreisedatum\n- Zimmerkategorie und Personenzahl\n- Vereinbarte Leistungen (z. B. Frühstück, Parkplatz)\n\nBei Abweichungen: [[Hausregel für Änderungen beim Check-in eintragen]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Meldedaten erfassen",
     "text": "Meldeschein bzw. Meldedaten gemäß den aktuell geltenden gesetzlichen Vorgaben und der Hausregel erfassen. [[Ablauf in Ihrem Haus eintragen (Papier oder digital, Pflichtangaben)]]",
     "hint": "Ausweisdokumente nur so verwenden, wie es intern freigegeben ist.",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Zahlung bzw. Garantie klären",
     "text": "Klären, wie der Gast bezahlen möchte und ob eine Garantie oder Vorautorisierung erforderlich ist. [[Hausregel zu Garantie und Kaution eintragen]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Zimmerkarte erstellen",
     "text": "Schlüsselkarte(n) für das zugewiesene Zimmer und den Aufenthaltszeitraum erstellen. [[Bedienschritte am Kartencodierer eintragen]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [
      {
       "id": "platzhalter-checkin-ablauf-5",
       "src": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20960%20560%22%20width%3D%22960%22%20height%3D%22560%22%20font-family%3D%22Segoe%20UI%2C%20Arial%2C%20sans-serif%22%3E%3Crect%20width%3D%22960%22%20height%3D%22560%22%20fill%3D%22%23e8ecf2%22%2F%3E%3Crect%20x%3D%2224%22%20y%3D%2220%22%20width%3D%22912%22%20height%3D%22520%22%20rx%3D%2212%22%20fill%3D%22%23fff%22%20stroke%3D%22%23c6cfdc%22%2F%3E%3Cpath%20d%3D%22M36%2020h888a12%2012%200%200%201%2012%2012v28H24V32a12%2012%200%200%201%2012-12z%22%20fill%3D%22%23dfe5ee%22%2F%3E%3Ccircle%20cx%3D%2248%22%20cy%3D%2240%22%20r%3D%226%22%20fill%3D%22%23ef6a5a%22%2F%3E%3Ccircle%20cx%3D%2268%22%20cy%3D%2240%22%20r%3D%226%22%20fill%3D%22%23f4bf4f%22%2F%3E%3Ccircle%20cx%3D%2288%22%20cy%3D%2240%22%20r%3D%226%22%20fill%3D%22%2361c554%22%2F%3E%3Ctext%20x%3D%22110%22%20y%3D%2245%22%20font-size%3D%2214%22%20fill%3D%22%235b6576%22%3EBeispiel-Fenster%20%E2%80%93%20Platzhalter%3C%2Ftext%3E%3Crect%20x%3D%2224%22%20y%3D%2260%22%20width%3D%22180%22%20height%3D%22480%22%20fill%3D%22%23f3f5f9%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%2286%22%20width%3D%22140%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22122%22%20width%3D%22122%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22158%22%20width%3D%22104%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22194%22%20width%3D%22140%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22230%22%20width%3D%22122%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22266%22%20width%3D%22104%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22302%22%20width%3D%22140%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22338%22%20width%3D%22122%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22374%22%20width%3D%22104%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%2290%22%20width%3D%22640%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22124%22%20width%3D%22622%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22158%22%20width%3D%22604%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22192%22%20width%3D%22640%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22226%22%20width%3D%22622%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22260%22%20width%3D%22604%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22204%22%20y%3D%2260%22%20width%3D%22732%22%20height%3D%22480%22%20fill%3D%22%230f1a2a%22%20opacity%3D%22.28%22%2F%3E%3Crect%20x%3D%22300%22%20y%3D%22140%22%20width%3D%22440%22%20height%3D%22270%22%20rx%3D%2212%22%20fill%3D%22%23fff%22%20stroke%3D%22%23b9c4d4%22%2F%3E%3Crect%20x%3D%22300%22%20y%3D%22140%22%20width%3D%22440%22%20height%3D%2244%22%20rx%3D%2212%22%20fill%3D%22%23e6ebf3%22%2F%3E%3Crect%20x%3D%22300%22%20y%3D%22170%22%20width%3D%22440%22%20height%3D%2214%22%20fill%3D%22%23e6ebf3%22%2F%3E%3Crect%20x%3D%22320%22%20y%3D%22157%22%20width%3D%22160%22%20height%3D%2211%22%20rx%3D%225.5%22%20fill%3D%22%23a9b7cb%22%2F%3E%3Crect%20x%3D%22330%22%20y%3D%22210%22%20width%3D%22110%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22330%22%20y%3D%22228%22%20width%3D%22380%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%239fb0c8%22%20stroke-width%3D%222%22%2F%3E%3Crect%20x%3D%22330%22%20y%3D%22280%22%20width%3D%2290%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22330%22%20y%3D%22298%22%20width%3D%22380%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%23cfd8e5%22%2F%3E%3Crect%20x%3D%22520%22%20y%3D%22356%22%20width%3D%2290%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23e6ebf3%22%2F%3E%3Crect%20x%3D%22620%22%20y%3D%22356%22%20width%3D%2290%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%238ea6d8%22%2F%3E%3Cg%3E%3Crect%20x%3D%22520%22%20y%3D%22440%22%20width%3D%22396%22%20height%3D%2284%22%20rx%3D%2212%22%20fill%3D%22%23fff8e1%22%20stroke%3D%22%23d99a00%22%20stroke-width%3D%222%22%20stroke-dasharray%3D%227%205%22%2F%3E%3Ctext%20x%3D%22718%22%20y%3D%22472%22%20text-anchor%3D%22middle%22%20font-size%3D%2219%22%20font-weight%3D%22700%22%20fill%3D%22%238a5a00%22%3EBEISPIEL-SCREENSHOT%3C%2Ftext%3E%3Ctext%20x%3D%22718%22%20y%3D%22494%22%20text-anchor%3D%22middle%22%20font-size%3D%2213%22%20fill%3D%22%238a5a00%22%3EPlatzhalter%20%E2%80%93%20hier%20eigenen%20Screenshot%20einf%C3%BCgen%3C%2Ftext%3E%3Ctext%20x%3D%22718%22%20y%3D%22513%22%20text-anchor%3D%22middle%22%20font-size%3D%2212%22%20fill%3D%22%23a07a2a%22%3EZimmerkarte%20erstellen%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fsvg%3E",
       "alt": "Platzhalter: Dialog zum Erstellen einer Zimmerkarte",
       "caption": "",
       "markers": [
        {
         "x": 54,
         "y": 43.8,
         "label": "Zimmernummer (Beispiel)"
        },
        {
         "x": 69.3,
         "y": 66.6,
         "label": "Bestätigen (Beispiel)"
        }
       ],
       "rights": "oeffentlich",
       "origin": "platzhalter",
       "captured": "",
       "pmsVersion": "",
       "capturedBy": "",
       "slot": "",
       "status": ""
      }
     ],
     "slots": []
    },
    {
     "title": "Hausinformationen geben",
     "text": "Kurz informieren über:\n- Frühstückszeiten und -ort [[eintragen]]\n- WLAN-Zugang [[eintragen]]\n- Check-out-Zeit [[eintragen]]\n\nZimmerkarte übergeben und den Weg zum Zimmer erklären.",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Check-in im System abschließen",
     "text": "[[Abschließenden Arbeitsschritt in protel eintragen]]\n\nAnschließend prüfen, ob der Gast als angereist geführt wird.",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    }
   ]
  },
  {
   "id": "checkout-ablauf",
   "type": "guide",
   "title": "Gast auschecken und Rechnung übergeben – Muster-Ablauf",
   "categoryId": "abreise",
   "summary": "Vorlage für einen Check-out mit Rechnungsprüfung, Zahlung und Verabschiedung.",
   "tags": [
    "Check-out",
    "Abreise",
    "Rechnung",
    "Zahlung"
   ],
   "keywords": [
    "auschecken",
    "abreisen",
    "Folio"
   ],
   "example": true,
   "author": "Front Office (Beispiel)",
   "created": "2026-09-02T08:30:00.000Z",
   "updated": "2026-10-28T14:00:00.000Z",
   "body": "",
   "related": [
    "zahlungsproblem-checkout",
    "drucker-druckt-nicht",
    "kartenzahlung-abgelehnt"
   ],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": [],
   "steps": [
    {
     "title": "Zimmernummer erfragen und Rechnung aufrufen",
     "text": "Nach der Zimmernummer fragen und die Rechnung des Gastes aufrufen: [[Menüpfad in protel eintragen]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [
      {
       "id": "platzhalter-checkout-ablauf-1",
       "src": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20960%20560%22%20width%3D%22960%22%20height%3D%22560%22%20font-family%3D%22Segoe%20UI%2C%20Arial%2C%20sans-serif%22%3E%3Crect%20width%3D%22960%22%20height%3D%22560%22%20fill%3D%22%23e8ecf2%22%2F%3E%3Crect%20x%3D%2224%22%20y%3D%2220%22%20width%3D%22912%22%20height%3D%22520%22%20rx%3D%2212%22%20fill%3D%22%23fff%22%20stroke%3D%22%23c6cfdc%22%2F%3E%3Cpath%20d%3D%22M36%2020h888a12%2012%200%200%201%2012%2012v28H24V32a12%2012%200%200%201%2012-12z%22%20fill%3D%22%23dfe5ee%22%2F%3E%3Ccircle%20cx%3D%2248%22%20cy%3D%2240%22%20r%3D%226%22%20fill%3D%22%23ef6a5a%22%2F%3E%3Ccircle%20cx%3D%2268%22%20cy%3D%2240%22%20r%3D%226%22%20fill%3D%22%23f4bf4f%22%2F%3E%3Ccircle%20cx%3D%2288%22%20cy%3D%2240%22%20r%3D%226%22%20fill%3D%22%2361c554%22%2F%3E%3Ctext%20x%3D%22110%22%20y%3D%2245%22%20font-size%3D%2214%22%20fill%3D%22%235b6576%22%3EBeispiel-Fenster%20%E2%80%93%20Platzhalter%3C%2Ftext%3E%3Crect%20x%3D%2224%22%20y%3D%2260%22%20width%3D%22180%22%20height%3D%22480%22%20fill%3D%22%23f3f5f9%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%2286%22%20width%3D%22140%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22122%22%20width%3D%22122%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22158%22%20width%3D%22104%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22194%22%20width%3D%22140%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22230%22%20width%3D%22122%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22266%22%20width%3D%22104%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22302%22%20width%3D%22140%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22338%22%20width%3D%22122%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22374%22%20width%3D%22104%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%2284%22%20width%3D%22300%22%20height%3D%2214%22%20rx%3D%227%22%20fill%3D%22%23b9c7dc%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22116%22%20width%3D%22680%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%23e6ebf3%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22152%22%20width%3D%22680%22%20height%3D%2228%22%20rx%3D%225%22%20fill%3D%22%23f6f8fb%22%20stroke%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22246%22%20y%3D%22161%22%20width%3D%22220%22%20height%3D%229%22%20rx%3D%224.5%22%20fill%3D%22%23c9d2de%22%2F%3E%3Crect%20x%3D%22820%22%20y%3D%22161%22%20width%3D%2270%22%20height%3D%229%22%20rx%3D%224.5%22%20fill%3D%22%23c9d2de%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22186%22%20width%3D%22680%22%20height%3D%2228%22%20rx%3D%225%22%20fill%3D%22%23f6f8fb%22%20stroke%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22246%22%20y%3D%22195%22%20width%3D%22190%22%20height%3D%229%22%20rx%3D%224.5%22%20fill%3D%22%23c9d2de%22%2F%3E%3Crect%20x%3D%22820%22%20y%3D%22195%22%20width%3D%2270%22%20height%3D%229%22%20rx%3D%224.5%22%20fill%3D%22%23c9d2de%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22220%22%20width%3D%22680%22%20height%3D%2228%22%20rx%3D%225%22%20fill%3D%22%23f6f8fb%22%20stroke%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22246%22%20y%3D%22229%22%20width%3D%22160%22%20height%3D%229%22%20rx%3D%224.5%22%20fill%3D%22%23c9d2de%22%2F%3E%3Crect%20x%3D%22820%22%20y%3D%22229%22%20width%3D%2270%22%20height%3D%229%22%20rx%3D%224.5%22%20fill%3D%22%23c9d2de%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22254%22%20width%3D%22680%22%20height%3D%2228%22%20rx%3D%225%22%20fill%3D%22%23f6f8fb%22%20stroke%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22246%22%20y%3D%22263%22%20width%3D%22220%22%20height%3D%229%22%20rx%3D%224.5%22%20fill%3D%22%23c9d2de%22%2F%3E%3Crect%20x%3D%22820%22%20y%3D%22263%22%20width%3D%2270%22%20height%3D%229%22%20rx%3D%224.5%22%20fill%3D%22%23c9d2de%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22288%22%20width%3D%22680%22%20height%3D%2228%22%20rx%3D%225%22%20fill%3D%22%23f6f8fb%22%20stroke%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22246%22%20y%3D%22297%22%20width%3D%22190%22%20height%3D%229%22%20rx%3D%224.5%22%20fill%3D%22%23c9d2de%22%2F%3E%3Crect%20x%3D%22820%22%20y%3D%22297%22%20width%3D%2270%22%20height%3D%229%22%20rx%3D%224.5%22%20fill%3D%22%23c9d2de%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22322%22%20width%3D%22680%22%20height%3D%2228%22%20rx%3D%225%22%20fill%3D%22%23f6f8fb%22%20stroke%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22246%22%20y%3D%22331%22%20width%3D%22160%22%20height%3D%229%22%20rx%3D%224.5%22%20fill%3D%22%23c9d2de%22%2F%3E%3Crect%20x%3D%22820%22%20y%3D%22331%22%20width%3D%2270%22%20height%3D%229%22%20rx%3D%224.5%22%20fill%3D%22%23c9d2de%22%2F%3E%3Crect%20x%3D%22640%22%20y%3D%22372%22%20width%3D%22272%22%20height%3D%2248%22%20rx%3D%228%22%20fill%3D%22%23dde7fb%22%20stroke%3D%22%23b5c6ea%22%2F%3E%3Crect%20x%3D%22660%22%20y%3D%22390%22%20width%3D%2290%22%20height%3D%2212%22%20rx%3D%226%22%20fill%3D%22%239fb3dc%22%2F%3E%3Crect%20x%3D%22800%22%20y%3D%22388%22%20width%3D%2292%22%20height%3D%2216%22%20rx%3D%228%22%20fill%3D%22%237f98cf%22%2F%3E%3Cg%3E%3Crect%20x%3D%22520%22%20y%3D%22440%22%20width%3D%22396%22%20height%3D%2284%22%20rx%3D%2212%22%20fill%3D%22%23fff8e1%22%20stroke%3D%22%23d99a00%22%20stroke-width%3D%222%22%20stroke-dasharray%3D%227%205%22%2F%3E%3Ctext%20x%3D%22718%22%20y%3D%22472%22%20text-anchor%3D%22middle%22%20font-size%3D%2219%22%20font-weight%3D%22700%22%20fill%3D%22%238a5a00%22%3EBEISPIEL-SCREENSHOT%3C%2Ftext%3E%3Ctext%20x%3D%22718%22%20y%3D%22494%22%20text-anchor%3D%22middle%22%20font-size%3D%2213%22%20fill%3D%22%238a5a00%22%3EPlatzhalter%20%E2%80%93%20hier%20eigenen%20Screenshot%20einf%C3%BCgen%3C%2Ftext%3E%3Ctext%20x%3D%22718%22%20y%3D%22513%22%20text-anchor%3D%22middle%22%20font-size%3D%2212%22%20fill%3D%22%23a07a2a%22%3ERechnung%20aufrufen%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fsvg%3E",
       "alt": "Platzhalter: Rechnungsübersicht",
       "caption": "",
       "markers": [
        {
         "x": 40,
         "y": 30.5,
         "label": "Rechnungspositionen (Beispiel)"
        },
        {
         "x": 87,
         "y": 70.7,
         "label": "Gesamtbetrag (Beispiel)"
        }
       ],
       "rights": "oeffentlich",
       "origin": "platzhalter",
       "captured": "",
       "pmsVersion": "",
       "capturedBy": "",
       "slot": "",
       "status": ""
      }
     ],
     "slots": []
    },
    {
     "title": "Nach Nebenleistungen fragen",
     "text": "Nach noch nicht erfassten Leistungen fragen, z. B. Minibar, Getränke oder Parkplatz. Fehlende Positionen buchen: [[Arbeitsschritt in protel eintragen]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Rechnung prüfen lassen",
     "text": "Die Rechnung dem Gast zur Prüfung zeigen und die Rechnungsadresse (privat oder Firma) bestätigen lassen. [[Ablauf bei Änderung der Rechnungsadresse eintragen]]",
     "hint": "Bei Unstimmigkeiten die Position in Ruhe prüfen und ggf. Rücksprache mit der Schichtleitung halten.",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Zahlung entgegennehmen",
     "text": "Zahlung mit der gewünschten Zahlungsart abwickeln. Bei Problemen hilft der Assistent [Zahlungsproblem beim Check-out](#/artikel/zahlungsproblem-checkout).",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Rechnung übergeben oder versenden",
     "text": "Rechnung ausdrucken oder per E-Mail senden – je nach Wunsch des Gastes und Hausregel. [[Ablauf für den E-Mail-Versand eintragen]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Zimmerkarte zurücknehmen und verabschieden",
     "text": "Zimmerkarte(n) zurücknehmen, nach dem Aufenthalt fragen und den Gast freundlich verabschieden.",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    }
   ]
  },
  {
   "id": "reservierung-telefon",
   "type": "guide",
   "title": "Reservierungsanfrage am Telefon annehmen – Muster",
   "categoryId": "reservierung",
   "summary": "Vorlage für die telefonische Annahme einer Zimmerreservierung.",
   "tags": [
    "Reservierung",
    "Telefon",
    "Anfrage"
   ],
   "keywords": [
    "buchen",
    "Zimmer anfragen",
    "Verfügbarkeit"
   ],
   "example": true,
   "author": "Front Office (Beispiel)",
   "created": "2026-09-10T10:00:00.000Z",
   "updated": "2026-10-15T11:20:00.000Z",
   "body": "",
   "related": [
    "storno-reservierung"
   ],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": [],
   "steps": [
    {
     "title": "Anruf entgegennehmen",
     "text": "Mit der Begrüßung nach Hausstandard melden: [[Begrüßungsformel eintragen]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Daten erfragen",
     "text": "Folgende Angaben erfragen und notieren:\n- Anreise- und Abreisedatum\n- Anzahl der Personen und Zimmer\n- Gewünschte Zimmerkategorie\n- Besondere Wünsche (z. B. Kinderbett, Parkplatz)",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Verfügbarkeit und Rate prüfen",
     "text": "Verfügbarkeit und passende Raten prüfen: [[Arbeitsschritt in protel eintragen]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [
      {
       "id": "platzhalter-reservierung-telefon-3",
       "src": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20960%20560%22%20width%3D%22960%22%20height%3D%22560%22%20font-family%3D%22Segoe%20UI%2C%20Arial%2C%20sans-serif%22%3E%3Crect%20width%3D%22960%22%20height%3D%22560%22%20fill%3D%22%23e8ecf2%22%2F%3E%3Crect%20x%3D%2224%22%20y%3D%2220%22%20width%3D%22912%22%20height%3D%22520%22%20rx%3D%2212%22%20fill%3D%22%23fff%22%20stroke%3D%22%23c6cfdc%22%2F%3E%3Cpath%20d%3D%22M36%2020h888a12%2012%200%200%201%2012%2012v28H24V32a12%2012%200%200%201%2012-12z%22%20fill%3D%22%23dfe5ee%22%2F%3E%3Ccircle%20cx%3D%2248%22%20cy%3D%2240%22%20r%3D%226%22%20fill%3D%22%23ef6a5a%22%2F%3E%3Ccircle%20cx%3D%2268%22%20cy%3D%2240%22%20r%3D%226%22%20fill%3D%22%23f4bf4f%22%2F%3E%3Ccircle%20cx%3D%2288%22%20cy%3D%2240%22%20r%3D%226%22%20fill%3D%22%2361c554%22%2F%3E%3Ctext%20x%3D%22110%22%20y%3D%2245%22%20font-size%3D%2214%22%20fill%3D%22%235b6576%22%3EBeispiel-Fenster%20%E2%80%93%20Platzhalter%3C%2Ftext%3E%3Crect%20x%3D%2224%22%20y%3D%2260%22%20width%3D%22180%22%20height%3D%22480%22%20fill%3D%22%23f3f5f9%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%2286%22%20width%3D%22140%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22122%22%20width%3D%22122%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22158%22%20width%3D%22104%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22194%22%20width%3D%22140%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22230%22%20width%3D%22122%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22266%22%20width%3D%22104%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22302%22%20width%3D%22140%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22338%22%20width%3D%22122%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22374%22%20width%3D%22104%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%2284%22%20width%3D%22260%22%20height%3D%2214%22%20rx%3D%227%22%20fill%3D%22%23b9c7dc%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22124%22%20width%3D%22120%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22142%22%20width%3D%22320%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%23cfd8e5%22%2F%3E%3Crect%20x%3D%22590%22%20y%3D%22124%22%20width%3D%22100%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22590%22%20y%3D%22142%22%20width%3D%22320%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%23cfd8e5%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22194%22%20width%3D%22120%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22212%22%20width%3D%22320%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%23cfd8e5%22%2F%3E%3Crect%20x%3D%22590%22%20y%3D%22194%22%20width%3D%22100%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22590%22%20y%3D%22212%22%20width%3D%22320%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%23cfd8e5%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22264%22%20width%3D%22120%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22282%22%20width%3D%22320%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%23cfd8e5%22%2F%3E%3Crect%20x%3D%22590%22%20y%3D%22264%22%20width%3D%22100%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22590%22%20y%3D%22282%22%20width%3D%22320%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%23cfd8e5%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22334%22%20width%3D%22120%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22352%22%20width%3D%22320%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%23cfd8e5%22%2F%3E%3Crect%20x%3D%22590%22%20y%3D%22334%22%20width%3D%22100%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22590%22%20y%3D%22352%22%20width%3D%22320%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%23cfd8e5%22%2F%3E%3Crect%20x%3D%22800%22%20y%3D%22420%22%20width%3D%22110%22%20height%3D%2238%22%20rx%3D%228%22%20fill%3D%22%238ea6d8%22%2F%3E%3Cg%3E%3Crect%20x%3D%22520%22%20y%3D%22440%22%20width%3D%22396%22%20height%3D%2284%22%20rx%3D%2212%22%20fill%3D%22%23fff8e1%22%20stroke%3D%22%23d99a00%22%20stroke-width%3D%222%22%20stroke-dasharray%3D%227%205%22%2F%3E%3Ctext%20x%3D%22718%22%20y%3D%22472%22%20text-anchor%3D%22middle%22%20font-size%3D%2219%22%20font-weight%3D%22700%22%20fill%3D%22%238a5a00%22%3EBEISPIEL-SCREENSHOT%3C%2Ftext%3E%3Ctext%20x%3D%22718%22%20y%3D%22494%22%20text-anchor%3D%22middle%22%20font-size%3D%2213%22%20fill%3D%22%238a5a00%22%3EPlatzhalter%20%E2%80%93%20hier%20eigenen%20Screenshot%20einf%C3%BCgen%3C%2Ftext%3E%3Ctext%20x%3D%22718%22%20y%3D%22513%22%20text-anchor%3D%22middle%22%20font-size%3D%2212%22%20fill%3D%22%23a07a2a%22%3EVerf%C3%BCgbarkeit%20pr%C3%BCfen%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fsvg%3E",
       "alt": "Platzhalter: Maske zur Verfügbarkeitsprüfung",
       "caption": "",
       "markers": [
        {
         "x": 41.5,
         "y": 28.4,
         "label": "Zeitraum (Beispiel)"
        },
        {
         "x": 89,
         "y": 78.4,
         "label": "Suche starten (Beispiel)"
        }
       ],
       "rights": "oeffentlich",
       "origin": "platzhalter",
       "captured": "",
       "pmsVersion": "",
       "capturedBy": "",
       "slot": "",
       "status": ""
      }
     ],
     "slots": []
    },
    {
     "title": "Angebot nennen",
     "text": "Preis, enthaltene Leistungen sowie Storno- und Zahlungsbedingungen nennen. [[Standardformulierung eintragen]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Reservierung anlegen",
     "text": "[[Arbeitsschritte zum Anlegen einer Reservierung in protel eintragen]]",
     "hint": "Namen buchstabieren lassen und Telefonnummer bzw. E-Mail-Adresse wiederholen.",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Bestätigung zusenden",
     "text": "Alle Daten zusammenfassen und die Reservierungsbestätigung versenden. [[Ablauf eintragen]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    }
   ]
  },
  {
   "id": "storno-reservierung",
   "type": "guide",
   "title": "Reservierung stornieren – Muster-Ablauf",
   "categoryId": "reservierung",
   "summary": "Vorlage zum Stornieren einer Reservierung einschließlich Prüfung der Stornobedingungen.",
   "tags": [
    "Storno",
    "Stornierung",
    "Reservierung"
   ],
   "keywords": [
    "absagen",
    "canceln",
    "Reservierung löschen"
   ],
   "example": true,
   "author": "Front Office (Beispiel)",
   "created": "2026-09-12T09:00:00.000Z",
   "updated": "2026-10-30T16:40:00.000Z",
   "body": "> [!WICHTIG]\n> Gruppen- und Firmenreservierungen können abweichende Bedingungen haben. [[Ansprechperson für Gruppenreservierungen eintragen]]",
   "related": [
    "reservierung-telefon",
    "glossar-rezeption"
   ],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": [],
   "steps": [
    {
     "title": "Reservierung aufrufen",
     "text": "Reservierung über Name, Anreisedatum oder Reservierungsnummer suchen. [[Menüpfad in protel eintragen]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Stornobedingungen prüfen",
     "text": "Prüfen, welche Stornobedingungen für die gebuchte Rate gelten und ob Gebühren anfallen. [[Wo sind die Stornobedingungen ersichtlich?]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Gast informieren",
     "text": "Den Gast über eventuelle Stornogebühren informieren, **bevor** die Stornierung durchgeführt wird.",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Stornierung durchführen",
     "text": "[[Arbeitsschritt in protel eintragen, inklusive Angabe des Stornogrunds]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [
      {
       "id": "platzhalter-storno-reservierung-4",
       "src": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20960%20560%22%20width%3D%22960%22%20height%3D%22560%22%20font-family%3D%22Segoe%20UI%2C%20Arial%2C%20sans-serif%22%3E%3Crect%20width%3D%22960%22%20height%3D%22560%22%20fill%3D%22%23e8ecf2%22%2F%3E%3Crect%20x%3D%2224%22%20y%3D%2220%22%20width%3D%22912%22%20height%3D%22520%22%20rx%3D%2212%22%20fill%3D%22%23fff%22%20stroke%3D%22%23c6cfdc%22%2F%3E%3Cpath%20d%3D%22M36%2020h888a12%2012%200%200%201%2012%2012v28H24V32a12%2012%200%200%201%2012-12z%22%20fill%3D%22%23dfe5ee%22%2F%3E%3Ccircle%20cx%3D%2248%22%20cy%3D%2240%22%20r%3D%226%22%20fill%3D%22%23ef6a5a%22%2F%3E%3Ccircle%20cx%3D%2268%22%20cy%3D%2240%22%20r%3D%226%22%20fill%3D%22%23f4bf4f%22%2F%3E%3Ccircle%20cx%3D%2288%22%20cy%3D%2240%22%20r%3D%226%22%20fill%3D%22%2361c554%22%2F%3E%3Ctext%20x%3D%22110%22%20y%3D%2245%22%20font-size%3D%2214%22%20fill%3D%22%235b6576%22%3EBeispiel-Fenster%20%E2%80%93%20Platzhalter%3C%2Ftext%3E%3Crect%20x%3D%2224%22%20y%3D%2260%22%20width%3D%22180%22%20height%3D%22480%22%20fill%3D%22%23f3f5f9%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%2286%22%20width%3D%22140%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22122%22%20width%3D%22122%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22158%22%20width%3D%22104%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22194%22%20width%3D%22140%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22230%22%20width%3D%22122%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22266%22%20width%3D%22104%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22302%22%20width%3D%22140%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22338%22%20width%3D%22122%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22374%22%20width%3D%22104%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%2290%22%20width%3D%22640%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22124%22%20width%3D%22622%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22158%22%20width%3D%22604%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22192%22%20width%3D%22640%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22226%22%20width%3D%22622%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22260%22%20width%3D%22604%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23e3e8f0%22%2F%3E%3Crect%20x%3D%22204%22%20y%3D%2260%22%20width%3D%22732%22%20height%3D%22480%22%20fill%3D%22%230f1a2a%22%20opacity%3D%22.28%22%2F%3E%3Crect%20x%3D%22300%22%20y%3D%22140%22%20width%3D%22440%22%20height%3D%22270%22%20rx%3D%2212%22%20fill%3D%22%23fff%22%20stroke%3D%22%23b9c4d4%22%2F%3E%3Crect%20x%3D%22300%22%20y%3D%22140%22%20width%3D%22440%22%20height%3D%2244%22%20rx%3D%2212%22%20fill%3D%22%23e6ebf3%22%2F%3E%3Crect%20x%3D%22300%22%20y%3D%22170%22%20width%3D%22440%22%20height%3D%2214%22%20fill%3D%22%23e6ebf3%22%2F%3E%3Crect%20x%3D%22320%22%20y%3D%22157%22%20width%3D%22160%22%20height%3D%2211%22%20rx%3D%225.5%22%20fill%3D%22%23a9b7cb%22%2F%3E%3Crect%20x%3D%22330%22%20y%3D%22210%22%20width%3D%22110%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22330%22%20y%3D%22228%22%20width%3D%22380%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%239fb0c8%22%20stroke-width%3D%222%22%2F%3E%3Crect%20x%3D%22330%22%20y%3D%22280%22%20width%3D%2290%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22330%22%20y%3D%22298%22%20width%3D%22380%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%23cfd8e5%22%2F%3E%3Crect%20x%3D%22520%22%20y%3D%22356%22%20width%3D%2290%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23e6ebf3%22%2F%3E%3Crect%20x%3D%22620%22%20y%3D%22356%22%20width%3D%2290%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%238ea6d8%22%2F%3E%3Cg%3E%3Crect%20x%3D%22520%22%20y%3D%22440%22%20width%3D%22396%22%20height%3D%2284%22%20rx%3D%2212%22%20fill%3D%22%23fff8e1%22%20stroke%3D%22%23d99a00%22%20stroke-width%3D%222%22%20stroke-dasharray%3D%227%205%22%2F%3E%3Ctext%20x%3D%22718%22%20y%3D%22472%22%20text-anchor%3D%22middle%22%20font-size%3D%2219%22%20font-weight%3D%22700%22%20fill%3D%22%238a5a00%22%3EBEISPIEL-SCREENSHOT%3C%2Ftext%3E%3Ctext%20x%3D%22718%22%20y%3D%22494%22%20text-anchor%3D%22middle%22%20font-size%3D%2213%22%20fill%3D%22%238a5a00%22%3EPlatzhalter%20%E2%80%93%20hier%20eigenen%20Screenshot%20einf%C3%BCgen%3C%2Ftext%3E%3Ctext%20x%3D%22718%22%20y%3D%22513%22%20text-anchor%3D%22middle%22%20font-size%3D%2212%22%20fill%3D%22%23a07a2a%22%3EReservierung%20stornieren%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fsvg%3E",
       "alt": "Platzhalter: Dialog zur Stornierung",
       "caption": "",
       "markers": [
        {
         "x": 54,
         "y": 56.3,
         "label": "Stornogrund (Beispiel)"
        }
       ],
       "rights": "oeffentlich",
       "origin": "platzhalter",
       "captured": "",
       "pmsVersion": "",
       "capturedBy": "",
       "slot": "",
       "status": ""
      }
     ],
     "slots": []
    },
    {
     "title": "Bestätigung senden",
     "text": "Stornobestätigung an den Gast senden. [[Ablauf eintragen]]",
     "hint": "Die Storno- bzw. Bestätigungsnummer immer mit angeben, falls der Gast später nachfragt.",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    }
   ]
  },
  {
   "id": "schichtuebergabe",
   "type": "guide",
   "title": "Schichtübergabe an der Rezeption – Muster",
   "categoryId": "intern",
   "summary": "Was bei jeder Schichtübergabe besprochen und dokumentiert werden sollte.",
   "tags": [
    "Schichtübergabe",
    "Übergabe",
    "Dienstplan"
   ],
   "keywords": [],
   "example": true,
   "author": "Front Office (Beispiel)",
   "created": "2026-09-15T07:00:00.000Z",
   "updated": "2026-10-05T07:30:00.000Z",
   "body": "",
   "related": [
    "nachtdienst-checkliste",
    "telefonliste"
   ],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": [],
   "steps": [
    {
     "title": "Offene Anreisen durchgehen",
     "text": "Noch nicht angereiste Gäste, besondere Wünsche und späte Anreisen besprechen.",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Offene Zahlungen und Rechnungen",
     "text": "Offene Posten, abgelehnte Zahlungen und noch zu versendende Rechnungen übergeben.",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Weckrufe, Taxis und Reservierungen für Gäste",
     "text": "Zugesagte Weckrufe, Taxis oder Tischreservierungen übergeben. [[Wo werden Weckrufe dokumentiert?]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Besondere Vorkommnisse",
     "text": "Beschwerden, Störungen und Absprachen mit anderen Abteilungen weitergeben.",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Kasse übergeben",
     "text": "Kassenbestand gemäß Hausregel zählen und übergeben. [[Kassenregel eintragen]]",
     "hint": "Unstimmigkeiten sofort gemeinsam klären und dokumentieren.",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Übergabe dokumentieren",
     "text": "Die Übergabe im Übergabebuch festhalten. [[Ort bzw. Form des Übergabebuchs eintragen]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    }
   ]
  },
  {
   "id": "beschwerde-gast",
   "type": "guide",
   "title": "Umgang mit Gästebeschwerden – Muster",
   "categoryId": "gaeste",
   "summary": "Bewährter Ablauf, um Beschwerden ruhig und lösungsorientiert zu bearbeiten.",
   "tags": [
    "Beschwerde",
    "Reklamation",
    "Gästeanliegen"
   ],
   "keywords": [
    "unzufrieden",
    "Kompensation",
    "Entschuldigung"
   ],
   "example": true,
   "author": "Front Office (Beispiel)",
   "created": "2026-09-20T12:00:00.000Z",
   "updated": "2026-10-22T12:10:00.000Z",
   "body": "> [!TIPP]\n> Ruhig bleiben, nichts persönlich nehmen und keine Schuldzuweisungen an Kolleginnen und Kollegen.",
   "related": [
    "stoerung-wen-informieren"
   ],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": [],
   "steps": [
    {
     "title": "Zuhören",
     "text": "Den Gast ausreden lassen, aktiv zuhören und Notizen machen.",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Verständnis zeigen und entschuldigen",
     "text": "Verständnis für die Situation zeigen und sich für die Unannehmlichkeiten entschuldigen – auch wenn die Ursache noch unklar ist.",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Lösung anbieten",
     "text": "Eine konkrete Lösung anbieten oder verbindlich sagen, bis wann eine Lösung vorliegt. [[Befugnisse für Kompensationen an der Rezeption eintragen]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Weitergeben und dokumentieren",
     "text": "Die zuständige Abteilung informieren und die Beschwerde dokumentieren. [[Wo werden Beschwerden dokumentiert?]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Nachfassen",
     "text": "Später beim Gast nachfragen, ob die Lösung geholfen hat.",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    }
   ]
  },
  {
   "id": "fundsachen",
   "type": "guide",
   "title": "Fundsachen annehmen und herausgeben – Muster",
   "categoryId": "gaeste",
   "summary": "Vorlage für den Umgang mit gefundenen oder vergessenen Gegenständen.",
   "tags": [
    "Fundsachen",
    "Fundbüro",
    "vergessen"
   ],
   "keywords": [
    "liegen gelassen",
    "verloren",
    "gefunden"
   ],
   "example": true,
   "author": "Front Office (Beispiel)",
   "created": "2026-10-01T09:00:00.000Z",
   "updated": "2026-10-01T09:00:00.000Z",
   "body": "",
   "related": [],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": [],
   "steps": [
    {
     "title": "Fundsache annehmen",
     "text": "Gegenstand entgegennehmen und Fundort, Datum, Uhrzeit sowie Finder notieren. [[Wo wird das Fundbuch geführt?]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Sicher aufbewahren",
     "text": "Wertsachen getrennt und verschlossen aufbewahren. [[Aufbewahrungsort eintragen]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Herausgabe an Eigentümer",
     "text": "Nur gegen nachvollziehbaren Eigentumsnachweis herausgeben und die Herausgabe dokumentieren.",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Nach Ablauf der Frist",
     "text": "[[Interne Regel zu Aufbewahrungsfrist und weiterem Vorgehen eintragen]]",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    }
   ]
  },
  {
   "id": "drucker-druckt-nicht",
   "type": "troubleshooting",
   "title": "Rechnungsdrucker druckt nicht",
   "categoryId": "technik",
   "summary": "Wenn Rechnungen oder Belege nicht gedruckt werden: Ursachen der Reihe nach prüfen.",
   "tags": [
    "Drucker",
    "Rechnung drucken",
    "Druckerstörung"
   ],
   "keywords": [
    "druckt nicht",
    "Ausdruck",
    "Papierstau",
    "offline"
   ],
   "example": true,
   "author": "IT / Front Office (Beispiel)",
   "created": "2026-09-05T10:00:00.000Z",
   "updated": "2026-11-05T08:45:00.000Z",
   "body": "",
   "related": [
    "checkout-ablauf",
    "stoerung-wen-informieren"
   ],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": [],
   "troubleshooting": {
    "messages": [
     "Beispielmeldung: Drucker ist offline",
     "Beispielmeldung: Druckauftrag konnte nicht gesendet werden"
    ],
    "symptoms": "- Rechnung oder Beleg kommt nicht aus dem Drucker\n- Druckauftrag bleibt in der Warteschlange hängen\n- Drucker zeigt eine Fehlermeldung oder eine blinkende Anzeige",
    "causes": [
     {
      "title": "Papier leer oder Papierstau",
      "check": "Papierfach und Ausgabeschacht kontrollieren. Anzeigen am Drucker beachten.",
      "solution": "Papier nachlegen bzw. den Papierstau gemäß Anleitung des Druckers entfernen. Anschließend den Druck erneut starten."
     },
     {
      "title": "Drucker ausgeschaltet oder Kabel lose",
      "check": "Leuchtet die Betriebsanzeige? Sind Strom- und Netzwerk- bzw. USB-Kabel fest eingesteckt?",
      "solution": "Drucker einschalten bzw. Kabel fest einstecken, etwa eine Minute warten und den Druck erneut starten."
     },
     {
      "title": "Falscher Drucker ausgewählt",
      "check": "Prüfen, an welchen Drucker der Auftrag gesendet wurde. [[Wo wird der Rechnungsdrucker in protel ausgewählt?]]",
      "solution": "Richtigen Drucker auswählen und erneut drucken. [[Name des Rechnungsdruckers eintragen]]"
     },
     {
      "title": "Druckauftrag hängt in der Warteschlange",
      "check": "Die Druckwarteschlange über die Windows-Einstellungen (*Drucker und Scanner*) öffnen und nachsehen, ob ältere Aufträge feststecken.",
      "solution": "Hängende Aufträge abbrechen und den Druck erneut starten – sofern Ihre IT-Richtlinie dies erlaubt. [[Interne IT-Regel eintragen]]"
     }
    ],
    "escalation": "IT-Support informieren: [[Telefonnummer bzw. Ticketsystem eintragen]]\n\nÜbergangslösung: Rechnung an einem anderen freigegebenen Drucker drucken oder per E-Mail senden. [[Hausregel eintragen]]"
   }
  },
  {
   "id": "zimmerkarte-oeffnet-nicht",
   "type": "troubleshooting",
   "title": "Zimmerkarte öffnet die Tür nicht",
   "categoryId": "technik",
   "summary": "Ein Gast kommt zurück, weil die Schlüsselkarte nicht funktioniert – typische Ursachen und Lösungen.",
   "tags": [
    "Schlüsselkarte",
    "Zimmerkarte",
    "Türschloss"
   ],
   "keywords": [
    "Tür geht nicht auf",
    "Karte defekt",
    "Keycard"
   ],
   "example": true,
   "author": "Front Office (Beispiel)",
   "created": "2026-09-06T10:00:00.000Z",
   "updated": "2026-11-01T18:20:00.000Z",
   "body": "",
   "related": [
    "checkin-ablauf",
    "stoerung-wen-informieren"
   ],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": [],
   "troubleshooting": {
    "messages": [],
    "symptoms": "- Das Türschloss reagiert nicht oder zeigt ein Warnsignal\n- Die Karte funktioniert an einer Tür, aber nicht an einer anderen (z. B. Zimmer, Aufzug, Parkhaus)",
    "causes": [
     {
      "title": "Karte nicht oder falsch codiert",
      "check": "Für welches Zimmer und welchen Zeitraum wurde die Karte erstellt? [[Wie lässt sich eine Karte am Codierer prüfen?]]",
      "solution": "Karte für das richtige Zimmer und den richtigen Zeitraum neu erstellen. [[Bedienschritte eintragen]]"
     },
     {
      "title": "Karte durch Magnet oder Smartphone beeinträchtigt",
      "check": "Wurde die Karte zusammen mit dem Smartphone, einer Magnethülle oder anderen Karten aufbewahrt?",
      "solution": "Karte neu erstellen und den Gast bitten, sie getrennt vom Smartphone aufzubewahren."
     },
     {
      "title": "Gültigkeit abgelaufen (z. B. nach Verlängerung)",
      "check": "Wurde der Aufenthalt verlängert, die Karte aber nicht angepasst?",
      "solution": "Karte mit dem neuen Abreisedatum neu erstellen."
     },
     {
      "title": "Batterie des Türschlosses schwach oder Schloss defekt",
      "check": "Funktionieren auch neu erstellte Karten nicht? Zeigt das Schloss ein besonderes Signal? [[Signalbedeutung laut Hersteller eintragen]]",
      "solution": "Haustechnik informieren und den Gast bis zur Behebung unterstützen. [[Ablauf für eine Notöffnung eintragen]]"
     }
    ],
    "escalation": "Haustechnik bzw. Bereitschaft informieren: [[Kontakt eintragen]]\n\n> [!WICHTIG]\n> Zimmer nur nach Prüfung der Identität des Gastes öffnen."
   }
  },
  {
   "id": "kartenzahlung-abgelehnt",
   "type": "troubleshooting",
   "title": "Kartenzahlung wird abgelehnt",
   "categoryId": "kasse",
   "summary": "Was tun, wenn eine Zahlung mit Kredit- oder Debitkarte am Terminal nicht funktioniert?",
   "tags": [
    "Kartenzahlung",
    "Kreditkarte",
    "EC-Karte",
    "Terminal"
   ],
   "keywords": [
    "Zahlung abgelehnt",
    "Girocard",
    "Kartenterminal"
   ],
   "example": true,
   "author": "Front Office (Beispiel)",
   "created": "2026-09-08T10:00:00.000Z",
   "updated": "2026-10-20T10:00:00.000Z",
   "body": "",
   "related": [
    "zahlungsproblem-checkout",
    "checkout-ablauf"
   ],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": [],
   "troubleshooting": {
    "messages": [
     "Beispielmeldung: Zahlung abgelehnt",
     "Beispielmeldung: Keine Verbindung zum Zahlungsdienst"
    ],
    "symptoms": "- Das Terminal meldet eine Ablehnung oder einen Abbruch\n- Das Terminal reagiert nicht oder hat keine Verbindung",
    "causes": [
     {
      "title": "Eingabe- oder Lesefehler",
      "check": "Wurde die PIN korrekt eingegeben? Wurde die Karte richtig eingesteckt bzw. lange genug an das Terminal gehalten?",
      "solution": "Zahlung erneut versuchen, ggf. per Chip statt kontaktlos (oder umgekehrt)."
     },
     {
      "title": "Terminal ohne Verbindung",
      "check": "Zeigt das Terminal eine Verbindungsmeldung? Sind Netzwerk- und Stromkabel eingesteckt?",
      "solution": "Terminal gemäß Herstelleranleitung neu starten. [[Interne Anleitung zum Neustart eintragen]]"
     },
     {
      "title": "Zahlung wird von der Bank abgelehnt",
      "check": "Wiederholt sich die Ablehnung trotz korrekter Eingabe?",
      "solution": "Den Gast höflich und diskret um eine andere Zahlungsart bitten. Die Gründe für eine Ablehnung kennt nur die Bank des Gastes."
     }
    ],
    "escalation": "Bei technischen Störungen den Zahlungsdienstleister kontaktieren: [[Hotline eintragen]]\n\n> [!WARNUNG]\n> Kartendaten niemals notieren, fotografieren oder per E-Mail weitergeben."
   }
  },
  {
   "id": "anmeldung-nicht-moeglich",
   "type": "troubleshooting",
   "title": "Anmeldung am Rezeptions-PC oder im Hotelprogramm nicht möglich",
   "categoryId": "technik",
   "summary": "Benutzername oder Passwort werden nicht akzeptiert, oder das Programm startet nicht.",
   "tags": [
    "Anmeldung",
    "Login",
    "Passwort"
   ],
   "keywords": [
    "einloggen",
    "Kennwort",
    "gesperrt"
   ],
   "example": true,
   "author": "IT (Beispiel)",
   "created": "2026-09-09T10:00:00.000Z",
   "updated": "2026-10-11T09:00:00.000Z",
   "body": "",
   "related": [
    "stoerung-wen-informieren"
   ],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": [],
   "troubleshooting": {
    "messages": [
     "Beispielmeldung: Benutzername oder Passwort falsch"
    ],
    "symptoms": "- Die Anmeldung wird abgelehnt\n- Das Benutzerkonto ist gesperrt\n- Das Programm startet nicht oder bleibt beim Laden stehen",
    "causes": [
     {
      "title": "Feststelltaste oder Tastaturlayout",
      "check": "Ist die Feststelltaste aktiv? Ist das richtige Tastaturlayout (DE) eingestellt?",
      "solution": "Feststelltaste ausschalten bzw. das Tastaturlayout mit {{Win+Leertaste}} wechseln und erneut versuchen."
     },
     {
      "title": "Passwort abgelaufen oder vergessen",
      "check": "Wurde kürzlich eine Passwortänderung angekündigt?",
      "solution": "[[Internen Ablauf zum Zurücksetzen des Passworts eintragen]]"
     },
     {
      "title": "Benutzerkonto gesperrt",
      "check": "Wurde das Passwort mehrfach falsch eingegeben?",
      "solution": "[[Wer kann Benutzerkonten entsperren? Kontakt eintragen]]"
     },
     {
      "title": "Keine Netzwerkverbindung",
      "check": "Zeigt das Netzwerksymbol in der Taskleiste eine Störung? Ist das Netzwerkkabel eingesteckt?",
      "solution": "Kabel prüfen. Sind auch andere PCs betroffen, sofort die IT informieren."
     }
    ],
    "escalation": "IT-Support: [[Kontakt eintragen]]\n\nZugangsdaten niemals weitergeben oder aufschreiben."
   }
  },
  {
   "id": "early-checkin",
   "type": "decision",
   "title": "Gast möchte früher einchecken",
   "categoryId": "anreise",
   "summary": "Assistent für Anfragen nach einem frühen Check-in (Early Check-in).",
   "tags": [
    "Early Check-in",
    "früher Check-in",
    "Anreise"
   ],
   "keywords": [
    "früher anreisen",
    "Zimmer früher",
    "vor der Check-in-Zeit"
   ],
   "example": true,
   "author": "Front Office (Beispiel)",
   "created": "2026-09-18T10:00:00.000Z",
   "updated": "2026-11-04T13:00:00.000Z",
   "body": "Nutzen Sie diesen Assistenten, wenn ein Gast vor der regulären Check-in-Zeit ([[Uhrzeit eintragen]]) sein Zimmer beziehen möchte.",
   "related": [
    "checkin-ablauf"
   ],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": [],
   "tree": {
    "start": "n1",
    "nodes": [
     {
      "id": "n1",
      "kind": "question",
      "text": "Ist ein passendes Zimmer bereits **frei und bezugsfertig**?",
      "answers": [
       {
        "label": "Ja",
        "next": "n2"
       },
       {
        "label": "Nein",
        "next": "n3"
       },
       {
        "label": "Weiß ich nicht",
        "next": "n4"
       }
      ]
     },
     {
      "id": "n2",
      "kind": "question",
      "text": "Ist der frühe Check-in in der Rate enthalten oder bereits vereinbart?",
      "answers": [
       {
        "label": "Ja",
        "next": "n5"
       },
       {
        "label": "Nein",
        "next": "n6"
       }
      ]
     },
     {
      "id": "n3",
      "kind": "question",
      "text": "Wird in absehbarer Zeit ein passendes Zimmer fertig?",
      "answers": [
       {
        "label": "Ja",
        "next": "n7"
       },
       {
        "label": "Nein",
        "next": "n8"
       }
      ]
     },
     {
      "id": "n4",
      "kind": "result",
      "text": "Zimmerstatus prüfen [[Wie bzw. wo wird der Zimmerstatus geprüft?]] und ggf. beim Housekeeping nachfragen. Danach den Assistenten neu starten.",
      "tone": "info",
      "links": []
     },
     {
      "id": "n5",
      "kind": "result",
      "text": "Der Gast kann einchecken. Weiter mit dem Check-in-Ablauf.",
      "tone": "success",
      "links": [
       "checkin-ablauf"
      ]
     },
     {
      "id": "n6",
      "kind": "result",
      "text": "Frühen Check-in gegen Gebühr gemäß Hauspolitik anbieten: [[Preis bzw. Regel eintragen]]\n\nBei Zustimmung die Leistung buchen: [[Arbeitsschritt in protel eintragen]]",
      "tone": "warning",
      "links": [
       "checkin-ablauf"
      ]
     },
     {
      "id": "n7",
      "kind": "result",
      "text": "Dem Gast die voraussichtliche Wartezeit nennen, Gepäckaufbewahrung und ggf. ein Getränk anbieten. Housekeeping um Priorisierung bitten. [[Kontakt Housekeeping eintragen]]",
      "tone": "info",
      "links": [
       "telefonliste"
      ]
     },
     {
      "id": "n8",
      "kind": "result",
      "text": "Gepäckaufbewahrung anbieten, mit Einverständnis des Gastes eine Rufnummer für die Benachrichtigung notieren und Tipps für die Wartezeit geben.",
      "tone": "info",
      "links": []
     }
    ]
   }
  },
  {
   "id": "zahlungsproblem-checkout",
   "type": "decision",
   "title": "Zahlungsproblem beim Check-out",
   "categoryId": "kasse",
   "summary": "Assistent, wenn die Zahlung beim Check-out nicht wie geplant funktioniert.",
   "tags": [
    "Zahlung",
    "Check-out",
    "Kasse"
   ],
   "keywords": [
    "bezahlen geht nicht",
    "Rechnung offen",
    "Bezahlung"
   ],
   "example": true,
   "author": "Front Office (Beispiel)",
   "created": "2026-09-19T10:00:00.000Z",
   "updated": "2026-10-29T15:30:00.000Z",
   "body": "",
   "related": [
    "checkout-ablauf",
    "kartenzahlung-abgelehnt"
   ],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": [],
   "tree": {
    "start": "n1",
    "nodes": [
     {
      "id": "n1",
      "kind": "question",
      "text": "Welche Zahlungsart möchte der Gast nutzen?",
      "answers": [
       {
        "label": "Karte",
        "next": "n2"
       },
       {
        "label": "Bar",
        "next": "n3"
       },
       {
        "label": "Rechnung / Überweisung",
        "next": "n4"
       }
      ]
     },
     {
      "id": "n2",
      "kind": "question",
      "text": "Was passiert am Kartenterminal?",
      "answers": [
       {
        "label": "Zahlung wird abgelehnt",
        "next": "n5"
       },
       {
        "label": "Terminal reagiert nicht",
        "next": "n6"
       }
      ]
     },
     {
      "id": "n3",
      "kind": "question",
      "text": "Kann das Wechselgeld herausgegeben werden?",
      "answers": [
       {
        "label": "Ja",
        "next": "n7"
       },
       {
        "label": "Nein",
        "next": "n8"
       }
      ]
     },
     {
      "id": "n4",
      "kind": "question",
      "text": "Ist die Zahlung auf Rechnung für diesen Gast bzw. diese Firma freigegeben?",
      "answers": [
       {
        "label": "Ja",
        "next": "n9"
       },
       {
        "label": "Nein / unklar",
        "next": "n10"
       }
      ]
     },
     {
      "id": "n5",
      "kind": "result",
      "text": "Den Gast um einen erneuten Versuch oder eine andere Karte bitten. Details siehe Fehlerbehebung.",
      "tone": "warning",
      "links": [
       "kartenzahlung-abgelehnt"
      ]
     },
     {
      "id": "n6",
      "kind": "result",
      "text": "Terminal-Störung beheben (siehe Fehlerbehebung). Übergangsweise eine andere Zahlungsart anbieten.",
      "tone": "warning",
      "links": [
       "kartenzahlung-abgelehnt"
      ]
     },
     {
      "id": "n7",
      "kind": "result",
      "text": "Barzahlung annehmen, den Betrag nachzählen und den Beleg aushändigen.",
      "tone": "success",
      "links": []
     },
     {
      "id": "n8",
      "kind": "result",
      "text": "Wechselgeld gemäß Hausregel beschaffen. [[Wer gibt Wechselgeld aus?]]",
      "tone": "info",
      "links": []
     },
     {
      "id": "n9",
      "kind": "result",
      "text": "Rechnung als Zahlung auf Rechnung abschließen. [[Arbeitsschritt in protel eintragen]]",
      "tone": "success",
      "links": [
       "checkout-ablauf"
      ]
     },
     {
      "id": "n10",
      "kind": "result",
      "text": "Keine Zahlung auf Rechnung ohne Freigabe. Schichtleitung bzw. Front-Office-Leitung hinzuziehen: [[Kontakt eintragen]]",
      "tone": "danger",
      "links": [
       "telefonliste"
      ]
     }
    ]
   }
  },
  {
   "id": "stoerung-wen-informieren",
   "type": "decision",
   "title": "Störung: Wen informiere ich?",
   "categoryId": "intern",
   "summary": "Assistent zur richtigen Ansprechperson bei Störungen und Notfällen.",
   "tags": [
    "Störung",
    "Eskalation",
    "Notfall"
   ],
   "keywords": [
    "kaputt",
    "defekt",
    "funktioniert nicht",
    "Ansprechpartner"
   ],
   "example": true,
   "author": "Front Office (Beispiel)",
   "created": "2026-09-25T10:00:00.000Z",
   "updated": "2026-11-02T10:00:00.000Z",
   "body": "",
   "related": [
    "telefonliste"
   ],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": [],
   "tree": {
    "start": "n1",
    "nodes": [
     {
      "id": "n1",
      "kind": "question",
      "text": "Besteht eine **Gefahr für Personen** (z. B. Feuer, Rauch, Wasser, medizinischer Notfall)?",
      "answers": [
       {
        "label": "Ja",
        "next": "n5"
       },
       {
        "label": "Nein",
        "next": "n2"
       }
      ]
     },
     {
      "id": "n2",
      "kind": "question",
      "text": "Betrifft die Störung IT oder Software (PC, Drucker, Hotelprogramm, Netzwerk)?",
      "answers": [
       {
        "label": "Ja",
        "next": "n3"
       },
       {
        "label": "Nein",
        "next": "n4"
       }
      ]
     },
     {
      "id": "n3",
      "kind": "question",
      "text": "Sind mehrere Arbeitsplätze betroffen?",
      "answers": [
       {
        "label": "Ja",
        "next": "n6"
       },
       {
        "label": "Nein, nur einer",
        "next": "n7"
       }
      ]
     },
     {
      "id": "n4",
      "kind": "question",
      "text": "Betrifft es ein Gästezimmer oder die Haustechnik (Heizung, Licht, Wasser, Türschloss)?",
      "answers": [
       {
        "label": "Ja",
        "next": "n8"
       },
       {
        "label": "Nein",
        "next": "n9"
       }
      ]
     },
     {
      "id": "n5",
      "kind": "result",
      "text": "**Notruf 112** wählen und den Notfallplan des Hauses befolgen. [[Notfallplan bzw. Alarmierungskette eintragen]]\n\nDanach die Hoteldirektion bzw. Bereitschaft informieren.",
      "tone": "danger",
      "links": [
       "telefonliste"
      ]
     },
     {
      "id": "n6",
      "kind": "result",
      "text": "Sofort den IT-Support telefonisch informieren: [[Notfallnummer IT eintragen]]. Die Schichtleitung informieren.",
      "tone": "danger",
      "links": [
       "telefonliste"
      ]
     },
     {
      "id": "n7",
      "kind": "result",
      "text": "Zuerst selbst kurz prüfen (z. B. mit der passenden Fehlerbehebung), dann den IT-Support kontaktieren: [[Kontakt bzw. Ticketsystem eintragen]]",
      "tone": "info",
      "links": [
       "drucker-druckt-nicht",
       "anmeldung-nicht-moeglich"
      ]
     },
     {
      "id": "n8",
      "kind": "result",
      "text": "Haustechnik informieren: [[Kontakt eintragen]]. Den Gast über die voraussichtliche Dauer informieren und ggf. einen Zimmerwechsel anbieten.",
      "tone": "info",
      "links": [
       "zimmerkarte-oeffnet-nicht"
      ]
     },
     {
      "id": "n9",
      "kind": "result",
      "text": "Die diensthabende Schichtleitung informieren: [[Kontakt eintragen]]",
      "tone": "info",
      "links": [
       "telefonliste"
      ]
     }
    ]
   }
  },
  {
   "id": "telefonliste",
   "type": "info",
   "title": "Wichtige interne Kontakte – Vorlage",
   "categoryId": "intern",
   "summary": "Vorlage für die wichtigsten Ansprechpersonen und Durchwahlen.",
   "tags": [
    "Telefon",
    "Kontakte",
    "Durchwahl"
   ],
   "keywords": [
    "Telefonnummer",
    "Ansprechpartner",
    "Notfallnummer"
   ],
   "example": true,
   "author": "Front Office (Beispiel)",
   "created": "2026-09-01T08:00:00.000Z",
   "updated": "2026-10-02T08:00:00.000Z",
   "body": "> [!HINWEIS]\n> Alle Angaben sind Platzhalter. Bitte die tatsächlichen Kontakte eintragen und regelmäßig prüfen.\n\n| Bereich | Ansprechperson | Durchwahl | Erreichbar |\n|---|---|---|---|\n| Schichtleitung Rezeption | [[Name]] | [[Nr.]] | [[Zeiten]] |\n| Housekeeping | [[Name]] | [[Nr.]] | [[Zeiten]] |\n| Haustechnik / Bereitschaft | [[Name]] | [[Nr.]] | [[Zeiten]] |\n| IT-Support | [[Name bzw. Dienstleister]] | [[Nr.]] | [[Zeiten]] |\n| Küche / Frühstück | [[Name]] | [[Nr.]] | [[Zeiten]] |\n| Hoteldirektion | [[Name]] | [[Nr.]] | [[Zeiten]] |\n\n**Notruf (EU-weit):** {{112}} · Weitere Notrufnummern: [[eintragen]]",
   "related": [],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": []
  },
  {
   "id": "glossar-rezeption",
   "type": "info",
   "title": "Glossar: Begriffe an der Rezeption",
   "categoryId": "intern",
   "summary": "Kurze Erklärungen häufiger Fachbegriffe aus dem Hotelalltag.",
   "tags": [
    "Glossar",
    "Begriffe",
    "Fachbegriffe"
   ],
   "keywords": [
    "Bedeutung",
    "Abkürzung",
    "Was ist"
   ],
   "example": true,
   "author": "Front Office (Beispiel)",
   "created": "2026-09-01T08:00:00.000Z",
   "updated": "2026-09-30T08:00:00.000Z",
   "body": "- **Walk-in** – Gast ohne vorherige Reservierung.\n- **No-Show** – Gast mit Reservierung, der weder anreist noch storniert.\n- **Early Check-in** – Bezug des Zimmers vor der regulären Check-in-Zeit.\n- **Late Check-out** – Abreise nach der regulären Check-out-Zeit.\n- **Upgrade** – Zuteilung einer höherwertigen Zimmerkategorie.\n- **Overbooking** – mehr Reservierungen als verfügbare Zimmer.\n- **Folio / Gastrechnung** – Rechnungskonto, auf dem die Leistungen eines Gastes gebucht werden.\n- **Rate** – Preis bzw. Tarif für eine Zimmerkategorie einschließlich der vereinbarten Leistungen.\n- **Garantie** – Absicherung einer Reservierung, z. B. durch Kreditkarte oder Anzahlung.\n- **Day-Use** – Nutzung eines Zimmers tagsüber ohne Übernachtung.\n- **PMS** – Property-Management-System: die Hotelsoftware zur Verwaltung von Reservierungen, Zimmern und Rechnungen.",
   "related": [],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": []
  },
  {
   "id": "nachtdienst-checkliste",
   "type": "info",
   "title": "Checkliste Nachtdienst – Vorlage",
   "categoryId": "nacht",
   "summary": "Abhakbare Checkliste für typische Aufgaben im Nachtdienst.",
   "tags": [
    "Nachtdienst",
    "Nachtaudit",
    "Tagesabschluss",
    "Checkliste"
   ],
   "keywords": [
    "Night Audit",
    "Nachtschicht"
   ],
   "example": true,
   "author": "Front Office (Beispiel)",
   "created": "2026-09-14T22:00:00.000Z",
   "updated": "2026-10-25T23:00:00.000Z",
   "body": "Die Häkchen dienen nur zur Orientierung während der Schicht und werden nicht gespeichert.\n\n### Vor Mitternacht\n- [ ] Offene Anreisen prüfen, späte Anreisen vormerken\n- [ ] No-Shows gemäß Hausregel behandeln [[Regel eintragen]]\n- [ ] Rechnungen der Abreisen des Folgetags vorbereiten\n\n### Tagesabschluss\n- [ ] Kassenabschluss gemäß Hausregel [[Ablauf eintragen]]\n- [ ] Tagesabschluss im Hotelprogramm durchführen [[Arbeitsschritte in protel eintragen]]\n- [ ] Berichte für den Folgetag ablegen [[Welche Berichte?]]\n\n### Vor Schichtende\n- [ ] Weckrufe erledigt\n- [ ] Frühstücksliste an die Küche übergeben\n- [ ] Übergabe an den Frühdienst – siehe [Schichtübergabe](#/artikel/schichtuebergabe)\n\n> [!WARNUNG]\n> Den Tagesabschluss nur nach interner Schulung und Freigabe durchführen.",
   "related": [
    "schichtuebergabe"
   ],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": []
  },
  {
   "id": "app-kurzanleitung",
   "type": "info",
   "title": "Protel Hilfe benutzen – Kurzanleitung",
   "categoryId": "app",
   "summary": "Die wichtigsten Funktionen dieser Wissensdatenbank auf einen Blick.",
   "tags": [
    "Hilfe",
    "Bedienung",
    "Suche",
    "Favoriten"
   ],
   "keywords": [
    "Anleitung App",
    "wie funktioniert"
   ],
   "example": false,
   "author": "Protel Hilfe",
   "created": "2026-11-01T08:00:00.000Z",
   "updated": "2026-11-06T08:00:00.000Z",
   "body": "### Suchen\n- Suchfeld oben anklicken oder {{Strg+K}} drücken. Ergebnisse erscheinen schon beim Tippen.\n- Die Suche findet auch **andere Begriffe** (Synonyme), z. B. „Abreise“ → „Check-out“.\n- **Tippfehler** werden toleriert: Die Suche findet trotzdem passende Artikel und schlägt die richtige Schreibweise vor („Meinten Sie …?“). Beispiele dafür stehen auf der Startseite unter „Probieren Sie“.\n- Mit {{Enter}} sehen Sie alle Ergebnisse, sortiert nach Relevanz und filterbar nach Typ und Kategorie.\n\n### Artikel nutzen\n- **Anleitungen:** Schritte lassen sich als *erledigt* abhaken. Screenshots per Klick vergrößern.\n- **Fehlerbehebung:** Ursachen der Reihe nach prüfen und mit „Problem gelöst“ bzw. „Hat nicht geholfen“ weitergehen.\n- **Entscheidungsbäume:** Fragen beantworten, bis die passende Lösung erscheint.\n- **Merken:** Häufig benötigte Artikel als Favorit speichern.\n- **Drucken:** Jeder Artikel lässt sich als übersichtlicher Ausdruck drucken.\n\n### Bearbeiten\nOben rechts **Bearbeiten** einschalten. Details: [Screenshot einfügen](#/artikel/app-screenshot-einfuegen) und [Wissensdatenbank verteilen](#/artikel/app-verteilen).",
   "related": [
    "app-screenshot-einfuegen",
    "app-verteilen",
    "app-artikel-schreiben"
   ],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": []
  },
  {
   "id": "app-screenshot-einfuegen",
   "type": "guide",
   "title": "Screenshot in einen Artikel einfügen",
   "categoryId": "app",
   "summary": "So ergänzen Sie Anleitungen mit eigenen Bildschirmfotos – inklusive nummerierter Markierungen.",
   "tags": [
    "Screenshot",
    "Bild",
    "Bearbeiten"
   ],
   "keywords": [
    "Bildschirmfoto",
    "Snipping Tool",
    "Bild einfügen"
   ],
   "example": false,
   "author": "Protel Hilfe",
   "created": "2026-11-01T08:00:00.000Z",
   "updated": "2026-11-06T08:10:00.000Z",
   "body": "> [!WICHTIG]\n> Screenshots dürfen keine personenbezogenen Gästedaten enthalten. Verwenden Sie Testdaten oder schwärzen Sie sensible Bereiche vor dem Einfügen.",
   "related": [
    "app-verteilen",
    "app-artikel-schreiben"
   ],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": [],
   "steps": [
    {
     "title": "Bearbeitungsmodus einschalten",
     "text": "Oben rechts auf **Bearbeiten** klicken. Die Schaltfläche zeigt danach „Bearbeitung an“.",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Artikel zum Bearbeiten öffnen",
     "text": "Den gewünschten Artikel öffnen und auf **Bearbeiten** klicken – oder über **Neuer Artikel** eine neue Anleitung anlegen.",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Bildschirmausschnitt kopieren",
     "text": "In Windows {{Win+Umschalt+S}} drücken und den gewünschten Bereich mit der Maus aufziehen. Der Ausschnitt liegt danach in der Zwischenablage.",
     "hint": "Alternativ eine vorhandene Bilddatei (PNG, JPG) per Drag & Drop auf das Bildfeld ziehen oder über „Datei wählen …“ auswählen.",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "In den Schritt einfügen",
     "text": "Im Editor das Bildfeld des gewünschten Schritts anklicken und {{Strg+V}} drücken. Große Bilder werden automatisch verkleinert.",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Markierungen setzen (optional)",
     "text": "Auf **Markierungen setzen** klicken und anschließend im Bild auf die wichtigen Stellen klicken. Jede Markierung erhält eine Nummer und kann beschriftet werden.",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [
      {
       "id": "platzhalter-app-screenshot-einfuegen-5",
       "src": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20960%20560%22%20width%3D%22960%22%20height%3D%22560%22%20font-family%3D%22Segoe%20UI%2C%20Arial%2C%20sans-serif%22%3E%3Crect%20width%3D%22960%22%20height%3D%22560%22%20fill%3D%22%23e8ecf2%22%2F%3E%3Crect%20x%3D%2224%22%20y%3D%2220%22%20width%3D%22912%22%20height%3D%22520%22%20rx%3D%2212%22%20fill%3D%22%23fff%22%20stroke%3D%22%23c6cfdc%22%2F%3E%3Cpath%20d%3D%22M36%2020h888a12%2012%200%200%201%2012%2012v28H24V32a12%2012%200%200%201%2012-12z%22%20fill%3D%22%23dfe5ee%22%2F%3E%3Ccircle%20cx%3D%2248%22%20cy%3D%2240%22%20r%3D%226%22%20fill%3D%22%23ef6a5a%22%2F%3E%3Ccircle%20cx%3D%2268%22%20cy%3D%2240%22%20r%3D%226%22%20fill%3D%22%23f4bf4f%22%2F%3E%3Ccircle%20cx%3D%2288%22%20cy%3D%2240%22%20r%3D%226%22%20fill%3D%22%2361c554%22%2F%3E%3Ctext%20x%3D%22110%22%20y%3D%2245%22%20font-size%3D%2214%22%20fill%3D%22%235b6576%22%3EBeispiel-Fenster%20%E2%80%93%20Platzhalter%3C%2Ftext%3E%3Crect%20x%3D%2224%22%20y%3D%2260%22%20width%3D%22180%22%20height%3D%22480%22%20fill%3D%22%23f3f5f9%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%2286%22%20width%3D%22140%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22122%22%20width%3D%22122%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22158%22%20width%3D%22104%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22194%22%20width%3D%22140%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22230%22%20width%3D%22122%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22266%22%20width%3D%22104%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22302%22%20width%3D%22140%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22338%22%20width%3D%22122%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%2244%22%20y%3D%22374%22%20width%3D%22104%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23d6dde8%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%2284%22%20width%3D%22260%22%20height%3D%2214%22%20rx%3D%227%22%20fill%3D%22%23b9c7dc%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22124%22%20width%3D%22120%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22142%22%20width%3D%22320%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%23cfd8e5%22%2F%3E%3Crect%20x%3D%22590%22%20y%3D%22124%22%20width%3D%22100%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22590%22%20y%3D%22142%22%20width%3D%22320%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%23cfd8e5%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22194%22%20width%3D%22120%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22212%22%20width%3D%22320%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%23cfd8e5%22%2F%3E%3Crect%20x%3D%22590%22%20y%3D%22194%22%20width%3D%22100%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22590%22%20y%3D%22212%22%20width%3D%22320%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%23cfd8e5%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22264%22%20width%3D%22120%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22282%22%20width%3D%22320%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%23cfd8e5%22%2F%3E%3Crect%20x%3D%22590%22%20y%3D%22264%22%20width%3D%22100%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22590%22%20y%3D%22282%22%20width%3D%22320%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%23cfd8e5%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22334%22%20width%3D%22120%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22232%22%20y%3D%22352%22%20width%3D%22320%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%23cfd8e5%22%2F%3E%3Crect%20x%3D%22590%22%20y%3D%22334%22%20width%3D%22100%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%23c3cddb%22%2F%3E%3Crect%20x%3D%22590%22%20y%3D%22352%22%20width%3D%22320%22%20height%3D%2234%22%20rx%3D%227%22%20fill%3D%22%23fff%22%20stroke%3D%22%23cfd8e5%22%2F%3E%3Crect%20x%3D%22800%22%20y%3D%22420%22%20width%3D%22110%22%20height%3D%2238%22%20rx%3D%228%22%20fill%3D%22%238ea6d8%22%2F%3E%3Cg%3E%3Crect%20x%3D%22520%22%20y%3D%22440%22%20width%3D%22396%22%20height%3D%2284%22%20rx%3D%2212%22%20fill%3D%22%23fff8e1%22%20stroke%3D%22%23d99a00%22%20stroke-width%3D%222%22%20stroke-dasharray%3D%227%205%22%2F%3E%3Ctext%20x%3D%22718%22%20y%3D%22472%22%20text-anchor%3D%22middle%22%20font-size%3D%2219%22%20font-weight%3D%22700%22%20fill%3D%22%238a5a00%22%3EBEISPIEL-SCREENSHOT%3C%2Ftext%3E%3Ctext%20x%3D%22718%22%20y%3D%22494%22%20text-anchor%3D%22middle%22%20font-size%3D%2213%22%20fill%3D%22%238a5a00%22%3EPlatzhalter%20%E2%80%93%20hier%20eigenen%20Screenshot%20einf%C3%BCgen%3C%2Ftext%3E%3Ctext%20x%3D%22718%22%20y%3D%22513%22%20text-anchor%3D%22middle%22%20font-size%3D%2212%22%20fill%3D%22%23a07a2a%22%3EMarkierungen%20setzen%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fsvg%3E",
       "alt": "Beispielbild mit zwei nummerierten Markierungen",
       "caption": "",
       "markers": [
        {
         "x": 41.5,
         "y": 28.4,
         "label": "Erste Markierung – z. B. ein Eingabefeld"
        },
        {
         "x": 89,
         "y": 78.4,
         "label": "Zweite Markierung – z. B. eine Schaltfläche"
        }
       ],
       "rights": "oeffentlich",
       "origin": "platzhalter",
       "captured": "",
       "pmsVersion": "",
       "capturedBy": "",
       "slot": "",
       "status": ""
      }
     ],
     "slots": []
    },
    {
     "title": "Speichern",
     "text": "Auf **Speichern** klicken (oder {{Strg+S}}). Für andere PCs anschließend [exportieren und verteilen](#/artikel/app-verteilen).",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    }
   ]
  },
  {
   "id": "app-verteilen",
   "type": "guide",
   "title": "Wissensdatenbank auf alle Rezeptions-PCs verteilen",
   "categoryId": "app",
   "summary": "Änderungen werden zunächst lokal gespeichert. So bringen Sie den neuen Stand auf alle Arbeitsplätze.",
   "tags": [
    "Export",
    "Import",
    "Verteilen",
    "Netzlaufwerk"
   ],
   "keywords": [
    "aktualisieren",
    "synchronisieren",
    "Sicherung",
    "Backup"
   ],
   "example": false,
   "author": "Protel Hilfe",
   "created": "2026-11-01T08:00:00.000Z",
   "updated": "2026-11-06T08:20:00.000Z",
   "body": "**So funktioniert die Speicherung:** Die Inhalte stammen aus der Datei `data/wissensdatenbank.js` im App-Ordner. Änderungen, die Sie in der App vornehmen, werden zunächst nur im Browser dieses PCs gespeichert.\n\n> [!TIPP]\n> Liegt der App-Ordner auf einem Netzlaufwerk, genügt es, die Datei dort einmal zu ersetzen – alle PCs, die die App von dort öffnen, erhalten den neuen Stand.",
   "related": [
    "app-kurzanleitung"
   ],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": [],
   "steps": [
    {
     "title": "Änderungen an einem PC pflegen",
     "text": "Artikel möglichst an einem festen PC bearbeiten, damit sich Änderungen nicht überschneiden.",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Für den App-Ordner exportieren",
     "text": "Unter [Verwaltung](#/verwaltung) auf **Für App-Ordner exportieren** klicken. Die Datei `wissensdatenbank.js` wird im Download-Ordner gespeichert.",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Datei im App-Ordner ersetzen",
     "text": "Die heruntergeladene Datei in den Unterordner `data` der App kopieren und die vorhandene Datei ersetzen. Heißt sie z. B. `wissensdatenbank (1).js`, vorher umbenennen.",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "App auf allen PCs neu laden",
     "text": "Auf den anderen PCs die App neu öffnen oder {{F5}} drücken. Der neue Stand wird automatisch übernommen.",
     "hint": "Hat ein PC eigene, noch nicht exportierte Änderungen, fragt die App nach, welche Version verwendet werden soll.",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    },
    {
     "title": "Regelmäßig sichern",
     "text": "Zusätzlich unter Verwaltung eine **Sicherung (.json)** exportieren und sicher ablegen. Sie kann jederzeit wieder importiert werden.",
     "hint": "",
     "hintType": "tipp",
     "group": "",
     "images": [],
     "slots": []
    }
   ]
  },
  {
   "id": "app-artikel-schreiben",
   "type": "info",
   "title": "Gute Artikel schreiben – Tipps und Formatierung",
   "categoryId": "app",
   "summary": "Hinweise für verständliche Anleitungen und die Kurzschreibweise für Formatierungen.",
   "tags": [
    "Formatierung",
    "Schreiben",
    "Vorlage"
   ],
   "keywords": [
    "Markdown",
    "fett",
    "Liste",
    "Tabelle"
   ],
   "example": false,
   "author": "Protel Hilfe",
   "created": "2026-11-01T08:00:00.000Z",
   "updated": "2026-11-06T08:30:00.000Z",
   "body": "### Tipps für gute Artikel\n- **Ein Artikel – ein Thema.** Lieber mehrere kurze Artikel als einen langen.\n- **Titel wie eine Aufgabe oder ein Problem** formulieren: „Gast einchecken“, „Drucker druckt nicht“.\n- **Fehlermeldungen wörtlich** übernehmen – Mitarbeitende kopieren sie in die Suche.\n- **Schlagwörter** und **zusätzliche Suchbegriffe** pflegen, z. B. umgangssprachliche Begriffe.\n- **Platzhalter** `[[…]]` markieren offene Punkte. Unter *Verwaltung → Pflegebedarf* sehen Sie alle Artikel mit Platzhaltern.\n- Nach der inhaltlichen Prüfung den Haken **Beispielinhalt** entfernen.\n\n### Formatierung\n| Eingabe | Ergebnis |\n|---|---|\n| `**fett**` | **fett** |\n| `*kursiv*` | *kursiv* |\n| `- Punkt` | Aufzählung |\n| `1. Punkt` | nummerierte Liste |\n| `- [ ] Aufgabe` | abhakbare Checkliste |\n| `### Überschrift` | Zwischenüberschrift |\n| `{{Strg+S}}` | {{Strg+S}} |\n| `==wichtig==` | ==wichtig== |\n| `[[offener Punkt]]` | gelb markierter Platzhalter |\n| `[Text](#/artikel/ID)` | Link auf einen anderen Artikel |\n\n> [!TIPP]\n> Hinweisboxen beginnen mit `> [!HINWEIS]`, `> [!TIPP]`, `> [!WARNUNG]` oder `> [!WICHTIG]`. Der Text folgt in den nächsten Zeilen, jeweils mit `> ` am Anfang.",
   "related": [
    "app-screenshot-einfuegen"
   ],
   "visibility": "oeffentlich",
   "review": {
    "status": "",
    "checkedAt": "",
    "checkedBy": "",
    "pmsVersion": "",
    "nextReview": "",
    "note": ""
   },
   "sources": [],
   "after": "",
   "images": []
  }
 ]
};
