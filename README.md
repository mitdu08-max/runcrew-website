# runcrew.fr — site vitrine, Espace Club et corpus juridique

Site statique (HTML/CSS/JS sans framework) déployé sur Vercel. Le dossier `public/` est servi tel quel ;
`vercel.json` gère les URL propres (`/privacy` → `public/privacy.html`), les en-têtes de sécurité et le cache.

## Arborescence

| Chemin | Rôle |
| --- | --- |
| `public/index.html` | Page d'accueil (liste d'attente Formspree, FAQ, JSON-LD) |
| `public/club.html` + `public/js/club.js` | Espace Club (Firebase Auth email + mot de passe, Firestore `clubs/{id}/coaches|sessions`) |
| `public/privacy.html`, `cgu.html`, `cgv.html`, `mentions-legales.html`, `suppression-compte.html`, `compatibilite.html` | Pages juridiques et d'aide (version et date en tête de page et dans `.doc-foot`) |
| `public/css/site.css` | Design system (tokens `--navy`, `--orange`…, composants) |
| `public/css/page.css`, `public/css/club.css` | Styles des pages documentaires et du portail club |
| `public/js/site.js` | Navigation, formulaires de liste d'attente (fetch → Formspree), onglets, reveal |
| `public/img/`, `public/fonts/` | Images (JPEG + WebP), logos SVG, polices auto-hébergées (aucune requête Google Fonts) |
| `public/robots.txt`, `sitemap.xml`, `site.webmanifest`, `404.html` | SEO et PWA minimale |

## Travailler en local

```bash
python3 -m http.server 8000 --directory public
```

Les URL propres ne sont pas émulées par ce serveur : ouvrir `/privacy.html` plutôt que `/privacy`.
Lint HTML : `npx htmlhint public/*.html`. Syntaxe JS : `node --check public/js/club.js`.

## En-têtes de sécurité et CSP (`vercel.json`)

- Toutes les pages : `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS.
- Pages du site (`/((?!club).*)`) : CSP stricte — scripts et polices locaux uniquement, `connect-src`/`form-action` ouverts
  à `https://formspree.io` pour la liste d'attente. **Aucun script inline n'est autorisé** (le JSON-LD n'est pas concerné).
- `/club` : CSP dédiée — SDK Firebase depuis `www.gstatic.com`, appels vers `*.googleapis.com`, iframe d'auth
  `runcrew-89257.firebaseapp.com`, `apis.google.com` (initialisation du SDK sur Safari/mobile).
  Le portail n'a plus de script ni de gestionnaire `onclick` inline : les boutons utilisent `data-action="fonction"`
  (+ `data-arg`) résolus par la délégation en fin de `js/club.js`. Pour un nouveau bouton, ajouter la fonction à `ACTIONS`.
- Si vous activez plus tard la connexion Google ou la protection reCAPTCHA de Firebase Auth, ajouter
  `https://www.google.com` à `script-src`/`frame-src` de la règle `/club`.
- Après chaque déploiement touchant au portail : ouvrir `/club` en production, console ouverte — aucune ligne
  « Refused to … Content Security Policy » ne doit apparaître. Si une apparaît, ajouter l'hôte cité à la directive indiquée.

## Checklist de lancement Google Play

1. Télécharger le badge officiel français (« Disponible sur Google Play ») sur
   <https://play.google.com/intl/fr_fr/badges/> et le déposer dans `public/img/badges/google-play-badge-fr.png`
   (ne pas le redessiner ni le recolorer ; hauteur affichée 60 px, marge libre autour).
2. Dans `public/index.html`, rechercher `LANCEMENT GOOGLE PLAY` (4 occurrences) : décommenter la méta
   `google-play-app`, remplacer le formulaire du hero et la ligne « Bientôt sur Google Play » par les blocs fournis,
   compléter le JSON-LD (`installUrl`, `downloadUrl`, `softwareVersion`).
3. Mettre à jour les textes : eyebrow du hero (« Application running live · Android »), FAQ « Sur quels téléphones ? »,
   bandeau `#liste` (garder la liste d'attente pour la version iOS si souhaité).
4. Juridique : `mentions-legales.html` §5 (distribution) si iOS arrive en même temps ; CGU 1 et CGV 1.1 mentionnent
   déjà l'App Store « à venir ».
5. `sitemap.xml` : mettre à jour `lastmod` de `/`.
6. Formspree (plan gratuit : 50 envois/mois) : passer au plan payant ou basculer la liste d'attente sur une fonction
   Vercel avant toute communication large.

## Captures d'écran de l'application

Déposer les captures Android (720 × 1544, JPEG qualité 85) dans `public/img/app/` :
`vue-2d.jpg`, `vue-3d-relief.jpg`, `vue-fond-art.jpg`, `cockpit.jpg`, idéalement `supporter.jpg`.
Générer ensuite les variantes WebP (704 px et 352 px de large) :

```bash
python3 - <<'EOF'
from PIL import Image
import glob, os
for src in glob.glob('public/img/app/*.jpg'):
    im = Image.open(src).convert('RGB'); base = os.path.splitext(src)[0]
    im.resize((704, round(im.height * 704 / im.width)), Image.LANCZOS).save(base + '.webp', 'WEBP', quality=72, method=6)
    im.resize((352, round(im.height * 352 / im.width)), Image.LANCZOS).save(base + '-352.webp', 'WEBP', quality=74, method=6)
EOF
```

Les `<picture>` de `index.html` attendent ces trois fichiers par vue (`.jpg`, `.webp`, `-352.webp`).

## Miroir Firebase Hosting

Ce dépôt ne contient pas de `firebase.json` : URL propres, page 404, en-têtes de sécurité et cache n'existent que sur
Vercel. Si le miroir reste public, soit le faire rediriger en 301 vers `https://runcrew.fr`, soit y reporter la
configuration (`cleanUrls`, `headers`) — demander le fichier équivalent si besoin.

## Juridique : versions en ligne

| Document | Version | Date |
| --- | --- | --- |
| Politique de confidentialité | V2.6 | 14 octobre 2026 |
| CGU | V2.3 | 14 octobre 2026 |
| CGV (Premium individuel + Abonnement Structure) | V2.1 | 14 octobre 2026 |
| Suppression de compte | V2.1 | 14 octobre 2026 |

Toute modification substantielle : incrémenter la version et la date en tête de page et dans `.doc-foot`,
puis informer les utilisateurs (notification app) et les structures/inscrits (email), conformément à la privacy §17.
