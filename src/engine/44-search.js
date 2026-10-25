/* ============ Recherche intelligente (ARCHITRAFIC) ============
   Moteur commun aux apps du studio (copie du module 16-search d'ARCHIPLAN, avec un thésaurus routier) : insensible aux
   accents, à la casse, aux pluriels et aux tirets ; préfixes et fautes de frappe tolérés ; concepts métier (« vitesse »
   → B14, B33, zone 30… ; « déviation » → KD22, KD8, route barrée ; « balisage » → cônes, K2, séparateurs ; « engin » →
   tous les engins). Tous les mots de la requête doivent trouver une correspondance (ET), le classement vient du score. */
const sFold = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[’'`´]/g, ' ');
const S_KEEP = new Set(['bois', 'gris', 'bas', 'pays', 'mois', 'puits', 'os', 'gaz', 'plus', 'sous', 'dessous', 'dessus', 'vis', 'tapis', 'pvc', 'abs', 'eps', 'xps', 'pse', 'ba13', 'ips']);
function sStem(t){
  if (t.length <= 3 || /\d/.test(t) || S_KEEP.has(t)) return t;
  if (/(eaux|aux|eux)$/.test(t) && t.length > 4) return t.slice(0, -1);
  if (/[^s]s$/.test(t)) return t.slice(0, -1);
  return t;
}
const S_STOP = new Set(['de', 'd', 'du', 'des', 'le', 'la', 'les', 'l', 'un', 'une', 'en', 'et', 'a', 'au', 'aux', 'ou', 'par', 'pour', 'avec', 'dans', 'the', 'of']);
const sTokens = s => sFold(s).split(/[^a-z0-9]+/).filter(t => t && !S_STOP.has(t)).map(sStem);

/* ---------- thésaurus ARCHITRAFIC : concept → libellé | termes (un terme précédé de ~ sert à la requête mais
   n'étiquette pas automatiquement les éléments dont le nom le contient, parce qu'il est trop générique) ---------- */
const SYN = {
  travaux: 'Travaux / chantier|travaux,chantier,chantiers,ak5,signalisation temporaire,temporaire,provisoire,fond jaune,panneau jaune,jaune,ak,kc,kd,km,kr,classe k,travaux sur route,zone de travaux,en travaux,sortie de chantier,acces chantier,entree de chantier',
  signalisation: 'Signalisation|signalisation,panneau,panneaux,signal,signaux,panonceau,panonceaux,pancarte,plaque,signaletique,signalisation routiere,signalisation verticale,instruction interministerielle,iisr,police,panneau de police,classe,support,mat,poteau,pied,lest,trepied',
  danger: 'Danger|danger,dangers,triangle,triangulaire,panneau triangulaire,avertissement,avertir,attention,prudence,risque,risques,classe a,a,ak,dos d ane,cassis,retrecie,retrecissement,glissante,glissant,gravillons,projection,bouchon,accident,virage,virages,deformee,chaussee deformee,chute de pierres,autres dangers,feux temporaires,annonce de feux',
  interdiction: 'Interdiction|interdiction,interdictions,interdit,interdite,interdits,interdites,defense,defendu,prohibe,ne pas,sens interdit,panneau rond,rond,cercle rouge,rouge,b,classe b,circulation interdite,acces interdit,depasser,depassement,tourner,demi tour,klaxon,signaux sonores,fin d interdiction,fin de toutes les interdictions,b31',
  obligation: 'Obligation|obligation,obligations,obligatoire,obligatoires,fond bleu,bleu,rond bleu,direction obligatoire,directions obligatoires,contournement,contournement obligatoire,tout droit,a droite,a gauche,voie reservee,b21,b22,b27,chemin obligatoire,piste obligatoire',
  indication: 'Indication / direction|indication,indications,direction,directions,directionnel,fleche de direction,d21,panneau de direction,agglomeration,entree d agglomeration,sortie d agglomeration,eb10,eb20,c,classe c,carre,carre bleu,sens unique,c12,impasse,voie sans issue,c13a,priorite,c18,toilettes,ce15a,route a acces reglemente,c107,zone,entree de zone,sortie de zone,surelevation,c27,lieu amenage,parking,c1a,zone bleue,c4a',
  vitesse: 'Vitesse|vitesse,vitesses,limitation,limitations,limite,limite de vitesse,limitation de vitesse,b14,b33,fin de limitation,km/h,kmh,30,50,70,90,110,130,ralentir,ralentissez,ralentisseur,ralentisseurs,zone 30,b30,reduisez,reduisez votre vitesse,vitesse limitee,radar,surelevation,dos d ane,coussin,coussin berlinois,plateau',
  priorite: 'Priorité|priorite,priorites,prioritaire,prioritaires,cedez le passage,cedez,cedez-le-passage,stop,arret obligatoire,ab,classe ab,ab3a,ab4,ab6,ab7,intersection,intersections,carrefour,carrefours,giratoire,rond point,rond-point,priorite a droite,sens inverse,circulation venant en sens inverse,c18,b15,route prioritaire,fin de priorite,perte de priorite,regime de priorite',
  stationnement: 'Stationnement|stationnement,stationner,stationne,garer,parking,parkings,place,places,place de parking,arret,arret et stationnement,arret interdit,b6,b6a1,b6d,zone bleue,disque,c1a,c4a,livraison,livraisons,aire de livraison,interdit de stationner,neutralisation,neutraliser,places neutralisees,stationnement interdit,stationnement genant,fourriere,depose minute,pmr',
  deviation: 'Déviation|deviation,deviations,devier,devie,deviee,itineraire,itineraires,itineraire de deviation,itineraire conseille,kd,kd22,kd22a,kd22b,kd22c,kd22d,kd8,kd9,kd10,kd42,kd69,fin de deviation,presignalisation,presignalisation de deviation,fleche de deviation,detour,detours,detournement,contournement,route barree,barree,~barre,barrage,rue barree,rue fermee,fermee,fermeture,fermetures,route fermee,sauf riverains,riverains,acces riverains,impasse,impasse sauf riverains,c13a,voie sans issue,coupure,coupure de route,route coupee,circulation coupee,rabattement,changement d itineraire,trajet,parcours,allongement,kilometres supplementaires,temps supplementaire',
  pietons: 'Piétons|pieton,pietons,pietonne,pietonnes,pietonnier,pietonniers,passage pieton,passage pietons,passage pour pietons,passage protege,c20a,a13b,trottoir,trottoirs,trottoir ferme,trottoir barre,cheminement,cheminements,cheminement pieton,cheminement provisoire,pietons passez en face,passez en face,km9,aire pietonne,b54,zone de rencontre,b52,accessibilite,accessible,poussette,fauteuil roulant,marcheur,marcheurs,a pied,circulation pietonne,protection des pietons,passerelle,passerelle pietons,tunnel pieton,b9g,acces interdit aux pietons,chemin obligatoire pour pietons,b22b,ecole,ecoliers,sortie d ecole',
  cycles: 'Cycles|cycle,cycles,cycliste,cyclistes,velo,velos,bicyclette,bicyclettes,piste cyclable,bande cyclable,voie cyclable,amenagement cyclable,b22a,b9b,c113,a21,ak21,voie verte,b45a,double sens cyclable,dsc,trottinette,trottinettes,edp,mobilite douce,mobilites douces,vae,sas velo,debouche de cyclistes',
  bus: 'Transports en commun|bus,autobus,car,cars,autocar,transport en commun,transports en commun,tc,b27a,voie bus,couloir bus,voie reservee,arret de bus,arret bus,arrets de bus,abribus,tram,tramway,navette,navettes,ligne de bus,ligne,reseau de transport,ratp,tcl,keolis,transdev,scolaire,ramassage scolaire,car scolaire',
  poids_lourds: 'Poids lourds|poids lourd,poids lourds,pl,camion,camions,transport de marchandises,marchandises,b8,b4,matieres dangereuses,marchandises dangereuses,b18c,tonnage,tonnes,tonne,limitation de tonnage,b13,ptac,gabarit,gabarits,hauteur,hauteur limitee,largeur,largeur limitee,longueur,longueur limitee,b10a,b11,b12,sortie de camions,sortie d engins,sortie de vehicules,convoi,convoi exceptionnel,semi remorque,semi-remorque,remorque,porteur,livraison',
  balisage: 'Balisage|balisage,baliser,balise,balises,cone,cones,k5a,k5b,k5c,balise d alignement,balise de guidage,k2,barriere,barrieres,barriere de chantier,barriere de police,vauban,heras,cloture,clotures,cloture de chantier,grillage,palissade,palissades,separateur,separateurs,separateur modulaire,k16,gba,dba,glissiere,glissiere beton,glissieres,rubalise,ruban,ruban de chantier,piquet,piquets,k10,piquet mobile,plot,plots,quille,quilles,filet,filet de chantier,k8,panneau de position,kc1,signalisation de position,signalisation d approche,approche,position,fin de prescription,fin de chantier,fin,delimitation,delimiter,protection,proteger,securiser,securisation,mise en securite',
  feux: 'Feux / lumineux|feu,feux,feu tricolore,feux tricolores,feu de chantier,feux de chantier,kr11,alternat,alternat par feux,alternat manuel,piquet k10,signalisation lumineuse,lumineux,lumineuse,flr,fleche lumineuse,fleche lumineuse de rabattement,rabattement,pmv,message variable,messages variables,panneau a messages variables,panneau lumineux,gyrophare,gyrophares,tri flash,triflash,lanterne,lanternes,kr,feu de balisage,feux de balisage,eclairage de chantier,carrefour a feux,signaux lumineux,annonce de signaux lumineux,ak17,ak15,tempo,temporisation,cycle de feu,phase de feu',
  vehicule: 'Véhicules|vehicule,vehicules,voiture,voitures,auto,autos,automobile,automobiles,citadine,berline,break,suv,monospace,4x4,utilitaire,utilitaires,fourgon,fourgons,camionnette,camionnettes,pickup,pick up,benne,camion benne,porteur,camion porteur,semi,semi remorque,semi-remorque,remorque,bus,moto,motos,scooter,velo,deux roues,deux-roues,vl,vul,pl,engin,circulation,usager,usagers,conducteur,conducteurs,automobiliste,automobilistes,trafic routier,parc,flotte,couleur,coloris,repeindre',
  engins: 'Engins de chantier|engin,engins,engin de chantier,engins de chantier,pelle,pelle mecanique,pelleteuse,pelle sur chenilles,chenilles,mini pelle,minipelle,mini-pelle,chargeuse,chargeuse sur pneus,tractopelle,bouteur,bulldozer,niveleuse,tombereau,dumper,telescopique,chariot telescopique,manitou,compacteur,compacteurs,rouleau,rouleau compresseur,cylindre,tandem,finisseur,enrobe,enrobes,bitume,goudron,fraiseuse,raboteuse,rabotage,camion toupie,toupie,betonniere,beton,grue,grues,grue mobile,camion grue,camion plateau grue,plateau,nacelle,nacelles,vehicule nacelle,elagage,porte engins,porte-engins,porte char,hydrocureuse,curage,assainissement,balayeuse,balayeuse de voirie,nettoyage,attenuateur,attenuateur de choc,tma,vehicule de signalisation,fourgon de signalisation,camion de signalisation,terrassement,vrd,voirie,tranchee,tranchees,reseaux,fouille,fouilles',
  materiel: 'Équipements de chantier|bungalow,bungalows,base vie,base de vie,cabane de chantier,baraque,algeco,sanitaire,sanitaires,wc,wc de chantier,toilettes,toilette,benne a gravats,gravats,dechets,big bag,bigbag,big-bag,sable,tas de sable,terre,tas de terre,deblais,remblai,palette,palettes,palette de materiaux,materiaux,materiau,stockage,zone de stockage,aire de stockage,depot,conteneur,container,echafaudage,echafaudages,plaque de roulage,plaques de roulage,pont provisoire,passerelle,bordure,bordures,regard,regards,buse,buses,tuyau,tuyaux,canalisation,canalisations,compresseur,groupe electrogene,groupe,citerne,cuve',
  emprise: 'Emprise de chantier|emprise,emprises,emprise de chantier,zone de chantier,zone,zones,perimetre,perimetre de chantier,surface,occupation,occupation du domaine public,odp,domaine public,permission de voirie,permis de stationnement,arrete,arrete de circulation,arrete temporaire,arrete municipal,dossier d arrete,demande d arrete,dict,dt dict,clôturee,cloturee,grillagee,installation de chantier,installation,base chantier,neutralisation de voie,voie neutralisee,file neutralisee,chaussee,demi chaussee,largeur de chaussee,largeur de voie,largeur restante,gabarit restant',
  annotation: 'Annotation / flèche / cote|annotation,annotations,annoter,note,notes,texte,textes,commentaire,commentaires,remarque,remarques,etiquette,etiquettes,legende,legendes,fleche,fleches,sens de circulation,sens,cote,cotes,cotation,coter,mesure,mesures,mesurer,distance,distances,longueur,longueurs,largeur,largeurs,metre,metrer,regle,dimension,dimensions,interdistance,interdistances,espacement,espacements',
  giration: 'Giration|giration,girations,epure,epures,epure de giration,rayon de braquage,braquage,rayon de giration,rayon,manoeuvre,manoeuvres,manoeuvrer,largeur balayee,balayage,balayee,semi remorque,poids lourd,pompier,pompiers,camion de pompiers,vehicule de secours,secours,sdis,benne a ordures,camion poubelle,bom,ordures,bus articule,articule,demi tour,retournement,aire de retournement,tourne a gauche,tourne a droite,acces engins,acces pompiers,voie engins,voie echelle,gabarit de passage,passage',
  simulation: 'Simulation / trafic|simulation,simulations,simuler,simule,trafic,trafics,circulation,flux,debit,debits,vehicules par heure,vehicules/heure,veh/h,uvp,heure de pointe,heures de pointe,pointe,pointes,hyper pointe,creux,heure creuse,congestion,bouchon,bouchons,embouteillage,embouteillages,file d attente,files d attente,remontee de file,temps de parcours,temps perdu,retard,retards,comparaison,avant apres,avant / apres,avant,apres,impact,impacts,capacite,niveau de service,saturation,sature,fluide,fluidite,sens unique temporaire,alternat,feux de chantier,variante,variantes,variante d exploitation,exploitation,sous chantier,lecture,lancer,demarrer,stop,pause,vitesse de simulation,mix,repartition,part modale,parts modales,pieton,cycles,bus,poids lourds,comptage,comptages,trafic moyen journalier,tmja,tmj',
  phases: 'Phases|phase,phases,phasage,phaser,planning,calendrier,date,dates,du au,periode,periodes,duree,durees,etape,etapes,phasage automatique,chronologie,ordre des travaux,succession,enchainement,tranche,tranches,semaine,semaines,jour,jours,nuit,nuits,horaire,horaires,plage horaire',
  plan: 'Plan / export|plan,plans,plan de signalisation,plan de deviation,plan de balisage,plan de circulation,plan d installation,pic,pdf,dossier,dossier d arrete,dossier complet,export,exporter,exportation,imprimer,impression,mise en page,legende,cartouche,echelle,nord,dxf,dwg,image,png,jpg,capture,capture d ecran,partager,envoyer,enregistrer,sauvegarder,sauvegarde,fichier,fichiers,ouvrir,importer,import,nouveau,nouveau chantier,dupliquer,renommer,supprimer,archiplan,maquette,maquette archiplan,batiment,emprise du batiment,lien archiplan,cloud,synchroniser,liste,liste du materiel,quantitatif,quantites,metre,inventaire,nomenclature,notice,rapport,compte rendu',
  site: 'Lieu du chantier|lieu,lieux,site,adresse,adresses,commune,communes,ville,villes,village,rue,rues,nom de rue,avenue,boulevard,place,route,routes,departementale,nationale,autoroute,voie communale,chemin,cadastre,parcelle,carte,fond de carte,photo aerienne,ortho,orthophoto,satellite,relief,altitude,altitudes,ngf,pente,sens unique,sens uniques,batiments,batiment,arbres,arbre,vegetation,mettre a jour,donnees,osm,openstreetmap,ign,bd ortho,geolocalisation,gps,coordonnees,latitude,longitude,zone chargee,rayon,chercher une adresse,localiser,localisation,changer de lieu',
  nuit: 'Nuit / éclairage|nuit,nocturne,nocturnes,de nuit,travaux de nuit,eclairage,eclairer,eclaire,lampadaire,lampadaires,candelabre,candelabres,feux de position,feu de position,lanterne,lanternes,kr,obscurite,sombre,lumiere,lumieres,projecteur,projecteurs,mat d eclairage,tour d eclairage,ballon eclairant,visibilite,retroreflechissant,retroreflexion,classe 2,haute visibilite,gilet',
  rendu: 'Rendu / vues|rendu,rendus,3d,vue 3d,perspective,camera,point de vue,photo,photorealiste,realiste,ombre,ombres,soleil,ciel,vue plan,2d,vue de dessus,dessus,plan 2d,maquette 3d,visite,survol,zoom,zoomer,cadrer,recentrer,orbite,vue,vues,affichage,qualite,textures,arbres,batiments,relief,orthophoto',
  outil: 'Outils|outil,outils,commande,commandes,raccourci,raccourcis,clavier,touche,touches,menu,menus,action,actions,fonction,fonctions,fonctionnalite,fonctionnalites,aide,help,comment,comment faire,tutoriel,tuto,guide,mode,modes,selectionner,selection,selectionne,deplacer,deplacement,copier,copie,coller,dupliquer,rotation,tourner,pivoter,orienter,orientation,supprimer,effacer,annuler,retablir,refaire,undo,redo,masquer,afficher,cacher,montrer,placer,poser,positionner,ajouter,inserer,dessiner,tracer,trace,ligne,polyligne,glisser,glisser deposer,tactile,stylet,doigt,tablette,telephone,mobile,ordinateur,souris,molette,clic droit,menu contextuel,entree,echap,valider,terminer,point,points,retirer le point',
  tout: 'Tout afficher|tout,tous,toutes,all,*,liste,lister,voir tout,afficher tout,afficher toutes,toute la liste,tout voir',
};
/* index : terme (replié) → ensemble de concepts ; termes multi-mots séparés ; libellés */
const SYN_LABEL = {}, SYN_WORD = new Map(), SYN_PHRASE = [], SYN_TAGWORD = new Map();
for (const [k, v] of Object.entries(SYN)){
  const bar = v.indexOf('|'); SYN_LABEL[k] = v.slice(0, bar);
  for (let raw of v.slice(bar + 1).split(',')){
    raw = raw.trim(); if (!raw) continue; const weak = raw.startsWith('~'); if (weak) raw = raw.slice(1);
    const toks = sTokens(raw); if (!toks.length) continue;
    if (toks.length > 1){ SYN_PHRASE.push({p:toks.join(' '), k, n:toks.length, weak}); continue; }
    const t = toks[0]; (SYN_WORD.get(t) || SYN_WORD.set(t, new Set()).get(t)).add(k);
    if (!weak) (SYN_TAGWORD.get(t) || SYN_TAGWORD.set(t, new Set()).get(t)).add(k);
  }
}
SYN_PHRASE.sort((a, b) => b.n - a.n);
const synLabel = k => SYN_LABEL[k] || k;
/* concepts larges : quand un mot désigne aussi un concept précis (« châssis » → fenêtre et menuiserie), seul le précis est retenu */
const SYN_BROAD = new Set(['outil', 'travaux', 'vehicule', 'balisage', 'plan', 'rendu', 'tout', 'simulation', 'site', 'signalisation']);

/* ---------- requête : groupes de jetons + concepts ----------
   Chaque groupe est soit un mot (avec les concepts qu'il désigne), soit une expression du thésaurus (« couche
   intermédiaire », « lame d'air ») dont les mots restent disponibles pour une correspondance littérale. */
function sParseQuery(q){
  const toks = sTokens(q); if (!toks.length) return {groups:[], raw:''};
  const used = new Array(toks.length).fill(false), groups = [];
  for (const ph of SYN_PHRASE){ const pt = ph.p.split(' ');
    for (let i = 0; i + pt.length <= toks.length; i++){ if (used.slice(i, i + pt.length).some(Boolean)) continue; let ok = true; for (let j = 0; j < pt.length; j++) if (toks[i + j] !== pt[j]){ ok = false; break; }
      if (ok){ const g = {toks:pt.slice(), k:{[ph.k]:0.9}, phrase:true}; for (let j = 0; j < pt.length; j++) used[i + j] = true; groups.push({at:i, g}); } }
  }
  for (let i = 0; i < toks.length; i++){ if (used[i]) continue; const t = toks[i], k = {};
    for (const c of (SYN_WORD.get(t) || [])) k[c] = 0.82;
    // préfixe d'un terme du thésaurus (≥ 4 lettres) : « isol » → isolant, « acous » → acoustique (concept plus faible) ;
    // faute de frappe sur un terme (≥ 6 lettres, une lettre d'écart) : « isolent » → isolant
    if (t.length >= 4){ const tol = t.length >= 6 ? 1 : 0;
      for (const [w, set] of SYN_WORD){ if (w.length > t.length && w.startsWith(t)){ for (const c of set) k[c] = Math.max(k[c] || 0, 0.7); }
        else if (tol && w.length >= 6 && !Object.keys(k).length && sEdit(t, w, tol) <= tol){ for (const c of set) k[c] = Math.max(k[c] || 0, 0.66); } } }
    // un mot qui a un sens précis (« châssis » → fenêtre) ne déclenche pas en plus le concept large (menuiserie)
    if (Object.keys(k).some(c => !SYN_BROAD.has(c))) for (const c of Object.keys(k)) if (SYN_BROAD.has(c)) delete k[c];
    groups.push({at:i, g:{toks:[t], k, phrase:false}}); }
  groups.sort((a, b) => a.at - b.at);
  return {groups:groups.map(x => x.g), raw:q};
}

/* ---------- distance d'édition bornée (fautes de frappe) ---------- */
function sEdit(a, b, max){
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length; let prev = Array.from({length:n + 1}, (_, j) => j), cur = new Array(n + 1), prev2 = null;
  for (let i = 1; i <= m; i++){
    cur[0] = i; let rowMin = i;
    for (let j = 1; j <= n; j++){
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v; if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev; prev = cur; cur = new Array(n + 1);
  }
  return prev[n];
}
/* score d'un jeton de requête q face à un mot w de l'élément (0 = rien) */
function sTokScore(q, w){
  if (w === q) return 1;
  if (q.length >= 2 && w.startsWith(q)) return q.length <= 3 ? Math.max(0.55, 0.92 - (w.length - q.length) * 0.05) : 0.92 - Math.min(0.12, (w.length - q.length) * 0.012);
  if (w.length >= 4 && q.startsWith(w)) return 0.7;
  if (q.length >= 4 && w.length >= 4){
    const tol = q.length >= 9 ? 2 : q.length >= 6 ? 1 : 0;   // faute de frappe : « limitaion », « parpain »
    if (tol && sEdit(q, w, tol) <= tol) return 0.72;
    let p = 0; while (p < q.length && p < w.length && q[p] === w[p]) p++;
    if (p >= Math.max(4, Math.ceil(0.6 * Math.min(q.length, w.length)))) return 0.62;
    if (w.includes(q)) return 0.55;
  }
  return 0;
}

/* ---------- éléments indexés : {id, kind, nom, words:[...], tags:Set, cat, meta, ...} ---------- */
function sIndex(nom, {cat = '', kw = '', tags = [], canon = [], ord = 0} = {}){
  const words = sTokens(nom), kwords = sTokens(kw), cwords = sTokens(cat), T = new Set(tags.concat(canon));
  for (const w of words){ const ks = SYN_TAGWORD.get(w); if (ks) for (const k of ks) T.add(k); }
  // expressions dans le nom (« terre végétale », « pare pluie »)
  const joined = ' ' + words.join(' ') + ' ';
  for (const ph of SYN_PHRASE) if (!ph.weak && ph.n <= words.length && joined.includes(' ' + ph.p + ' ')) T.add(ph.k);
  return {nom, words, kwords, cwords, tags:T, canon:new Set(canon), cat, ord};
}
/* score global d'une requête analysée face à un élément indexé ; renvoie {s, why:[concepts]} ou null */
function sLit(q, ix){
  let best = 0;
  for (const w of ix.words){ const v = sTokScore(q, w); if (v > best) best = v; }
  if (best < 0.9) for (const w of ix.kwords){ const v = sTokScore(q, w) * 0.95; if (v > best) best = v; }
  if (!best) for (const w of ix.cwords){ const v = sTokScore(q, w) * 0.6; if (v > best) best = v; }
  return best;
}
function sScore(Q, ix){
  if (!Q.groups.length) return {s:1, why:[]};
  let sum = 0; const why = [];
  for (const g of Q.groups){
    let lit = 0; for (const t of g.toks){ const v = sLit(t, ix); if (!v){ lit = 0; break; } lit += v; } lit = lit / g.toks.length;
    let con = 0, by = null; for (const [k, w0] of Object.entries(g.k)) if (ix.tags.has(k)){ const w = w0 + (ix.canon.has(k) ? 0.04 : 0); if (w > con){ con = w; by = k; } }
    const best = Math.max(lit, con); if (!best) return null;
    sum += best; if (con > lit && by) why.push(by);
  }
  let s = sum / Q.groups.length;
  // bonus : début du nom identique au premier mot de la requête, noms courts
  const firstQ = Q.groups[0].toks[0]; if (firstQ && ix.words[0] && ix.words[0].startsWith(firstQ)) s += 0.05;
  s += Math.max(0, 0.03 - ix.words.length * 0.003);
  return {s, why:[...new Set(why)]};
}
/* recherche : items = [{ix, ...}] → [{item, s, why}] triés */
function smartSearch(query, items, {limit = 200, min = 0.62} = {}){
  const Q = sParseQuery(query); const out = [];
  for (const it of items){ const r = sScore(Q, it.ix); if (r && r.s >= min) out.push({item:it, s:r.s, why:r.why}); }
  out.sort((a, b) => (Math.abs(b.s - a.s) > 0.001 ? b.s - a.s : 0) || (a.item.ix.ord - b.item.ix.ord) || a.item.ix.nom.localeCompare(b.item.ix.nom, 'fr'));
  return out.slice(0, limit);
}
const sHasQuery = q => sTokens(q).length > 0;
/* surlignage des parties du nom qui correspondent (préfixes des jetons) */
function sHighlight(nom, query){
  const Q = sParseQuery(query); const qs = Q.groups.flatMap(g => g.toks).filter(t => t.length >= 2); if (!qs.length) return esc(nom);
  const src = String(nom ?? ''), folded = sFold(src); // même longueur que src ? pas garanti (ligatures) → on travaille caractère par caractère
  // positions des mots dans la chaîne repliée (sans ligatures la longueur est identique)
  if (folded.length !== src.length) return esc(src);
  const marks = new Array(src.length).fill(false);
  const re = /[a-z0-9]+/g; let m;
  while ((m = re.exec(folded))){ const w = m[0], st = sStem(w);
    for (const q of qs){ const v = sTokScore(q, st) || (w !== st ? sTokScore(q, w) : 0); if (v >= 0.5){ const n = v >= 0.9 || w.startsWith(q) ? Math.min(w.length, Math.max(q.length, v === 1 ? w.length : q.length)) : w.length; for (let i = 0; i < n; i++) marks[m.index + i] = true; } }
  }
  let out = '', open = false;
  for (let i = 0; i < src.length; i++){ if (marks[i] !== open){ out += marks[i] ? '<mark>' : '</mark>'; open = marks[i]; } out += esc(src[i]); }
  if (open) out += '</mark>';
  return out;
}


/* ---------- ARCHITRAFIC : étiquettes métier ---------- */
const CAT_TAGS = {temp:['travaux', 'signalisation'], dang:['danger', 'signalisation'], reg:['interdiction', 'signalisation'], ind:['indication', 'signalisation'], bal:['balisage'], veh:['vehicule'], eng:['engins', 'vehicule'], chan:['materiel']};
/* rôles des panneaux par code (en plus de ce que dit leur nom) */
const SIGN_ROLE_SETS = {
  vitesse: 'B14 B33 B30 B34 C27 AK32 A2b AK2 KC1_vitesse',
  interdiction: 'B0 B1 B2a B2b B3 B4 B6a1 B6d B7b B8 B9a B9b B9g B10a B11 B12 B13 B16 B18c B19 B31',
  obligation: 'B21_1 B21_2 B21a1 B21c1 B21c2 B21d1 B21e B22a B22b B27a',
  priorite: 'AB1 AB2 AB3a AB4 AB6 AB7 AB25 B15 C18',
  stationnement: 'B6a1 B6d C1a C4a',
  deviation: 'KD22a KD22b KD22c KD22d KD8 KD9 KD10 KD42 KD69 KR_ROUTE C13a KC1_impasse KM1 KM2 M1 M2',
  pietons: 'A13b C20a KM9 B22b B54 B52 B9g KC1_trottoir CE15a',
  cycles: 'B22a B9b C113 A21 AK21 B45a',
  bus: 'B27a',
  poids_lourds: 'B8 B4 B13 B10a B11 B12 B18c KC1_camions',
  travaux: 'AK1 AK2 AK3 AK3a AK3b AK4 AK5 AK14 AK15 AK17 AK21 AK22 AK30 AK31 AK32 K8 K10 KC1 KC1_chantier KC1_camions KC1_fin KC1_trottoir KC1_gravillons KC1_vitesse KC1_accesM KC1_commerces KC1_impasse KR_ROUTE KD22a KD22b KD22c KD22d KD8 KD9 KD10 KD42 KD69 KM1 KM2 KM9 KM9z K5a K5b K5c K2 KR11 FLR PMV K16x',
  feux: 'AK17 AK15 FEUX KR11 FLR PMV',
  danger: 'AK1 AK2 AK3 AK3a AK3b AK4 AK14 AK15 AK17 AK21 AK22 AK30 AK31 AK32',
  balisage: 'K5a K5b K5c K2 K16x GBAx VAUx HERx K10 K8',
  giration: 'semi porteur bus benne toupie porteEngins grue',
  nuit: 'KR11 FLR PMV FEUX',
};
const SIGN_ROLES = {};
for (const [k, ids] of Object.entries(SIGN_ROLE_SETS)) for (const id of ids.split(/\s+/)) (SIGN_ROLES[id] ??= new Set()).add(k);
const libIxCache = new Map();
function libIndex(e){
  let ix = libIxCache.get(e.k); if (ix) return ix;
  const tags = [...(SIGN_ROLES[e.k] || []), ...(SIGN_ROLES[e.sign] || [])], canon = CAT_TAGS[e.cat] || [];
  const code = (e.ref || e.sign || e.k || ''), fam = code.replace(/[^A-Za-z].*$/, '');   // AK5 → AK, KD22a → KD
  const kw = [e.k, e.ref || '', e.sign || '', fam, LIB_CATS[e.cat] || ''].join(' ');
  const ord = Object.keys(LIB_CATS).indexOf(e.cat) * 1000;
  ix = sIndex(e.name, {cat:LIB_CATS[e.cat] || '', kw, tags, canon, ord}); libIxCache.set(e.k, ix); return ix;
}
const searchLib = (filter) => LIB.filter(e => !filter || filter(e)).map(e => ({id:e.k, e, ix:libIndex(e)}));
function elIndexAT(e){
  const KT = {obj:'', line:'balisage', zone:'emprise', closure:'deviation', detour:'deviation', pdetour:'pietons', note:'annotation', arrow:'annotation', dim:'annotation', swept:'giration', model:'plan'};
  const tags = KT[e.t] ? [KT[e.t]] : []; let kw = String(e.id) + ' ' + (EL_NAME[e.t] || '');
  if (e.t === 'obj'){ const L = LIBK[e.k]; if (L){ const lx = libIndex(L); for (const k of lx.tags) tags.push(k); kw += ' ' + lx.kwords.join(' '); } }
  if (e.t === 'line'){ const T = LINE_TYPES[e.k]; if (T) kw += ' ' + T.n + ' ' + (T.item || ''); }
  if (e.t === 'swept'){ const v = SWEPT_VEH[e.veh]; if (v) kw += ' ' + v.n; }
  if (e.ph != null && typeof phName === 'function') kw += ' ' + phName(e.ph);
  return sIndex(elLabel(e) + ' ' + (elSub(e) || ''), {cat:EL_NAME[e.t] || '', kw, tags});
}
/* chips de suggestion de la bibliothèque */
const LIB_CHIPS = [['vitesse', 'Vitesse'], ['déviation', 'Déviation'], ['route barrée', 'Route barrée'], ['piétons', 'Piétons'], ['cycles', 'Cycles'], ['poids lourds', 'Poids lourds'], ['balisage', 'Balisage'], ['feux', 'Feux'], ['engin', 'Engins'], ['camion', 'Camions']];
