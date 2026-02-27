export type Lang = "en" | "tr";

const MESSAGES = {
  en: {
    common: {
      loading: "Loading...",
      close: "Close",
      back: "Back",
      next: "Next",
    },
    menu: {
      howToPlay: "How to Play",
      adminPanel: "Admin Panel",
      subtitle: "Skill-Based Crypto Merge • Base Mainnet",
      practice: "Practice",
      tournament: "Tournament",
      leaderboard: "Leaderboard",
      unlimited: "unlimited",
      adminUnlimitedAttempts: "Admin test - Unlimited attempts",
      dailyFreeNoRewards: "Daily free attempts - No rewards",
      noAttemptsResetsIn: "No attempts left - Resets in {{time}}",
      soon: "soon",
      tournamentTeaser: "1 USDC entry - Top 5 win - 3 attempts per entry",
      signInRequiredTournament: "Sign-in required for Tournament",
      thisWeeksRankings: "This week's rankings - Live updates",
      signInRequiredLeaderboard: "Sign-in required for Leaderboard",
      language: "EN/TR",
      switchToTurkish: "Türkçe",
      switchToEnglish: "English",
      switchToLight: "Switch to Light Mode",
      switchToDark: "Switch to Dark Mode",
    },
    howto: {
      title: "How to Play",
      ctaSave: "Save mini app (enable notifications)",
      ctaSkip: "Skip for now",
    },
    leaderboard: {
      title: "Leaderboard",
      back: "← Back",
      loading: "Loading...",
    },
    gameover: {
      title: "Game Over",
      playAgain: "Play Again",
      backToMenu: "Back to Menu",
    },
  },
  tr: {
    common: {
      loading: "Yükleniyor...",
      close: "Kapat",
      back: "Geri",
      next: "Devam",
    },
    menu: {
      howToPlay: "Nasıl Oynanır",
      adminPanel: "Admin Paneli",
      subtitle: "Yetenek Tabanlı Crypto Merge • Base Mainnet",
      practice: "Pratik",
      tournament: "Turnuva",
      leaderboard: "Sıralama",
      unlimited: "sınırsız",
      adminUnlimitedAttempts: "Admin test - Sınırsız deneme",
      dailyFreeNoRewards: "Günlük ücretsiz deneme - Ödül yok",
      noAttemptsResetsIn: "Deneme hakkı bitti - {{time}} sonra sıfırlanır",
      soon: "yakında",
      tournamentTeaser: "1 USDC giriş - İlk 5 kazanır - giriş başına 3 deneme",
      signInRequiredTournament: "Turnuva için giriş gerekli",
      thisWeeksRankings: "Bu haftanın sıralaması - Canlı güncelleme",
      signInRequiredLeaderboard: "Sıralama için giriş gerekli",
      language: "EN/TR",
      switchToTurkish: "Türkçe",
      switchToEnglish: "English",
      switchToLight: "Açık Mod",
      switchToDark: "Koyu Mod",
    },
    howto: {
      title: "Nasıl Oynanır",
      ctaSave: "Mini app'i kaydet (bildirimleri aç)",
      ctaSkip: "Şimdilik geç",
    },
    leaderboard: {
      title: "Sıralama",
      back: "← Geri",
      loading: "Yükleniyor...",
    },
    gameover: {
      title: "Oyun Bitti",
      playAgain: "Tekrar Oyna",
      backToMenu: "Ana Menü",
    },
  },
} as const;

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{\{(.*?)\}\}/g, (_, k) => String(vars[k.trim()] ?? ""));
}

export function t(lang: Lang, key: string, vars?: Record<string, string | number>) {
  const parts = key.split(".");
  const tryGet = (l: Lang) => {
    let cur: any = (MESSAGES as any)[l];
    for (const p of parts) {
      if (!cur || typeof cur !== "object" || !(p in cur)) return undefined;
      cur = cur[p];
    }
    return typeof cur === "string" ? cur : undefined;
  };

  const msg = tryGet(lang) ?? tryGet("en") ?? key;
  return interpolate(msg, vars);
}
