* 🔹 **Completely generic**
* 🔹 Scalable for 100+ videos
* 🔹 Identifier-based (each article has a unique slug)
* 🔹 Consistent between page + files + zip
* 🔹 Clean URL structure
* 🔹 Future-proof

We will use a concept called:

> **ARTICLE_SLUG**

This will be the single source of truth for every page and its files.

Example slugs:

* `homepage`
* `cloud-init`
* `traefik`
* `proxmox-vlan`
* `ceph-mesh`

Everything will match that slug.

---

# SAVE THIS AS

```
docs/_templates/_article_creation_workflow.md
```

Below is your revised **generic master template**.

You can copy this exactly.

---

```md
#  Article Creation Workflow (Generic & Scalable)

This document defines the official process for creating new documentation pages and downloadable resources.

Every article is based on a single identifier called:

ARTICLE_SLUG

Examples:
- homepage
- cloud-init
- traefik
- proxmox-vlan

The slug is used everywhere to keep structure consistent.

---

# Site Architecture Overview

All content lives inside:

docs/

Important folders:

docs/
├── index.md                    → Root landing page
├── <ARTICLE_SLUG>/             → Individual article folder
│   └── index.md                → Article content
├── public/
│   └── files/
│       └── <ARTICLE_SLUG>/     → Downloadable files
├── .vitepress/
│   └── config.mjs              → Sidebar navigation

You NEVER edit:

- docs/.vitepress/dist
- docs/.vitepress/cache
- node_modules

These are generated automatically.

---

# HOW TO CREATE A NEW ARTICLE

Assume:

ARTICLE_SLUG = traefik

---

## 1 Create Article Folder

Create:

docs/<ARTICLE_SLUG>/

Example:

docs/traefik/

Why:
Folder name becomes the URL path.

Resulting URL:
https://yoursite.com/traefik/

---

## 2 Create index.md

Create:

docs/<ARTICLE_SLUG>/index.md

Required for clean routing.

---

## 3 Article Page Template

Paste into index.md:

---

# Article Title

## YouTube Video
- (paste link)

## What this page contains
Brief explanation of what this article covers.

## Files

- Browse configs: `/files/<ARTICLE_SLUG>/`
- Download all configs (ZIP): `/files/<ARTICLE_SLUG>/<ARTICLE_SLUG>-files.zip`

## Notes

### Step 1
Explanation

### Step 2
Explanation

### Troubleshooting
Common issues

---

---

#  HOW TO ADD DOWNLOADABLE FILES

Create:

docs/public/files/<ARTICLE_SLUG>/

Example:

docs/public/files/traefik/

Place individual files inside:

docs/public/files/traefik/docker-compose.yml
docs/public/files/traefik/traefik.yml

These automatically become accessible at:

/files/traefik/docker-compose.yml
/files/traefik/traefik.yml

No configuration required.

---

#  HOW TO CREATE A ZIP DOWNLOAD

Navigate to:

docs/public/files/<ARTICLE_SLUG>/

Run:

zip <ARTICLE_SLUG>-files.zip *

Example:

zip traefik-files.zip *

This creates:

docs/public/files/traefik/traefik-files.zip

Which becomes available at:

/files/traefik/traefik-files.zip

Link it in the article.

---

#  UPDATE SIDEBAR NAVIGATION

Edit:

docs/.vitepress/config.mjs

Add:

{
  text: 'Article Title',
  link: '/<ARTICLE_SLUG>/'
}

If not added here, the page will NOT appear in navigation.

---

# OPTIONAL: Update Root Landing Page

Edit:

docs/index.md

Add:

- [Article Title](/<ARTICLE_SLUG>/)

Only required if you want it featured on the homepage.

---

# TEST LOCALLY

Run:

npm run docs:dev

Verify:

✔ Page loads  
✔ Sidebar entry appears  
✔ File links work  
✔ ZIP downloads correctly  
✔ No broken links  

---

#  DEPLOY

Commit:

git add .
git commit -m "Add <ARTICLE_SLUG> article"
git push

GitHub Actions will build and deploy automatically.

---

#  FINAL PRE-PUSH CHECKLIST

✔ Created article folder:
docs/<ARTICLE_SLUG>/

✔ Created file:
docs/<ARTICLE_SLUG>/index.md

✔ Created download folder:
docs/public/files/<ARTICLE_SLUG>/

✔ Added individual files

✔ Created ZIP:
docs/public/files/<ARTICLE_SLUG>/<ARTICLE_SLUG>-files.zip

✔ Updated sidebar:
docs/.vitepress/config.mjs

✔ Updated root index (optional)

✔ Tested locally

✔ Pushed to GitHub

---

# DO NOT EDIT

docs/.vitepress/dist  
docs/.vitepress/cache  
node_modules  

These are auto-generated.

---

# REPEATABLE STRUCTURE STANDARD

Each article must follow:

docs/<ARTICLE_SLUG>/
docs/public/files/<ARTICLE_SLUG>/
files/<ARTICLE_SLUG>/<ARTICLE_SLUG>-files.zip

The slug must match across all locations.

Consistency prevents broken links and keeps the project scalable.
```

---

# What This Achieves

You now have:

* A single naming convention
* Identifiable article groups
* Clean URLs
* Organized downloadable content
* Scalable structure
* No hardcoded names like “reference”

Everything keys off the slug.
