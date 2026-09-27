# Idle Ship Battle — Helper

Userscript Tampermonkey pour [Idle Ship Battle](https://idleshipbattle.myrialis.com/).
Il achète armes et nœuds de l'arbre de prestige au meilleur rendement, à partir des
formules exactes du jeu.

> **C'est un script d'automatisation.** Il joue à ta place. À n'utiliser qu'avec l'accord
> du développeur du jeu.

## Installation

1. Installer [Tampermonkey](https://www.tampermonkey.net/)
2. Tableau de bord → **Créer un nouveau script**
3. Tout sélectionner (Ctrl+A), coller le contenu de
   [`idle-ship-battle-helper.user.js`](idle-ship-battle-helper.user.js), enregistrer (Ctrl+S)
4. Ouvrir le jeu — un panneau apparaît en haut à gauche

Le script ne contient aucune donnée liée à un compte précis : les décisions se recalculent
entièrement depuis l'état reçu du jeu, il s'adapte donc tout seul à n'importe quel compte
et n'importe quel stade de partie.

## Le panneau

```
AUTO-ACHAT              Armes ON  Arbre ON  –
Crédits 1,3k · Prestige 219◇
▶ PROCHAIN ACHAT
Canon → Cadence · 17 cr · +2,1 % DPS · maintenant
▶ PROCHAIN NŒUD
Prestige +3 % · 100◇ · maintenant
12:20:40 Canon Dégâts → niv 4 (×4)
```

- **Armes / Arbre** se basculent indépendamment (clic sur chaque bouton) : utile pour
  garder une catégorie en manuel. Le panneau continue d'indiquer le meilleur choix même
  quand l'achat automatique d'une catégorie est désactivé.
- Un bandeau **vert** signifie que l'achat est finançable tout de suite ; **bleu** qu'il
  faut encore attendre (armes) ou accumuler du prestige (arbre).
- **–** replie le panneau. Tous les réglages sont mémorisés dans `localStorage`.

## Comment il choisit — Armes

Pour chaque amélioration disponible (dégâts, cadence, multitir/rayons/zone/salve selon
l'arme), le script calcule le gain de DPS et le coût réel (avec la remise du nœud
Marchandage), puis retient celle qui minimise :

```
temps pour réunir le prix  +  coût / (gain de DPS × revenu par point de DPS)
```

Le revenu par point de DPS (κ) est mesuré en continu à partir des crédits gagnés entre
deux synchronisations, pas supposé. Les achats consécutifs sur la même piste sont
regroupés en une seule requête.

## Comment il choisit — Arbre de prestige

Les niveaux d'armes repartent à zéro à chaque run (chute de la ligne de défense) ; les
nœuds de l'arbre restent acquis pour toujours. Pour chaque nœud pas encore possédé, le
script :

1. Calcule le chemin le moins cher pour l'atteindre (les nœuds de passage comptent).
2. Simule un run complet avec et sans ce chemin (répartition optimale des crédits sur
   les armes dans les deux cas).
3. Compare le gain de **prestige par heure** et le gain de **dégâts**, rapportés au coût
   en prestige du chemin.

Le nœud qui rapporte le plus par point de prestige dépensé est acheté en premier.

## Les formules

Le jeu ne renvoie jamais le coût ni l'effet des nœuds de l'arbre par son API : c'est une
table fixe côté client. Les constantes utilisées ici (coûts, croissances, formules de
dégâts et de prestige) ont été retrouvées par rétro-ingénierie du client du jeu et vérifiées contre l'état réellement renvoyé par le serveur.
Si le jeu change son équilibrage, ces constantes devront être mises à jour.

## Licence

MIT, voir [LICENSE](LICENSE).
