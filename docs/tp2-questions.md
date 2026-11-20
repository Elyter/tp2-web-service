# TP 2 – Recettes : réponses aux questions

## Question d'ouverture : comment le recipe service sait-il qui fait la requête ?

Seule la gateway voit le token. Elle le vérifie (guard global du TP 1), puis transmet l'id de l'utilisateur **vérifié** au recipe service dans les **métadonnées gRPC**, sous la clé `x-user-id` :

- côté gateway : `userMetadata(user.id)`, passé en second argument de chaque appel ;
- côté service : `requireUserId(metadata)` lit cet id, ou lève `UNAUTHENTICATED` s'il manque.

La clé est définie à un seul endroit, `packages/contracts/src/grpc.ts`, et partagée par les deux côtés. Le `.proto` ne décrit pas les métadonnées : un commentaire dans `recipe.proto` les documente.

## 1.9 – Pourquoi `CreateRecipeRequest` n'a pas de champ `owner_id` ?

Si le front envoyait l'auteur, n'importe qui pourrait publier **au nom** d'un autre : il suffirait de changer l'id dans le corps de la requête. L'auteur, c'est l'utilisateur **authentifié**, celui du token. Le recipe service l'apprend donc de la gateway, jamais du client. Côté gateway, `forbidNonWhitelisted` refuse d'ailleurs un `ownerId` dans le corps (400).

## 2.6 – Authentifier n'est pas autoriser

| Question                    | Qui répond                          | Erreur gRPC         | HTTP |
| --------------------------- | ----------------------------------- | ------------------- | ---- |
| **Qui** êtes-vous ?         | la gateway, avec le token           | `UNAUTHENTICATED`   | 401  |
| En avez-vous le **droit** ? | le recipe service, avec ses données | `PERMISSION_DENIED` | 403  |

La gateway ne connaît pas l'auteur d'une recette : seul le recipe service peut décider. La règle vit donc avec la donnée qu'elle protège. Un 401 veut dire « je ne sais pas qui vous êtes » ; un 403, « je le sais, et c'est non ».

## 3.14 – À quoi sert le 403 si le front masque déjà le bouton ?

Le front n'est **pas** une barrière : `curl` (comme en 3.12) contourne n'importe quelle interface. Masquer le bouton, c'est du confort ; la règle, elle, vit dans le service qui détient la donnée.

## 4.2 – Bonus : afficher le nom de l'auteur

Le recipe service ne connaît que l'**id** de l'auteur, et il n'y a pas de jointure possible entre `recipe-db` et `user-db`. La gateway fait une **composition d'API** : elle récupère les recettes, puis demande tous les auteurs au user service en **un seul** appel `GetUsers` (ids dédoublonnés avec un `Set`), et les rattache aux recettes avec une `Map`. Un auteur disparu donne `author: null`, pas une erreur.

## 4.6 – Et si le user service tombe ?

Avant le bonus, `GET /recipes` ne dépendait que du recipe service : 200. Avec la composition, l'appel `GetUsers` échoue (`UNAVAILABLE`) et toute la liste répond **503** : une seule dépendance en panne fait tomber la route entière.

## 4.8 – Une confiance aveugle

Le recipe service croit `x-user-id` sur parole : quelqu'un qui l'appelle directement peut se faire passer pour n'importe qui. C'est acceptable seulement si le service n'est joignable que par la gateway, sur un réseau **interne**. Sinon : **mTLS** entre services (chacun prouve son identité par un certificat), ou le token propagé jusqu'au service, qui le vérifie lui-même.

## 4.9 – Valider deux fois ?

Oui : c'est la **défense en profondeur**. Le service ne sait pas qui l'appellera demain (une autre gateway, un script, un autre service). Il doit protéger ses propres invariants : un titre non vide, des listes bornées. La validation de la gateway sert à répondre vite et proprement au client ; celle du service protège la donnée. Dans ce TP, le recipe service ne s'appuie encore que sur le schéma Mongoose (`title` requis) : il faudrait ajouter ses propres contrôles et renvoyer `INVALID_ARGUMENT` (400 côté gateway).

## 4.10 – Une dépendance en panne : comment faire mieux ?

- **Mode dégradé** : renvoyer les recettes sans leurs auteurs (`author: null`) plutôt que rien.
- **Deadline** sur l'appel gRPC, pour ne pas attendre indéfiniment un service qui ne répond pas.
- **Circuit breaker** : après plusieurs échecs, cesser d'appeler le service en panne pendant un moment, le temps qu'il se rétablisse, puis réessayer prudemment.
