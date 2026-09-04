export type VaultItem = {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  tags: string[];
  favorite: boolean;
  color: string;
};

export const fixtureItems: VaultItem[] = [
  {
    id: "github",
    title: "GitHub",
    username: "alex@example.test",
    password: "Fixture!GitHub#2026",
    url: "https://github.com",
    notes: "Personal code and experiments.",
    tags: ["Personal", "Code"],
    favorite: true,
    color: "#242421",
  },
  {
    id: "mail",
    title: "Proton Mail",
    username: "alex@example.test",
    password: "Fixture!Mail#2026",
    url: "https://mail.proton.me",
    notes: "Primary fixture email account.",
    tags: ["Personal"],
    favorite: true,
    color: "#6d5bd0",
  },
  {
    id: "figma",
    title: "Figma",
    username: "design@example.test",
    password: "Fixture!Figma#2026",
    url: "https://figma.com",
    notes: "Design workspace fixture.",
    tags: ["Work", "Design"],
    favorite: false,
    color: "#f24e1e",
  },
  {
    id: "notion",
    title: "Notion",
    username: "notes@example.test",
    password: "Fixture!Notion#2026",
    url: "https://notion.so",
    notes: "Project notes fixture.",
    tags: ["Work"],
    favorite: false,
    color: "#4e504c",
  },
  {
    id: "spotify",
    title: "Spotify",
    username: "music@example.test",
    password: "Fixture!Spotify#2026",
    url: "https://spotify.com",
    notes: "Music account fixture.",
    tags: ["Personal", "Media"],
    favorite: false,
    color: "#1db954",
  },
];

export function filterItems(items: VaultItem[], query: string, tag: string) {
  const needle = query.trim().toLocaleLowerCase();
  return items.filter((item) => {
    const matchesTag = tag === "All" || item.tags.includes(tag);
    if (!matchesTag) return false;
    if (!needle) return true;
    return [item.title, item.username, item.url, ...item.tags]
      .join(" ")
      .toLocaleLowerCase()
      .includes(needle);
  });
}

export function createPassword(length: number, symbols: boolean) {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const numbers = "23456789";
  const symbolSet = "!@#$%&*?";
  const alphabet = lower + upper + numbers + (symbols ? symbolSet : "");
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}
