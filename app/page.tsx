export default function Home() {
  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold text-yellow-400">FarBase Drop</h1>
      <p className="text-gray-400 mt-2">Loading...</p>
    </div>
  );
}
```

---

**9. `.gitignore`**
```
node_modules/
.next/
.env.local
```

---

**10. `.env.example`**
```
ADMIN_FID=429973
NEXT_PUBLIC_APP_URL=https://farbase-drop.vercel.app
