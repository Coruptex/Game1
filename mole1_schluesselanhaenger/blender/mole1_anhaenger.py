#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Molenfeuer Mole 1, Brunsbüttel – detailgetreues Modell für einen Schmuck-Schlüsselanhänger
==========================================================================================

Version 2: vollständig neu aufgebaut nach vier Referenzfotos (F1–F4, Messwerte und Quellen in REAL).
Getestet mit Blender 5.2.3 LTS (pip-Paket "bpy" 5.2.3); benötigt Blender >= 4.5
(Boolean-Solver "MANIFOLD").

Aufbau von unten nach oben:
  Granitsockel (4 Steinlagen im Läuferverband, Tür in Laibung mit Brettern und Bändern) –
  Abdeckplatte mit Schräge – schwarzer achteckiger Unterbau (Bogenfenster, Steigleiter) –
  achteckiger Trichter mit Leiteraussparung – runde untere Galerie (8 Pfosten, 4 Holme) –
  weißer achteckiger Turm (3 Treppenfenster, gravierte "1") – Kranz aus 32 Hohlkehl-Konsolen –
  runde obere Galerie (8 Pfosten, 4 Holme) – runde Laterne mit Zickzack-Sprossen –
  achtteilige Glockenhaube – Knauf mit Lüftungsschlitzen – Öse (anstelle der Wetterfahne).

Ausführen
---------
ACHTUNG: Das Skript leert die aktuelle Szene (Objekte, Collections, Netze) und baut sie neu auf.
Nur in einer neuen, leeren Datei oder in der mitgelieferten .blend ausführen.

* Blender-Oberfläche: Arbeitsbereich "Scripting" → Text → Öffnen → diese Datei → "Run Script".
  Ausgabeordner ist "export" neben der Skriptdatei bzw. neben der gespeicherten .blend
  (liegt die .blend bereits in einem Ordner "export", wird dieser verwendet).
* Konsole:                  blender -b -P mole1_anhaenger.py -- --out ./export [--hoehe 35]
* Python mit pip-Paket bpy: python mole1_anhaenger.py --out ./export [--hoehe 35]

Koordinaten: z = 0 ist die Unterkante des Granitsockels, z zeigt nach oben.
Vorderseite (−Y, Azimut 270°) = Tür, Blickrichtung wie Foto F4 vom Molenweg.
Die große "1" liegt auf der Fläche +X (Azimut 0°), d. h. von vorne gesehen rechts.
Azimut = Winkel in der Draufsicht, 0° = +X, gegen den Uhrzeigersinn.
Einheiten: 1 Blender-Einheit = 1 mm (Szene metrisch, Längeneinheit Millimeter).
"""
import bpy
import bmesh
import math
import os
import sys
import json

# ---------------------------------------------------------------------------
# 1) REALMASSE  (Meter, z = 0 Sockelunterkante)
#    Status: "Foto"      = an den Referenzfotos gemessen (Maßstab F4: 94,25 px/m über 13,40 m)
#            "belegt"    = aus schriftlicher Quelle
#            "Schätzung" = auf den Fotos nicht eindeutig messbar
#    F1 = Wasserseite (Blick auf "1" und Leiter), F2 = von der Elbe, F3 = erhöht, F4 = frontal Molenweg
# ---------------------------------------------------------------------------
REAL = {
    "H_GESAMT":         (13.40, "belegt", "Höhe bis Spitze der Wetterfahne (WSA); Maßstabsbezug für F4"),
    # Granitsockel
    "SOCKEL_SW":        (3.10, "Foto", "F4: 292 px Schlüsselweite"),
    "SOCKEL_H":         (1.645, "Foto", "F4: y 1305→1150"),
    "LAGEN_FUGEN":      ((0.50, 0.88, 1.24), "Foto", "F4: Lagerfugen y 1258/1222/1188"),
    "TUER_B":           (0.86, "Foto", "F4: Nische x 420–500"),
    "TUER_H":           (1.57, "Foto", "F4: Sturz y 1157"),
    "TUER_U":           (-0.04, "Foto", "F4: Nischenmitte x 460 (Achse 463,5)"),
    "TUER_LAIBUNG":     (0.22, "Schätzung", "Tiefe der Nische, aus dem Schattenwurf abgeschätzt"),
    "TUER_BAENDER":     ((0.39, 1.135), "Foto", "F4: Mitten der Bandringe y 1268/1198"),
    "TUER_RIEGEL":      (0.73, "Foto", "F4: Riegel y 1232–1242"),
    "KAPPE_SW":         (3.25, "Foto", "F4: 305 px"),
    "KAPPE_KANTE":      (0.18, "Foto", "F4: senkrechte Kante y 1150→1133"),
    "KAPPE_OK":         (2.016, "Foto", "F4: y 1115 (Schräge trifft Unterbau)"),
    # schwarzer Unterbau, Trichter, untere Galerie
    "UNTERBAU_SW_U":    (2.32, "Foto", "F4: 218 px"),
    "UNTERBAU_SW_O":    (2.17, "Foto", "F4: 204 px"),
    "TRICHTER_U":       (3.16, "Foto", "F4: y 1007 (Knick Unterbau/Trichter)"),
    "GALERIE1_UK":      (4.106, "Foto", "F4: y 918"),
    "GALERIE1_OK":      (4.265, "Foto", "F4: y 903 (weißer Bodenrand 0,16 m)"),
    "GALERIE1_D":       (5.30, "Foto", "F4: 500 px; Trichter oben = Achteck im Bodenkreis"),
    "GELAENDER1_HOLME": ((0.23, 0.50, 0.78), "Foto",
                         "F4: 3 Holme (Handlauf + 2); Mittel aus vorderem und hinterem Holm, x 330/680"),
    "LEITER_B":         (0.42, "Foto", "F1: 13 px"),
    "LEITER_SPROSSE":   (0.24, "Foto", "F1: Sprossenteilung 7,5 px"),
    "LEITER_AUSSPARUNG": (0.70, "Foto", "F1: helle Aussparung im Trichter 21 px"),
    # weißer Turm, Konsolen, obere Galerie
    "TURM_SW_U":        (1.93, "Foto", "F4: 182 px"),
    "TURM_SW_O":        (1.83, "Foto", "F4: 172 px"),
    "TURM_OK":          (6.865, "Foto", "F4: y 658 (Beginn Konsolenkranz)"),
    "EINS_UK":          (4.70, "Foto", "F1/F3: 0,44 m über Galerieboden"),
    "EINS_OK":          (6.44, "Foto", "F1/F3: 0,42 m unter dem Konsolenkranz"),
    "EINS_STAMM":       (0.26, "Foto", "F1: 7,5 px, F3: 6 px"),
    "KONSOLE_R0":       (0.90, "Foto", "F4: Fußpunkt der Hohlkehle am Turm"),
    "KONSOLE_RADIUS":   (0.62, "Foto", "F4: Außenkante = Viertelkreis-Hohlkehle R 0,62 (9 Punkte, ±2 cm)"),
    "GALERIE2_OK":      (7.586, "Foto", "F4: y 590"),
    "GALERIE2_D":       (2.95, "Foto", "F4: 283 px"),
    "GELAENDER2_HOLME": ((0.10, 0.30, 0.50, 0.71), "Foto",
                         "F4: 4 Holme; Mittel aus vorderem und hinterem Holm, x 350/565"),
    # Laterne, Dach, Knauf
    "LATERNE_D":        (1.74, "Foto", "F4: 165 px"),
    "GLAS_UK":          (8.38, "Foto", "F4: y 510 (Fußpunkte der Sprossen), perspektivisch korrigiert"),
    "GLAS_OK":          (8.97, "Foto", "F4: y 453 (Spitzen an den Ecken), perspektivisch korrigiert"),
    "TRAUFE":           (9.10, "Foto", "F4: y 447"),
    "DACH_SPITZE":      (10.43, "Foto", "F4: y 322"),
    "KNAUF_OK":         (11.14, "Foto", "F4: y 255 (darüber Wetterfahne bis 13,40 m)"),
}

# Dachprofil: (Höhe über Traufe [m], Radius in Segmentmitte [m]) – F4 zeilenweise gemessen.
# Die senkrechte Traufkante (F4 ≈ 0,04 m) wird im Modell mit TRAUFKANTE_MM ausgeführt (gießbar),
# der Schwung darüber beginnt entsprechend höher.
DACH_PROFIL = [(0.000, 1.020), (0.074, 0.980), (0.180, 0.865), (0.290, 0.810),
               (0.390, 0.780), (0.500, 0.750), (0.600, 0.716), (0.710, 0.684), (0.820, 0.652),
               (0.920, 0.610), (1.030, 0.557), (1.135, 0.450), (1.240, 0.220), (1.330, 0.170)]

# Knauf: (Höhe über Dachspitze [m], Radius [m]) – F4: Kragen, Ring, Lüfter mit Schlitzen, Kappe, Spitze
#   Wülste (Ring, Kappe) im Modell ≥ 0,2 mm hoch (real 0,06/0,04 m) → gießbar.
KNAUF_PROFIL = [(0.00, 0.18), (0.11, 0.16), (0.15, 0.16), (0.165, 0.19), (0.245, 0.19), (0.26, 0.15),
                (0.29, 0.14), (0.44, 0.14), (0.455, 0.16), (0.535, 0.16), (0.55, 0.12), (0.71, 0.03)]
KNAUF_SCHLITZE_Z = (0.31, 0.42)      # Lüftungsschlitze, Höhe über Dachspitze [m]

# Ausrichtung (Azimut der Achteckflächen in Grad)
#   Tür 270° (F4 frontal). Die "1": F1–F3 zeigen den Molenweg – und damit die Tür – links neben
#   der "1" → "1" auf 0°. Leiter: F1 zeigt sie auf der Nachbarfläche rechts der "1" → 45°.
AZ_TUER, AZ_EINS, AZ_LEITER = 270, 0, 45

# Fenster: (Bauteil, Azimut, Breite, Unterkante, Oberkante [m], Rundbogen, seitlicher Versatz u [m], Quelle)
#   u > 0 = von außen gesehen nach rechts. Die drei Turmfenster steigen wie bei einer Wendeltreppe an.
#   Höhen der Turmfenster perspektivisch korrigiert (Kamera F4 ≈ 90 m entfernt, Augenhöhe ≈ 1,2 m).
FENSTER = [
    ("Unterbau", 225, 0.18, 2.13, 3.12, True, 0.10, "F4: x 390–401, y 1008–1104"),
    ("Turm", 225, 0.17, 5.26, 5.61, True, 0.04, "F4: x 398–409, y 773–806"),
    ("Turm", 270, 0.16, 5.57, 5.90, False, 0.00, "F4: x 456–471, y 744–775"),
    ("Turm", 315, 0.17, 5.89, 6.23, True, -0.06, "F4: x 516–527, y 715–746; in F2/F3 links neben der „1“"),
]

# Stoßfugen je Steinlage als Bruchteile der Flächenbreite (F4, linke Schrägfläche; Läuferverband)
STOSSFUGEN = {"A": (1 / 6, 1 / 2, 5 / 6), "B": (1 / 3, 2 / 3)}
LAGEN_MUSTER = ("B", "A", "B", "A")   # von unten nach oben; unterste Lage in F4 verdeckt (Schätzung)

# ---------------------------------------------------------------------------
# 2) MODELL- UND FERTIGUNGSPARAMETER  (Millimeter im fertigen Anhänger)
#    Ziel: so viel Detail wie im Feinguss (gedrucktes Wachs-/Gussharzmodell) realistisch abformbar.
#    Feinteile unter ca. 0,3 mm sind als kritisch markiert (siehe Bericht).
# ---------------------------------------------------------------------------
P = {
    "GESAMTHOEHE_MM":        35.0,   # Sockelunterkante bis Oberkante Öse (ohne Schlüsselring)
    "SEGMENTE":              192,    # Auflösung runder Teile
    "UEBERLAPPUNG_MM":       0.08,   # Bauteile greifen ineinander → sichere Vereinigung
    # Gravuren / Reliefs
    "FUGE_BREITE_MM":        0.12,   # Mauerfugen (real ≈ 2–3 cm → 0,05–0,08 mm, für den Guss verbreitert)
    "FUGE_TIEFE_MM":         0.08,
    "BRETTER":               6,      # Türbretter (F4: senkrechte Fugen)
    "BRETTFUGE_B_MM":        0.06,
    "BRETTFUGE_T_MM":        0.05,
    "BESCHLAG_H_MM":         0.15,   # Türbänder (Höhe des Bandeisens)
    "BESCHLAG_VOR_MM":       0.07,
    "FENSTER_TIEFE_MM":      0.12,
    "EINS_TIEFE_MM":         0.20,   # gravierte "1" (zum Schwärzen geeignet)
    # Geländer (8 Pfosten an den Achteckecken, 4 Holme; oberster Holm = Handlauf, kräftiger)
    "PFOSTEN_ANZAHL":        8,
    "PFOSTEN1_MM":           0.30,
    "HOLM1_H_MM":            0.22,
    "HOLM1_T_MM":            0.28,
    "PFOSTEN2_MM":           0.28,
    "HOLM2_H_MM":            0.22,
    "HOLM2_T_MM":            0.26,
    "HANDLAUF_FAKTOR":       1.25,
    # Konsolen
    "KONSOLEN_ANZAHL":       32,     # F4: 14–16 je sichtbarer Hälfte
    "KONSOLE_DICKE_MM":      0.25,
    # Steigleiter (als Relief auf der Unterbaufläche)
    "LEITER_HOLM_B_MM":      0.22,
    "LEITER_HOLM_VOR_MM":    0.28,
    "LEITER_SPROSSE_H_MM":   0.20,
    "LEITER_SPROSSE_VOR_MM": 0.22,
    # Laterne / Dach
    "GLAS_TIEFE_MM":         0.12,
    "SPROSSE_LAT_B_MM":      0.20,
    "SPROSSE_LAT_T_MM":      0.16,
    "SIMS_VOR_MM":           0.08,
    "SIMS_H_MM":             0.20,   # Fensterbank unter dem Glasband (F4 y 510–515: ≈ 0,05 m → verstärkt)
    "DACH_SEGMENTE":         8,
    "DACH_WOELBUNG":         0.045,  # Segmente bauchig, Rippen 4,5 % weiter innen (F4: Kehlen an den Rippen)
    "DACH_NAHT_MM":          0.06,   # Falzgrat auf den Rippen
    "TRAUFKANTE_MM":         0.25,   # senkrechte Traufkante (real ≈ 0,04 m = 0,10 mm → für den Guss verstärkt)
    # Knauf und Öse (Öse ersetzt die 2,26 m hohe Wetterfahne)
    "KNAUF_FAKTOR":          1.92,   # Knauf radial verstärkt (Kraftfluss Öse → Dach), Proportionen wie F4
    "KNAUF_R_MIN_MM":        0.70,   # tragender Mindestquerschnitt Ø 1,4 mm (mit Schlitzen ≈ 1,37 mm²)
    "KNAUF_SCHLITZE":        8,
    "SCHLITZ_B_MM":          0.18,
    "SCHLITZ_T_MM":          0.12,
    "OESE_INNEN_D_MM":       3.60,
    "OESE_RING_RADIAL_MM":   1.30,
    "OESE_RING_AXIAL_MM":    1.90,
    "OESE_EINGRIFF_MM":      0.20,
}

OKT = math.pi / 8.0          # halber Mittelpunktswinkel des Achtecks (22,5°)
NAME_ENDKOERPER = "Mole1_Anhaenger_3D"
GRAVIERTE_TEILE = ("Sockel_Granit", "Unterbau_schwarz", "Turm_weiss", "Knauf")


# ---------------------------------------------------------------------------
# 3) MASSSTAB UND ABGELEITETE MODELLMASSE
# ---------------------------------------------------------------------------
def r_(k):
    return REAL[k][0]


def berechne_masse():
    oese_aussen = P["OESE_INNEN_D_MM"] + 2.0 * P["OESE_RING_RADIAL_MM"]
    s = (P["GESAMTHOEHE_MM"] - oese_aussen + P["OESE_EINGRIFF_MM"]) / r_("KNAUF_OK")
    m = {"s": s, "massstab": 1000.0 / s, "oese_aussen": oese_aussen}
    for k, (v, _, _) in REAL.items():
        if isinstance(v, (int, float)):
            m[k.lower()] = v * s
    m["galerie2_uk"] = (r_("TURM_OK") + r_("KONSOLE_RADIUS")) * s
    m["z_oese_unten"] = m["knauf_ok"] - P["OESE_EINGRIFF_MM"]
    m["oese_R"] = P["OESE_INNEN_D_MM"] / 2.0 + P["OESE_RING_RADIAL_MM"] / 2.0
    m["z_oese_mitte"] = m["z_oese_unten"] + oese_aussen / 2.0
    m["z_oben"] = m["z_oese_unten"] + oese_aussen
    return m


def umkreis(sw):
    """Umkreisradius eines regelmäßigen Achtecks aus seiner Schlüsselweite."""
    return sw / (2.0 * math.cos(OKT))


def sw_linear(sw0, z0, sw1, z1, z):
    return sw0 + (sw1 - sw0) * (z - z0) / (z1 - z0)


# ---------------------------------------------------------------------------
# 4) GEOMETRIE-HILFSFUNKTIONEN (alle erzeugen geschlossene, nach außen orientierte Netze)
# ---------------------------------------------------------------------------
def _objekt(name, verts, faces, coll):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    mesh.validate()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    coll.objects.link(obj)
    return obj


_phase_zaehler = [0]


def _phase(n):
    """Eindeutiger Drehversatz je Rotationskörper → keine deckungsgleichen Kanten bei der Vereinigung."""
    _phase_zaehler[0] += 1
    return (2.0 * math.pi / n) * ((0.618034 * _phase_zaehler[0]) % 1.0)


def loft(name, ringe, n, winkel0, coll):
    """Körper aus übereinanderliegenden regelmäßigen n-Ecken; ringe = [(Umkreisradius, z), ...]."""
    verts, faces = [], []
    for (rad, z) in ringe:
        for i in range(n):
            a = winkel0 + 2.0 * math.pi * i / n
            verts.append((rad * math.cos(a), rad * math.sin(a), z))
    for j in range(len(ringe) - 1):
        for i in range(n):
            a, b = j * n + i, j * n + (i + 1) % n
            faces.append((a, b, b + n, a + n))
    faces.append(tuple(reversed(range(n))))
    top0 = (len(ringe) - 1) * n
    faces.append(tuple(top0 + i for i in range(n)))
    return _objekt(name, verts, faces, coll)


def ring_prisma(name, r_aussen, r_innen, z0, z1, n, winkel0, coll):
    """Prismatischer Ring mit n-eckigem Außen- und Innenumriss (n groß = rund)."""
    verts = []
    for (rad, z) in ((r_aussen, z0), (r_aussen, z1), (r_innen, z0), (r_innen, z1)):
        for i in range(n):
            a = winkel0 + 2.0 * math.pi * i / n
            verts.append((rad * math.cos(a), rad * math.sin(a), z))
    ob, ot, ib, it = 0, n, 2 * n, 3 * n
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces += [(ob + i, ob + j, ot + j, ot + i), (ib + j, ib + i, it + i, it + j),
                  (ot + i, ot + j, it + j, it + i), (ob + j, ob + i, ib + i, ib + j)]
    return _objekt(name, verts, faces, coll)


def ring_rund(name, r_mitte, z_mitte, hoehe, dicke, coll):
    """Runder Holm/Ring mit Rechteckquerschnitt (hoehe × dicke)."""
    n = P["SEGMENTE"]
    return ring_prisma(name, r_mitte + dicke / 2.0, r_mitte - dicke / 2.0,
                       z_mitte - hoehe / 2.0, z_mitte + hoehe / 2.0, n, _phase(n), coll)


def rotationskoerper(name, profil, coll, n=None):
    """Rotationskörper um z; profil = [(r, z), ...] von unten nach oben, r == 0 → Pol."""
    n = n or P["SEGMENTE"]
    ph = _phase(n)
    verts, faces, ringe = [], [], []
    for (rad, z) in profil:
        if rad <= 1e-9:
            verts.append((0.0, 0.0, z))
            ringe.append(("pol", len(verts) - 1))
        else:
            start = len(verts)
            for i in range(n):
                a = ph + 2.0 * math.pi * i / n
                verts.append((rad * math.cos(a), rad * math.sin(a), z))
            ringe.append(("ring", start))
    for (ta, a0), (tb, b0) in zip(ringe[:-1], ringe[1:]):
        if ta == "ring" and tb == "ring":
            faces += [(a0 + i, a0 + (i + 1) % n, b0 + (i + 1) % n, b0 + i) for i in range(n)]
        elif ta == "pol" and tb == "ring":
            faces += [(a0, b0 + (i + 1) % n, b0 + i) for i in range(n)]
        elif ta == "ring" and tb == "pol":
            faces += [(a0 + i, a0 + (i + 1) % n, b0) for i in range(n)]
    if ringe[0][0] == "ring":
        faces.append(tuple(reversed(range(ringe[0][1], ringe[0][1] + n))))
    if ringe[-1][0] == "ring":
        faces.append(tuple(range(ringe[-1][1], ringe[-1][1] + n)))
    return _objekt(name, verts, faces, coll)


def zylinder(name, r, z0, z1, coll):
    return rotationskoerper(name, [(0.0, z0), (r, z0), (r, z1), (0.0, z1)], coll)


def quader(name, mitte, groesse, drehung_z, coll):
    """Quader; groesse = (radial/x, tangential/y, z); um die z-Achse gedreht."""
    cx, cy, cz = mitte
    hx, hy, hz = (g / 2.0 for g in groesse)
    ca, sa = math.cos(drehung_z), math.sin(drehung_z)
    verts = []
    for (x, y, z) in ((-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
                      (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)):
        verts.append((cx + x * ca - y * sa, cy + x * sa + y * ca, cz + z))
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return _objekt(name, verts, faces, coll)


def _v(a, b, f=1.0):
    return tuple(x + f * y for x, y in zip(a, b))


def _norm(a):
    laenge = math.sqrt(sum(x * x for x in a))
    return tuple(x / laenge for x in a)


def _kreuz(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def balken(name, p0, p1, breite, dicke, oben, coll, verlaengern=0.0):
    """Quader von p0 nach p1; Querschnitt breite × dicke, 'dicke' in Richtung 'oben'."""
    d = _norm(tuple(b - a for a, b in zip(p0, p1)))
    p0 = _v(p0, d, -verlaengern)
    p1 = _v(p1, d, verlaengern)
    s = _norm(_kreuz(d, oben))
    u = _norm(_kreuz(s, d))
    verts = []
    for p in (p0, p1):
        for (fs, fu) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            verts.append(_v(_v(p, s, fs * breite / 2.0), u, fu * dicke / 2.0))
    faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    return _objekt(name, verts, faces, coll)


def prisma_radial(name, profil, dicke, winkel, coll):
    """Senkrechtes, radial ausgerichtetes Prisma; profil = Polygon [(u, z), ...] (u = Radius)."""
    ca, sa = math.cos(winkel), math.sin(winkel)
    n = len(profil)
    verts = []
    for v in (-dicke / 2.0, dicke / 2.0):
        for (u, z) in profil:
            verts.append((u * ca - v * sa, u * sa + v * ca, z))
    faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))]
    faces += [(i, n + i, n + (i + 1) % n, (i + 1) % n) for i in range(n)]
    return _objekt(name, verts, faces, coll)


class Flaeche:
    """Ebene Außenfläche eines (verjüngten) Achtecks. Lokale Koordinaten: u nach rechts (von außen
    gesehen), w = senkrechte Höhe über z_bezug entlang der Fläche, d entlang der Außennormalen."""

    def __init__(self, az_grad, sw0, z0, sw1, z1, z_bezug):
        a = math.radians(az_grad)
        self.n = (math.cos(a), math.sin(a), 0.0)
        self.t = (-math.sin(a), math.cos(a), 0.0)
        beta = math.atan((sw0 - sw1) / 2.0 / (z1 - z0))
        self.cosb = math.cos(beta)
        self.e_hoch = (-math.sin(beta) * self.n[0], -math.sin(beta) * self.n[1], math.cos(beta))
        self.n_aus = (math.cos(beta) * self.n[0], math.cos(beta) * self.n[1], math.sin(beta))
        ap = sw_linear(sw0, z0, sw1, z1, z_bezug) / 2.0
        self.c = (ap * self.n[0], ap * self.n[1], z_bezug)
        self.breite = 2.0 * ap * math.tan(OKT)

    def punkt(self, u, w, d):
        p = _v(self.c, self.t, u)
        p = _v(p, self.e_hoch, w / self.cosb)
        return _v(p, self.n_aus, d)


def flaechen_prisma(name, umriss, fl, d0, d1, coll):
    """Polygon (u, w) auf einer Fläche, zwischen den Normalabständen d0 < d1 extrudiert."""
    n = len(umriss)
    verts = [fl.punkt(u, w, d0) for (u, w) in umriss] + [fl.punkt(u, w, d1) for (u, w) in umriss]
    faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return _objekt(name, verts, faces, coll)


def flaechen_ring(name, uc, wc, r_a, r_i, fl, d0, d1, coll, n=24):
    """Kreisring auf einer Fläche (Mittelpunkt uc, wc), zwischen d0 und d1 extrudiert."""
    verts = []
    for (rad, d) in ((r_a, d0), (r_a, d1), (r_i, d0), (r_i, d1)):
        for i in range(n):
            a = 2.0 * math.pi * i / n
            verts.append(fl.punkt(uc + rad * math.cos(a), wc + rad * math.sin(a), d))
    o0, o1, i0, i1 = 0, n, 2 * n, 3 * n
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces += [(o0 + i, o0 + j, o1 + j, o1 + i), (i0 + j, i0 + i, i1 + i, i1 + j),
                  (o1 + i, o1 + j, i1 + j, i1 + i), (o0 + j, o0 + i, i0 + i, i0 + j)]
    return _objekt(name, verts, faces, coll)


def rechteck(u0, u1, w0, w1):
    return [(u0, w0), (u1, w0), (u1, w1), (u0, w1)]


def bogenfenster(b, h, u=0.0, schritte=12):
    """Fensterumriss mit Halbkreis oben; Ursprung unten mittig (+u)."""
    r = b / 2.0
    pts = [(u - r, 0.0), (u + r, 0.0), (u + r, h - r)]
    for i in range(1, schritte):
        a = math.pi * i / schritte
        pts.append((u + r * math.cos(a), h - r + r * math.sin(a)))
    pts.append((u - r, h - r))
    return pts


def glyphe_eins(hoehe, stamm):
    """Serifenlose "1" wie an der Mole (F1–F3): Stamm mit schräger Fahne links oben, ohne Fuß.
    Ursprung unten mittig am Stamm; Fahne normiert auf die Höhe (F1 gemessen)."""
    h = hoehe
    x0, x1 = -stamm / 2.0, stamm / 2.0
    return [(x0, 0.0), (x1, 0.0), (x1, h), (x0, h),
            (x0 - 0.080 * h, 0.85 * h), (x0 - 0.084 * h, 0.62 * h), (x0, 0.71 * h)]


def oese(name, mitte_z, R, a, b, coll, nu=96, nv=32):
    """Öse als Ring mit elliptischem Querschnitt in der XZ-Ebene (Lochachse = Y)."""
    verts, faces = [], []
    for i in range(nu):
        u = 2.0 * math.pi * i / nu
        cu, su = math.cos(u), math.sin(u)
        for j in range(nv):
            v = 2.0 * math.pi * j / nv
            rr = R + a * math.cos(v)
            verts.append((rr * cu, b * math.sin(v), mitte_z + rr * su))
    for i in range(nu):
        for j in range(nv):
            i2, j2 = (i + 1) % nu, (j + 1) % nv
            faces.append((i * nv + j, i2 * nv + j, i2 * nv + j2, i * nv + j2))
    return _objekt(name, verts, faces, coll)


# ---------------------------------------------------------------------------
# 5) SZENE, MATERIALIEN, BOOLEAN
# ---------------------------------------------------------------------------
def szene_vorbereiten():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)
    for me in list(bpy.data.meshes):
        bpy.data.meshes.remove(me)
    for txt in list(bpy.data.texts):
        if txt.name.startswith("mole1_anhaenger"):
            bpy.data.texts.remove(txt)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 0.001
    sc.unit_settings.length_unit = "MILLIMETERS"
    _phase_zaehler[0] = 0
    return sc


def collection(name, eltern=None, versteckt=False):
    c = bpy.data.collections.new(name)
    (eltern or bpy.context.scene.collection).children.link(c)
    c.hide_render = versteckt
    return c


def ausblenden(coll, versteckt=True):
    """Collection im Viewport aus-/einblenden (Augen-Symbol im Outliner)."""
    def suche(lc):
        if lc.collection == coll:
            return lc
        for k in lc.children:
            r = suche(k)
            if r:
                return r
        return None
    lc = suche(bpy.context.view_layer.layer_collection)
    if lc:
        lc.hide_viewport = versteckt
    coll.hide_render = versteckt


def material(name, farbe, metall=0.0, rauheit=0.5):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*farbe, 1.0)
        bsdf.inputs["Metallic"].default_value = metall
        bsdf.inputs["Roughness"].default_value = rauheit
    mat.diffuse_color = (*farbe, 1.0)
    return mat


def material_setzen(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def boolean_anwenden(ziel, operanden_coll, operation):
    """Boolean mit Collection-Operanden (Solver MANIFOLD) auswerten und als festes Netz übernehmen."""
    mod = ziel.modifiers.new(name=f"Bool_{operation}", type="BOOLEAN")
    mod.operation = operation
    mod.operand_type = "COLLECTION"
    mod.collection = operanden_coll
    mod.solver = "MANIFOLD"
    dg = bpy.context.evaluated_depsgraph_get()
    neu = bpy.data.meshes.new_from_object(ziel.evaluated_get(dg))
    alt = ziel.data
    ziel.modifiers.remove(mod)
    ziel.data = neu
    if alt.users == 0:
        bpy.data.meshes.remove(alt)
    netz_bereinigen(ziel)
    return ziel


def netz_bereinigen(obj, toleranz=1e-6):
    """Dreiecksnetz erzwingen und entartete Elemente auflösen (exakter STL-Export)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="BEAUTY", ngon_method="BEAUTY")
    for _ in range(3):
        bmesh.ops.dissolve_degenerate(bm, dist=toleranz, edges=bm.edges[:])
        bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=toleranz)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3],
                              quad_method="BEAUTY", ngon_method="BEAUTY")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()


def netz_statistik(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    offen = sum(1 for e in bm.edges if not e.is_manifold)
    entartet = sum(1 for f in bm.faces if f.calc_area() < 1e-9)
    bm.free()
    return {"nicht_manifold_kanten": offen, "entartete_flaechen": entartet}


def ist_geschlossen(obj):
    return netz_statistik(obj)["nicht_manifold_kanten"] == 0


# ---------------------------------------------------------------------------
# 6) BAUTEILE
# ---------------------------------------------------------------------------
class Bau:
    """Sammelt Bauteile, Gravurkörper (Abzug) und Farbeinlagen für das Farbmodell."""

    def __init__(self, m):
        self.m = m
        self.s = m["s"]
        self.ov = P["UEBERLAPPUNG_MM"]
        self.c_teile = collection("01_Bauteile")
        self.c_hilf = collection("02_Hilfsgeometrie", versteckt=True)
        self.c_plus = collection("Hilf_Vereinigung", self.c_hilf, versteckt=True)
        self.c_minus = collection("Hilf_Gravuren_Aussparungen", self.c_hilf, versteckt=True)
        self.c_plus2 = collection("Hilf_Beschlaege_nach_Gravur", self.c_hilf, versteckt=True)
        self.c_einlagen = collection("Hilf_Farbeinlagen", self.c_hilf, versteckt=True)
        self.teile = []
        self.einlagen = []        # (Name, Umriss, Fläche, d0, d1, Farbgruppe)

    def plus(self, ob, gruppe, nach_gravur=False):
        ob["Baugruppe"] = gruppe
        ob["nach_gravur"] = nach_gravur
        self.teile.append(ob)
        return ob

    def gravur(self, name, umriss, fl, tiefe, farbgruppe=None):
        """Vertiefung (Abzug) mit optionaler Farbeinlage am Grund (nur Farbmodell)."""
        flaechen_prisma(name, umriss, fl, -tiefe, 0.5, self.c_minus)
        if farbgruppe:
            self.einlagen.append((name + "_Farbe", umriss, fl, -tiefe - 0.01, -tiefe + 0.03, farbgruppe))


def baue_sockel(b):
    m, s, ov = b.m, b.s, b.ov
    sw, h = m["sockel_sw"], m["sockel_h"]
    b.plus(loft("Sockel_Granit", [(umkreis(sw), 0.0), (umkreis(sw), h + ov)], 8, OKT, b.c_teile), "Sockel")
    # Abdeckplatte: senkrechte Kante, dann Schräge bis an den Unterbau (F4)
    b.plus(loft("Sockel_Abdeckplatte", [(umkreis(m["kappe_sw"]), h), (umkreis(m["kappe_sw"]), h + m["kappe_kante"]),
                                        (umkreis(m["unterbau_sw_u"]) - 0.02, m["kappe_ok"] + ov)], 8, OKT, b.c_teile),
           "Sockel")
    # Lagerfugen ringsum
    fb, ft = P["FUGE_BREITE_MM"], P["FUGE_TIEFE_MM"]
    lagen = [0.0] + [z * s for z in r_("LAGEN_FUGEN")] + [h]
    for i, zf in enumerate(lagen[1:-1], 1):
        ring_prisma(f"Fuge_Lager_{i}", umkreis(sw) + 0.5, umkreis(sw - 2 * ft), zf - fb / 2, zf + fb / 2,
                    8, OKT, b.c_minus)
    # Stoßfugen im Läuferverband (F4), Türbereich ausgespart
    tb, th, tu = m["tuer_b"], m["tuer_h"], m["tuer_u"]
    fw = sw * math.tan(OKT)
    for lage, kennung in enumerate(LAGEN_MUSTER):
        z0 = lagen[lage] if lage > 0 else -0.3
        z1 = lagen[lage + 1] if lage < 3 else h - 0.04
        for k in range(8):
            az = k * 45
            fl = Flaeche(az, sw, 0.0, sw, h, 0.0)
            for f in STOSSFUGEN[kennung]:
                u = (f - 0.5) * fw
                if az == AZ_TUER and abs(u - tu) < tb / 2 + fb and lagen[lage] < th:
                    continue
                flaechen_prisma(f"Fuge_Stoss_L{lage + 1}_{az:03d}_{f:.2f}", rechteck(u - fb / 2, u + fb / 2, z0, z1),
                                fl, -ft, 0.5, b.c_minus)
    # Tür in Laibung (F4): Nische, Brettfugen, Bänder mit Zierring, Riegel
    fl = Flaeche(AZ_TUER, sw, 0.0, sw, h, 0.0)
    tl = m["tuer_laibung"]
    nische = rechteck(tu - tb / 2, tu + tb / 2, -0.3, th)
    flaechen_prisma("Tuer_Nische", nische, fl, -tl, 0.5, b.c_minus)
    b.einlagen.append(("Tuer_Blatt_Farbe", rechteck(tu - tb / 2, tu + tb / 2, 0.0, th), fl, -tl - 0.01, -tl + 0.02,
                       "Tuer"))
    bb, bt = P["BRETTFUGE_B_MM"], P["BRETTFUGE_T_MM"]
    for i in range(1, P["BRETTER"]):
        u = tu - tb / 2 + i * tb / P["BRETTER"]
        flaechen_prisma(f"Tuer_Brettfuge_{i}", rechteck(u - bb / 2, u + bb / 2, -0.3, th - 0.05),
                        fl, -tl - bt, -tl + 0.01, b.c_minus)
    bh, bv = P["BESCHLAG_H_MM"], P["BESCHLAG_VOR_MM"]
    d0 = -tl - bt - 0.02                      # Beschläge reichen bis unter die Brettfugen (keine Hohlräume)
    for i, zb in enumerate(r_("TUER_BAENDER"), 1):
        w = zb * s
        u_l, u_r = tu - 0.10 * s, tu + tb / 2 + 0.05      # Bandeisen bis in die Laibung (Kloben am Rahmen)
        b.plus(flaechen_prisma(f"Tuer_Band_{i}", rechteck(u_l, u_r, w - bh / 2, w + bh / 2), fl, d0, -tl + bv,
                               b.c_teile), "Beschlag", nach_gravur=True)
        b.plus(flaechen_ring(f"Tuer_Band_{i}_Zierring", tu + 0.215 * s, w, 0.10 * s, 0.04 * s, fl, d0, -tl + bv,
                             b.c_teile), "Beschlag", nach_gravur=True)
        b.plus(flaechen_prisma(f"Tuer_Band_{i}_Kloben", rechteck(u_r - 0.21, u_r, w - 0.17, w + 0.17), fl, d0,
                               -tl + bv + 0.03, b.c_teile), "Beschlag", nach_gravur=True)
    w = r_("TUER_RIEGEL") * s
    b.plus(flaechen_prisma("Tuer_Riegel", rechteck(tu - 0.02 * s, tu + 0.11 * s, w - bh / 2, w + bh / 2), fl,
                           d0, -tl + bv, b.c_teile), "Beschlag", nach_gravur=True)


def baue_unterbau_trichter_leiter(b):
    m, s, ov = b.m, b.s, b.ov
    swu, swo = m["unterbau_sw_u"], m["unterbau_sw_o"]
    z0, z1, z_uk = m["kappe_ok"], m["trichter_u"], m["galerie1_uk"]
    sw_uk = sw_linear(swu, z0, swo, z1, z_uk)
    b.plus(loft("Unterbau_schwarz", [(umkreis(swu), z0 - ov), (umkreis(swo), z1), (umkreis(sw_uk), z_uk + ov)],
                8, OKT, b.c_teile), "Unterbau")
    # Trichter: unten = Unterbau, oben = Achteck im Kreis des Galeriebodens (F4 aufgehellt)
    r_boden = m["galerie1_d"] / 2.0
    trichter = loft("Trichter", [(umkreis(swo) - 0.01, z1), (r_boden - 0.05, z_uk + ov)], 8, OKT, b.c_teile)
    # Aussparung für die Leiter (F1)
    c_ausspar = collection("Hilf_Leiter_Aussparung", b.c_hilf, versteckt=True)
    az = math.radians(AZ_LEITER)
    breite = r_("LEITER_AUSSPARUNG") * s
    r_innen = sw_uk / 2.0 - 0.10
    tiefe = r_boden + 1.0 - r_innen
    rm = r_innen + tiefe / 2.0
    quader("Hilf_Leiter_Aussparung_Box", (rm * math.cos(az), rm * math.sin(az), (z1 + z_uk) / 2),
           (tiefe, breite, (z_uk - z1) + 2 * ov), az, c_ausspar)
    boolean_anwenden(trichter, c_ausspar, "DIFFERENCE")
    b.plus(trichter, "Trichter")
    # Steigleiter vom Sockel bis unter den Galerieboden (F1)
    fl = Flaeche(AZ_LEITER, swu, z0, swo, z1, z0)
    lb, hb, hv = r_("LEITER_B") * s, P["LEITER_HOLM_B_MM"], P["LEITER_HOLM_VOR_MM"]
    w0, w1 = 0.05 * s, z_uk - z0 + ov
    for i, u in enumerate((-lb / 2 + hb / 2, lb / 2 - hb / 2), 1):
        b.plus(flaechen_prisma(f"Leiter_Holm_{i}", rechteck(u - hb / 2, u + hb / 2, -0.25, w1), fl, -0.05, hv,
                               b.c_teile), "Leiter")
    sp, sv = P["LEITER_SPROSSE_H_MM"], P["LEITER_SPROSSE_VOR_MM"]
    teilung = r_("LEITER_SPROSSE") * s
    w, i = w0 + 0.5 * teilung, 0
    while w < z_uk - z0 - 0.4 * teilung:
        i += 1
        b.plus(flaechen_prisma(f"Leiter_Sprosse_{i:02d}", rechteck(-lb / 2 + hb / 2, lb / 2 - hb / 2, w - sp / 2,
                                                                     w + sp / 2), fl, -0.05, sv, b.c_teile), "Leiter")
        w += teilung
    # Bogenfenster im Unterbau (F4)
    for (teil, az_f, fb_m, zu, zo, bogen, u_m, _) in FENSTER:
        if teil != "Unterbau":
            continue
        flf = Flaeche(az_f, swu, z0, swo, z1, zu * s)
        um = bogenfenster(fb_m * s, (zo - zu) * s, u_m * s) if bogen else \
            rechteck((u_m - fb_m / 2) * s, (u_m + fb_m / 2) * s, 0.0, (zo - zu) * s)
        b.gravur(f"Fenster_Unterbau_{az_f}", um, flf, P["FENSTER_TIEFE_MM"], "Fenster")


def baue_galerie(b, name, z_uk, z_ok, durchmesser, holme_m, pfosten_mm, holm_h, holm_t, gruppe, fussleiste=False):
    """Runder Galerieboden mit Geländer. Pfosten und Holme sitzen an der Bodenkante (F4: Holmschleifen
    reichen etwas über den Bodenrand hinaus), Pfosten am Bodenrand befestigt.
    fussleiste: unterster Holm als geschlossene Leiste (Spalt zum Boden wäre nicht gießbar)."""
    s = b.s
    r = durchmesser / 2.0
    n = P["SEGMENTE"]
    b.plus(zylinder(f"{name}_Boden", r, z_uk, z_ok, b.c_teile), gruppe)
    r_g = r - 0.05
    hand_h = holm_h * P["HANDLAUF_FAKTOR"]
    z_top = z_ok + holme_m[-1] * s + hand_h / 2.0
    z_fuss = z_uk + 0.05
    for k in range(P["PFOSTEN_ANZAHL"]):
        az = OKT + 2.0 * math.pi * k / P["PFOSTEN_ANZAHL"]          # an den Achteckecken (F4)
        b.plus(quader(f"{name}_Pfosten_{k + 1}", (r_g * math.cos(az), r_g * math.sin(az), (z_fuss + z_top) / 2),
                      (pfosten_mm, pfosten_mm, z_top - z_fuss), az, b.c_teile), gruppe)
    for i, hm in enumerate(holme_m, 1):
        if i == 1 and fussleiste:
            b.plus(ring_prisma(f"{name}_Fussleiste", r_g + holm_t / 2.0, r_g - holm_t / 2.0, z_fuss,
                               z_ok + hm * s + holm_h / 2.0, n, _phase(n), b.c_teile), gruppe)
            continue
        hh = hand_h if i == len(holme_m) else holm_h
        b.plus(ring_rund(f"{name}_Holm_{i}", r_g, z_ok + hm * s, hh, holm_t, b.c_teile), gruppe)


def baue_turm(b):
    m, s, ov = b.m, b.s, b.ov
    swu, swo = m["turm_sw_u"], m["turm_sw_o"]
    z0, z1, z2 = m["galerie1_ok"], m["turm_ok"], m["galerie2_uk"]
    b.plus(loft("Turm_weiss", [(umkreis(swu), z0 - ov), (umkreis(swo), z1), (umkreis(swo), z2 + ov)], 8, OKT,
                b.c_teile), "Turm")
    for (teil, az_f, fb_m, zu, zo, bogen, u_m, _) in FENSTER:
        if teil != "Turm":
            continue
        fl = Flaeche(az_f, swu, z0, swo, z1, zu * s)
        um = bogenfenster(fb_m * s, (zo - zu) * s, u_m * s) if bogen else \
            rechteck((u_m - fb_m / 2) * s, (u_m + fb_m / 2) * s, 0.0, (zo - zu) * s)
        b.gravur(f"Fenster_Turm_{az_f}", um, fl, P["FENSTER_TIEFE_MM"], "Fenster")
    # Die "1" (F1–F3), graviert; Gesamtbreite (Stamm + Fahne) mittig auf der Fläche
    fl = Flaeche(AZ_EINS, swu, z0, swo, z1, m["eins_uk"])
    hoehe = m["eins_ok"] - m["eins_uk"]
    glyphe = [(u + 0.042 * hoehe, w) for (u, w) in glyphe_eins(hoehe, m["eins_stamm"])]
    b.gravur("Ziffer_1", glyphe, fl, P["EINS_TIEFE_MM"], "Ziffer")


def baue_konsolen(b):
    """Kranz aus Konsolen mit Hohlkehle (Viertelkreis R, Mittelpunkt außen-unten, F4)."""
    m, ov = b.m, b.ov
    z1, z2 = m["turm_ok"], m["galerie2_uk"]
    r0, a = m["konsole_r0"], m["konsole_radius"]
    r_deck = m["galerie2_d"] / 2.0 - 0.05
    u_in = m["turm_sw_o"] / 2.0 - 0.30
    kurve = []
    for i in range(25):
        phi = math.pi - (math.pi / 2.0) * i / 24.0
        u = min(r0 + a + a * math.cos(phi), r_deck)
        kurve.append((u, z1 + a * math.sin(phi)))
    profil = [(u_in, z1 - ov)] + kurve + [(kurve[-1][0], z2 + ov), (u_in, z2 + ov)]
    for k in range(P["KONSOLEN_ANZAHL"]):
        az = 2.0 * math.pi * k / P["KONSOLEN_ANZAHL"]
        b.plus(prisma_radial(f"Konsole_{k + 1:02d}", profil, P["KONSOLE_DICKE_MM"], az, b.c_teile), "Konsolen")


def baue_laterne(b):
    m, s, ov = b.m, b.s, b.ov
    r_l = m["laterne_d"] / 2.0
    z0, zg0, zg1, zt = m["galerie2_ok"], m["glas_uk"], m["glas_ok"], m["traufe"]
    sims = P["SIMS_H_MM"]
    b.plus(zylinder("Laterne_Unterteil", r_l, z0 - ov, zg0 - sims + ov, b.c_teile), "Laterne")
    b.plus(zylinder("Laterne_Fensterbank", r_l + P["SIMS_VOR_MM"], zg0 - sims, zg0, b.c_teile), "Laterne")
    b.plus(zylinder("Laterne_Glas", r_l - P["GLAS_TIEFE_MM"], zg0 - ov, zg1 + ov, b.c_teile), "Laterne_Glas")
    b.plus(zylinder("Laterne_Kranz", r_l, zg1, zt + ov, b.c_teile), "Laterne")
    # Zickzack-Sprossen: 8 "V", Fußpunkte auf den Flächenmitten, Spitzen oben an den Ecken (F4)
    rm = r_l - P["SPROSSE_LAT_T_MM"] / 2.0
    for k in range(8):
        a_fuss = math.radians(k * 45)
        for j, a_oben in enumerate((a_fuss - OKT, a_fuss + OKT)):
            p0 = (rm * math.cos(a_fuss), rm * math.sin(a_fuss), zg0)
            p1 = (rm * math.cos(a_oben), rm * math.sin(a_oben), zg1)
            radial = _norm(((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, 0.0))
            b.plus(balken(f"Laterne_Sprosse_{k * 2 + j + 1:02d}", p0, p1, P["SPROSSE_LAT_B_MM"],
                          P["SPROSSE_LAT_T_MM"], radial, b.c_teile, verlaengern=0.06), "Laterne")


def dach_glocke(name, m, coll):
    """Achtteilige Glockenhaube: Profil aus F4, Segmente bauchig, Rippen an den Achteckecken mit Falzgrat."""
    s = m["s"]
    n_seg = P["DACH_SEGMENTE"]
    proben = 24
    n = n_seg * proben
    zt = m["traufe"]
    r_bezug = 0.6 * s
    verts = []
    kante = P["TRAUFKANTE_MM"]
    ringe = [(zt, DACH_PROFIL[0][1] * s), (zt + kante, DACH_PROFIL[0][1] * s)]
    ringe += [(zt + kante + dz * s * (1.0 - kante / (DACH_PROFIL[-1][0] * s)), rr * s)
              for (dz, rr) in DACH_PROFIL[1:]]
    for (z, R) in ringe:
        for i in range(n):
            j = i % proben
            t = -1.0 + 2.0 * j / proben                     # −1 an der Rippe, 0 in der Segmentmitte
            r = R * (1.0 - P["DACH_WOELBUNG"] * t * t)
            if j == 0:
                r += P["DACH_NAHT_MM"] * min(1.0, R / r_bezug)
            a = OKT + 2.0 * math.pi * i / n                # Rippen bei 22,5° + k·45°
            verts.append((r * math.cos(a), r * math.sin(a), z))
    faces = []
    for j in range(len(ringe) - 1):
        for i in range(n):
            a0, b0 = j * n + i, j * n + (i + 1) % n
            faces.append((a0, b0, b0 + n, a0 + n))
    faces.append(tuple(reversed(range(n))))
    top = (len(ringe) - 1) * n
    faces.append(tuple(top + i for i in range(n)))
    return _objekt(name, verts, faces, coll)


def baue_dach_knauf_oese(b):
    m, s = b.m, b.s
    b.plus(dach_glocke("Dach_Glockenhaube", m, b.c_teile), "Dach")
    # Knauf: Höhen wie F4, Radien ×KNAUF_FAKTOR, mindestens KNAUF_R_MIN_MM (trägt die Öse)
    zd, zk = m["dach_spitze"], m["knauf_ok"]
    rmin, f = P["KNAUF_R_MIN_MM"], P["KNAUF_FAKTOR"]
    radien = [(max(f * r * s, rmin), zd + z * s) for (z, r) in KNAUF_PROFIL]
    # Hals reicht 0,35 mm weiter in den Ösenring hinein (unsichtbar) → kein Absatz/Spalt am Übergang
    profil = [(0.0, zd - 0.45), (radien[0][0], zd - 0.45)] + radien + [(rmin, zk + 0.35), (0.0, zk + 0.35)]
    b.plus(rotationskoerper("Knauf", profil, b.c_teile), "Knauf")
    za, ze = (zd + z * s for z in KNAUF_SCHLITZE_Z)
    r_l = max(f * 0.14 * s, rmin)
    for k in range(P["KNAUF_SCHLITZE"]):
        az = 2.0 * math.pi * k / P["KNAUF_SCHLITZE"] + OKT
        quader(f"Knauf_Schlitz_{k + 1}", (r_l * math.cos(az), r_l * math.sin(az), (za + ze) / 2),
               (2 * P["SCHLITZ_T_MM"], P["SCHLITZ_B_MM"], ze - za), az, b.c_minus)
    # Öse (ersetzt die Wetterfahne): Ring in der XZ-Ebene, Lochachse = Y
    b.plus(oese("Oese", m["z_oese_mitte"], m["oese_R"], P["OESE_RING_RADIAL_MM"] / 2.0,
                P["OESE_RING_AXIAL_MM"] / 2.0, b.c_teile), "Oese")


# ---------------------------------------------------------------------------
# 7) HAUPTABLAUF
# ---------------------------------------------------------------------------
SCHWARZ = ((0.035, 0.037, 0.04), 0.0, 0.5)
WEISS = ((0.86, 0.86, 0.84), 0.0, 0.45)
FARBEN = {   # Farbgebung des Originals (nur für die farbige Rekonstruktion)
    "Sockel": ("Granit", (0.36, 0.36, 0.34), 0.0, 0.8),
    "Unterbau": ("Anstrich_schwarz", *SCHWARZ),
    "Trichter": ("Anstrich_schwarz", *SCHWARZ),
    "Leiter": ("Anstrich_schwarz", *SCHWARZ),
    "Galerie1": ("Anstrich_weiss", *WEISS),
    "Turm": ("Anstrich_weiss", *WEISS),
    "Konsolen": ("Anstrich_weiss", *WEISS),
    "Galerie2": ("Anstrich_schwarz", *SCHWARZ),
    "Laterne": ("Anstrich_schwarz", *SCHWARZ),
    "Laterne_Glas": ("Laterne_Glas", (0.20, 0.32, 0.34), 0.0, 0.1),
    "Dach": ("Anstrich_weiss", *WEISS),
    "Knauf": ("Anstrich_weiss", *WEISS),
    "Oese": ("Silber_925", (0.90, 0.90, 0.92), 1.0, 0.32),
    "Tuer": ("Anstrich_tuergruen", (0.04, 0.22, 0.16), 0.0, 0.5),
    "Beschlag": ("Anstrich_schwarz", *SCHWARZ),
    "Fenster": ("Fensterglas", (0.02, 0.025, 0.03), 0.0, 0.15),
    "Ziffer": ("Anstrich_schwarz", *SCHWARZ),
}


def stl_export(obj, pfad):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.wm.stl_export(filepath=pfad, export_selected_objects=True, apply_modifiers=True,
                          global_scale=1.0, use_scene_unit=False, ascii_format=False,
                          forward_axis="Y", up_axis="Z")


def farbmodell(b, mats):
    """Farbige Rekonstruktion (Originalfarben) aus Kopien der Bauteile, Gravuren angewendet."""
    c = collection("04_Farbmodell_Rekonstruktion")
    for ob in b.teile:
        k = bpy.data.objects.new(ob.name + "_farbig", ob.data.copy())
        c.objects.link(k)
        if ob.name in GRAVIERTE_TEILE:
            boolean_anwenden(k, b.c_minus, "DIFFERENCE")
        material_setzen(k, mats[ob["Baugruppe"]])
    for (name, umriss, fl, d0, d1, gruppe) in b.einlagen:
        ob = flaechen_prisma(name, umriss, fl, d0, d1, b.c_einlagen)
        material_setzen(ob, mats[gruppe])
        b.c_einlagen.objects.unlink(ob)
        c.objects.link(ob)
    return c


def main(out_dir, blend_name="Mole1_Brunsbuettel_Anhaenger.blend"):
    os.makedirs(out_dir, exist_ok=True)
    szene_vorbereiten()
    m = berechne_masse()
    b = Bau(m)

    baue_sockel(b)
    baue_unterbau_trichter_leiter(b)
    baue_galerie(b, "Galerie_unten", m["galerie1_uk"], m["galerie1_ok"], m["galerie1_d"], r_("GELAENDER1_HOLME"),
                 P["PFOSTEN1_MM"], P["HOLM1_H_MM"], P["HOLM1_T_MM"], "Galerie1")
    baue_turm(b)
    baue_konsolen(b)
    baue_galerie(b, "Galerie_oben", m["galerie2_uk"], m["galerie2_ok"], m["galerie2_d"], r_("GELAENDER2_HOLME"),
                 P["PFOSTEN2_MM"], P["HOLM2_H_MM"], P["HOLM2_T_MM"], "Galerie2", fussleiste=True)
    baue_laterne(b)
    baue_dach_knauf_oese(b)

    mats = {g: material(n, f, me, ra) for g, (n, f, me, ra) in FARBEN.items()}
    nicht_geschlossen = []
    for ob in b.teile:
        material_setzen(ob, mats[ob["Baugruppe"]])
        if not ist_geschlossen(ob):
            nicht_geschlossen.append(ob.name)

    # --- Vereinigen → Gravuren abziehen → Beschläge ergänzen -------------------
    haupt = [o for o in b.teile if not o["nach_gravur"]]
    nach = [o for o in b.teile if o["nach_gravur"]]
    for o in haupt[1:]:
        b.c_plus.objects.link(o)
    for o in nach:
        b.c_plus2.objects.link(o)
    c_export = collection("03_Export_Anhaenger")
    final = bpy.data.objects.new(NAME_ENDKOERPER, haupt[0].data.copy())
    c_export.objects.link(final)
    boolean_anwenden(final, b.c_plus, "UNION")
    boolean_anwenden(final, b.c_minus, "DIFFERENCE")
    if nach:
        boolean_anwenden(final, b.c_plus2, "UNION")
    material_setzen(final, mats["Oese"])

    farbe = farbmodell(b, mats)
    ausblenden(b.c_teile)
    ausblenden(b.c_hilf)
    ausblenden(farbe)

    ergebnis = {
        "version": 2,
        "blender_version": bpy.app.version_string,
        "massstab": f"1:{m['massstab']:.0f}",
        "mm_pro_m": round(m["s"], 4),
        "teile_anzahl": len(b.teile),
        "teile_nicht_geschlossen": nicht_geschlossen,
        "gravurkoerper": len(b.c_minus.objects),
        "final_geschlossen": ist_geschlossen(final),
        "final_netz": netz_statistik(final),
        "final_vertices": len(final.data.vertices),
        "final_dreiecke": len(final.data.polygons),
        "ausrichtung_azimut_grad": {"Tuer": AZ_TUER, "Ziffer_1": AZ_EINS, "Leiter": AZ_LEITER},
        "fenster": [dict(zip(("bauteil", "azimut", "breite_m", "uk_m", "ok_m", "bogen", "u_m", "quelle"), f))
                    for f in FENSTER],
        "modellmasse_mm": {k: round(v, 4) for k, v in m.items()},
        "parameter": P,
        "realmasse": {k: {"wert_m": v[0], "status": v[1], "begruendung": v[2]} for k, v in REAL.items()},
        "dateien": {},
    }
    stl = os.path.join(out_dir, f"Mole1_Brunsbuettel_Anhaenger_{P['GESAMTHOEHE_MM']:.0f}mm.stl")
    stl_export(final, stl)
    ergebnis["dateien"]["stl"] = os.path.basename(stl)

    try:
        with open(os.path.abspath(__file__), encoding="utf-8") as f:
            txt = bpy.data.texts.new("mole1_anhaenger.py")
            txt.write(f.read())
    except (NameError, OSError):
        pass
    blend = os.path.join(out_dir, blend_name)
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    ergebnis["dateien"]["blend"] = os.path.basename(blend)
    with open(os.path.join(out_dir, "modell_parameter.json"), "w", encoding="utf-8") as f:
        json.dump(ergebnis, f, ensure_ascii=False, indent=2, default=str)
    print(json.dumps({k: v for k, v in ergebnis.items()
                      if k not in ("modellmasse_mm", "parameter", "realmasse", "fenster")},
                     ensure_ascii=False, indent=2))
    return ergebnis


def _argumente():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    out = None
    i = 0
    while i < len(argv):
        if argv[i] == "--out" and i + 1 < len(argv):
            out = argv[i + 1]
            i += 1
        elif argv[i] == "--hoehe" and i + 1 < len(argv):
            P["GESAMTHOEHE_MM"] = float(argv[i + 1])
            i += 1
        i += 1
    if out is None:
        basis = bpy.data.filepath and os.path.dirname(bpy.data.filepath)
        if not basis:
            try:
                basis = os.path.dirname(os.path.abspath(__file__))
            except NameError:
                basis = os.getcwd()
        out = basis if os.path.basename(basis) == "export" else os.path.join(basis, "export")
    return os.path.abspath(out)


if __name__ == "__main__":
    main(_argumente())
