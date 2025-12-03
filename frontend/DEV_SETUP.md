# Configuration pour le développement local

## 1. Configuration Google OAuth

Pour pouvoir tester l'authentification Google en local, vous devez autoriser `localhost` dans votre Google Cloud Console.

### Étapes :

1. **Accédez à [Google Cloud Console](https://console.cloud.google.com/)**

2. **Naviguez vers APIs & Services > Credentials**

3. **Trouvez votre OAuth 2.0 Client ID** :
   - ID actuel : `799512397800-hg7aiomhtmqfge0ge77528qeh68nuhmo`

4. **Cliquez sur l'ID pour l'éditer**

5. **Ajoutez les URIs de développement** :

   Dans **Authorized JavaScript origins** :
   ```
   http://localhost:5173
   ```

   Dans **Authorized redirect URIs** :
   ```
   http://localhost:5173/
   ```

6. **Sauvegardez** (bouton "Save" en bas)

⚠️ **Note** : Les changements peuvent prendre quelques minutes pour être actifs.

## 2. Configuration du proxy local

Le fichier `vite.config.js` a été configuré avec un proxy pour rediriger les appels API vers votre backend de production (`zgurl.cc`) pendant le développement.

Cela évite les problèmes CORS et vous permet de tester avec de vraies données.

### Comment ça fonctionne :

- En **développement** (`npm run dev`) :
  - `API_ENDPOINT = ""` (chaîne vide)
  - Les appels à `/create` et `/stats/*` sont proxifiés vers `https://zgurl.cc`
  - Exemple : `fetch("/create")` → `https://zgurl.cc/create`

- En **production** (après `npm run build`) :
  - `API_ENDPOINT = "https://votredomaine.com"` (remplacé par le Makefile)
  - Les appels utilisent le domaine complet

## 3. Lancer le serveur de développement

```bash
cd frontend-new
npm run dev
```

L'application sera disponible sur : **http://localhost:5173**

## 4. Tester l'authentification

1. Ouvrez http://localhost:5173
2. Cliquez sur "Sign in with Google"
3. Sélectionnez votre compte Google
4. Vous serez redirigé vers `http://localhost:5173/#id_token=...`
5. L'application va automatiquement extraire le token et vous connecter

## 5. Tester la création d'URL

Une fois connecté :
1. Allez dans l'onglet "Create Link"
2. Entrez une URL longue
3. Ajustez les options (Human Readable, TTL)
4. Cliquez sur "Create Short URL"
5. L'appel sera fait vers votre backend de production via le proxy

## 6. Tester les statistiques

1. Allez dans l'onglet "Statistics"
2. Entrez un short ID existant
3. Cliquez sur "Fetch Stats"
4. Les stats s'afficheront si le lien existe

## Troubleshooting

### Erreur "redirect_uri_mismatch"
- Vérifiez que vous avez bien ajouté `http://localhost:5173/` dans Google Cloud Console
- Attention au slash final `/` - il est important !
- Attendez quelques minutes après avoir sauvegardé les changements

### Erreur CORS
- Le proxy Vite devrait résoudre ce problème automatiquement
- Vérifiez que `vite.config.js` contient bien la configuration du proxy

### L'authentification ne fonctionne pas
- Ouvrez la console du navigateur (F12) pour voir les erreurs
- Vérifiez que le token est bien dans l'URL après la redirection Google
- Vérifiez que sessionStorage contient `adminSession`

### Erreur 401/403 lors des appels API
- Vérifiez que votre email est autorisé dans la table DynamoDB `auth-users`
- Le backend vérifie que l'utilisateur est dans la liste blanche

## Variables d'environnement (optionnel)

Si vous voulez personnaliser la configuration sans modifier `config.js`, vous pouvez créer un fichier `.env.local` :

```env
VITE_GOOGLE_CLIENT_ID=votre-client-id
VITE_API_ENDPOINT=https://zgurl.cc
```

Puis dans `config.js`, utilisez :
```js
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "799512397800-...";
export const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || (import.meta.env.DEV ? "" : "__PLACEHOLDER__");
```

## Hot Module Replacement (HMR)

Vite supporte le HMR, donc vos changements apparaîtront instantanément sans recharger la page complète.

Modifiez n'importe quel fichier `.jsx` et voyez les changements en temps réel !
