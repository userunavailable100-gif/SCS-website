# SCS Member Portal — Live Karne Ka Tareeqa

Ye website Firebase (free database) + Vercel (free hosting) se live hogi.
Total time: ~20-30 minutes, koi cost nahi (free tiers kaafi hain shuru ke liye).

---

## Step 1 — GitHub account (agar nahi hai to)
1. https://github.com par jayein → Sign up (free)

## Step 2 — Ye code GitHub par upload karein
1. GitHub par "New repository" banayein (naam: scs-website, Public ya Private)
2. Is poore folder (scs-website) ko us repository mein upload kar dein
   - Sabse aasan tareeqa: GitHub website par "uploading an existing file" wala link use karein aur sari files/folders drag-drop kar dein

## Step 3 — Firebase database banayein (FREE)
1. https://console.firebase.google.com par jayein → Google account se login
2. "Add project" → koi bhi naam dein (e.g. scs-portal) → Continue → project bana lein
3. Left menu mein "Build" > "Firestore Database" > "Create database"
4. "Start in test mode" select karein → location select karein (asia-south1 ya jo qareeb ho) → Enable
5. Left menu mein gear icon (⚙) > "Project settings"
6. Neeche scroll karein "Your apps" tak > "</>" (Web) icon par click karein
7. App ka koi naam dein > "Register app"
8. Jo config code dikhega (apiKey, authDomain, projectId, etc.) — usay copy kar lein

## Step 4 — Config apni website mein daalein
1. `src/firebase.js` file kholein (GitHub par edit kar sakte hain — pencil icon)
2. `YOUR_API_KEY`, `YOUR_PROJECT_ID` waghera ko Step 3 se copy ki hui values se replace karein
3. Save/commit kar dein

## Step 5 — Vercel par live karein (FREE)
1. https://vercel.com par jayein → "Continue with GitHub" se sign up
2. Dashboard mein "Add New" > "Project"
3. Apni `scs-website` repository select karein > "Import"
4. Sab settings default hi rehne dein > "Deploy" par click karein
5. 1-2 minute mein aapko ek asal live link mil jayega: `scs-website-yourname.vercel.app`

## Step 6 — Apna admin login change karein
`src/App.jsx` file mein sabse upar ye lines milengi:
```
const ADMIN_USERNAME = "scs_owner_26";
const ADMIN_PASS = "Scs#Vault!9247Qx";
```
Inko apni pasand ke mushkil username/password se replace kar dein, phir GitHub par commit karein — Vercel khud-ba-khud dobara deploy kar dega.

## Step 7 — Custom domain (optional)
Agar aap `scscircle.com` jaisa apna naam chahti hain:
1. Koi domain provider (Namecheap, Hostinger, GoDaddy) se domain khareedein (~Rs 1,500-3,000/saal)
2. Vercel project > Settings > Domains > apna domain add karein > jo DNS instructions milein wo domain provider ki settings mein daal dein

---

## Zaroori baatein
- Firebase "test mode" 30 din ke baad khud expire ho jata hai security ke liye — us se pehle Firestore rules ko production ke liye theek karwana hoga (kisi developer se ek baar madad le lein, ya bata dein main guide kar dun)
- Password abhi plain text mein save ho raha hai — real business ke liye ise encrypt karwana zaroori hai (security ke liye)
- Jab website live ho jaye, to referral link automatically kaam karega — jo link members share karein ge (`.../?ref=SCS-100001`) wahi asal live domain ka link hoga
