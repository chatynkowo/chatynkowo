# Chatynkowo

Another vision of https://chatynkowo.pl — a magical, fairytale-themed cottage map.

## Editor

The built-in editor lives at `/admin/` on the deployed GitHub Pages site.  
It writes directly to this repository through the GitHub API, so no server is needed — only a browser and a Personal Access Token (PAT).

### Creating a Personal Access Token

1. Open **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**  
   Direct link: https://github.com/settings/personal-access-tokens/new

2. Fill in the form:
   | Field | Value |
   |---|---|
   | **Token name** | e.g. `chatynkowo-editor` |
   | **Expiration** | Choose a period that suits you (e.g. 90 days); note the expiry date |
   | **Repository access** | *Only select repositories* → pick this repository |

3. Under **Repository permissions** set:
   | Permission | Level |
   |---|---|
   | **Contents** | **Read and write** |

   All other permissions can stay at *No access*.

4. Click **Generate token** and copy the value immediately — it is shown only once.

### First login

1. Open `https://<owner>.github.io/<repo>/admin/` in a browser.
2. Paste the token into the **GitHub Personal Access Token** field.
3. Click **Zaloguj** — the editor will load the cottage list from the repository.

The token is stored only in your browser's `localStorage` and is never sent anywhere other than `api.github.com`.

### Token expired?

Click the **⚙** button in the top-right corner of the editor to open the settings panel and enter a new token.

### Local development (Node.js server)

```bash
node private/admin/server.mjs
# editor → http://localhost:3000/admin/
```

The local server reads and writes files directly on disk — no token required.