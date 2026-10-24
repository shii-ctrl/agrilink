export const procyMarketCategories = [
  "Lowland Crops",
  "Highland Crops",
  "Fruits",
  "Root Crops",
  "Staple Crops",
  "Other Commodities",
] as const;

export type ProcyMarketCategory = (typeof procyMarketCategories)[number];

export const procyMarketCategoryGuide = [
  {
    name: "Lowland Crops",
    description: "Vegetables commonly supplied from lowland growing areas.",
    examples: "Ampalaya, upo, cucumber, eggplant, okra, sitaw, kamatis",
  },
  {
    name: "Highland Crops",
    description: "Vegetables commonly supplied from highland growing areas.",
    examples: "Bell pepper, broccoli, cabbage, carrots, cauliflower, lettuce",
  },
  {
    name: "Fruits",
    description: "Fresh fruits sold through the PROCY market.",
    examples: "Mango, calamansi, melon, papaya, pineapple, banana, watermelon",
  },
  {
    name: "Root Crops",
    description: "Edible roots, rhizomes, and tubers.",
    examples: "Cassava, ginger, ube, radish, sweet potato, taro",
  },
  {
    name: "Staple Crops",
    description: "Basic crop commodities used as common food staples.",
    examples: "Coconut, white corn, yellow corn",
  },
  {
    name: "Other Commodities",
    description: "Other PROCY market goods.",
    examples: "Eggs, mung beans, banana blossom, singkamas",
  },
] as const;

const namesByCategory: Record<ProcyMarketCategory, readonly string[]> = {
  "Lowland Crops": [
    "ampalaya galaxy",
    "ampalaya mestisa",
    "bottle gourd",
    "upo",
    "cucumber green",
    "cucumber white",
    "eggplant domino",
    "eggplant calixto",
    "japanese cucumber",
    "kangkong",
    "lemon grass",
    "lemongrass",
    "mustard",
    "okra",
    "panigang jango",
    "panigang sigang best",
    "papaya hilaw",
    "patola kinis",
    "patola talim",
    "pechay tagalog",
    "sigarilyas",
    "siling labuyo",
    "snapbeans",
    "squash tagalog",
    "squash suprema",
    "string beans makisig",
    "string beans mariposa",
    "string beans maxigreen",
    "string beans negrostar",
    "kamatis",
    "tomato",
    "eggplant",
  ],
  "Highland Crops": [
    "bellpepper green",
    "bellpepper red",
    "bell pepper green",
    "bell pepper red",
    "bell pepper low land",
    "broccoli",
    "bawang",
    "cabbage",
    "carrots",
    "carrot",
    "cauli flower",
    "cauliflower",
    "celery",
    "sayote baguio",
    "sayote tagalog",
    "pechay baguio",
    "lettuce green ice",
    "lettuce iceberg",
    "leeks",
    "marble potato",
    "patatas",
    "red onion",
    "spring onion",
    "sweet pepper tagalog",
    "white onion",
  ],
  Fruits: [
    "apple",
    "avocado",
    "calamansi",
    "manga",
    "mango",
    "guyabano",
    "langka",
    "lemon",
    "melon",
    "papaya hinog",
    "pinya",
    "pineapple",
    "saging lakatan",
    "saging turdan",
    "saging saba",
    "watermelon",
    "rambutan",
    "lansones",
  ],
  "Root Crops": [
    "balinghoy",
    "luya matured",
    "luya young",
    "ube",
    "labanos",
    "radish",
    "kamote",
    "gabi",
    "luyang dilaw",
  ],
  "Staple Crops": ["niyog", "mais puti", "mais yellow"],
  "Other Commodities": [
    "brown egg",
    "salted egg",
    "white egg",
    "monggo",
    "puso ng saging",
    "singkamas",
  ],
};

function normalizedProductName(name: string) {
  return name
    .toLocaleLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function procyMarketCategoryForProduct(name: string): ProcyMarketCategory | null {
  const normalizedName = normalizedProductName(name);

  for (const category of procyMarketCategories) {
    if (namesByCategory[category].some((item) => normalizedProductName(item) === normalizedName)) {
      return category;
    }
  }

  return null;
}

export function procyCategoryOrder(category: ProcyMarketCategory | null) {
  return category ? procyMarketCategories.indexOf(category) : procyMarketCategories.length;
}
