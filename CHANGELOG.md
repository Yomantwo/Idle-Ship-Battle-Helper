# Changelog

## v1.2.0 — 2026-09-27

- Corrige une sous-évaluation du DPS laser : la chauffe multiplie les dégâts de la
  cible verrouillée (jusqu'à ×1000), elle n'ajoutait qu'un petit bonus additif au
  nombre de cibles. Le script visait beaucoup trop peu de niveaux de Chauffe.

## v1.1.0 — 2026-09-27

- Ajoute l'en-tête `X-Client: idle-ship-battle-helper` sur les requêtes d'achat, pour
  distinguer dans les journaux du serveur une action du helper d'un clic manuel.

## v1.0.0 — 2026-09-27

Première version publique.

- Auto-achat des armes (canon, laser, missile) : choisit à chaque fois l'amélioration
  qui minimise (temps pour réunir le prix + temps de retour sur investissement).
- Auto-achat de l'arbre de prestige : simule un run complet avec et sans chaque nœud
  accessible, et compare le gain de prestige par heure au gain de dégâts.
- Panneau avec deux bandeaux d'action (prochain achat d'arme, prochain nœud), crédits,
  prestige, et un journal des derniers achats.
- Bascules indépendantes armes / arbre, activables séparément.
- Zéro requête de lecture ajoutée : le script écoute les réponses `/api/snapshot` et
  `/api/sync` que le jeu reçoit déjà, il n'envoie que les requêtes d'achat.
