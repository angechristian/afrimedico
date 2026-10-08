# Afrimedico deployment

The web UI is deployed to Vercel and the Express API is deployed to Render.
The API needs a persistent Render disk for SQLite and uploaded pharmacy
documents; it must not be deployed as a stateless Vercel function.

## 1. Protect local data before publishing

The repository ignore rules exclude the local SQLite database, uploaded
documents, build output, dependencies and environment files. Create a private
GitHub repository and push the source code without adding those ignored files.
Do not publish real pharmacy documents or production credentials.

## 2. Deploy the API on Render

Create a Render Blueprint from the private repository and use `render.yaml`.
The blueprint provisions a paid persistent disk at `/var/data`. Set
`ADMIN_INITIAL_PASSWORD` when prompted to a unique password of at least 12
characters and keep it private. The initial admin email is
`admin@afrimedico.rw`.

After deployment, confirm `https://<render-service>.onrender.com/api/health`
returns `{"status":"ok"}`.

## 3. Deploy the web UI on Vercel

Import the same repository into Vercel. The project uses the default Vite build
command and `dist` output directory from `vercel.json`. Set the Vercel
environment variable `VITE_API_BASE_URL` to the Render service origin, for
example `https://afrimedico-api.onrender.com` (no trailing slash), then
redeploy.

The client portal is served at `/`; the staff portal is served at `/admin`.
Use a pharmacy test account and the initial administrator account to verify
both portals. Payment collection and live proforma submission are not
implemented yet.
